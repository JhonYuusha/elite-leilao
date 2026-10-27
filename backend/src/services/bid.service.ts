import { createHash } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const ANTI_SNIPING_MS = 2 * 60 * 1000;

export class BidError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "BidError";
  }
}

type LockedLot = {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  startingBidCents: bigint;
  minIncrementCents: bigint;
  currentBidCents: bigint | null;
};

type LockedWallet = {
  id: string;
  userId: string;
  totalCents: bigint;
  committedCents: bigint;
};

export async function placeBid(
  lotId: string,
  bidderId: string,
  amountCents: bigint,
) {
  return prisma.$transaction(
    async (tx) => {
      // Todos os lances do mesmo lote são serializados.
      const lots = await tx.$queryRaw<LockedLot[]>`
        SELECT
          id,
          status,
          "startsAt",
          "endsAt",
          "startingBidCents",
          "minIncrementCents",
          "currentBidCents"
        FROM "Lot"
        WHERE id = ${lotId}
        FOR UPDATE
      `;

      const lot = lots[0];

      if (!lot) {
        throw new BidError(404, "Lote não encontrado.");
      }

      if (lot.status === "CANCELLED" || lot.status === "ENDED") {
        throw new BidError(
          409,
          "O lote não está disponível para receber lances.",
        );
      }

      const minimumBid =
        lot.currentBidCents === null
          ? lot.startingBidCents
          : lot.currentBidCents + lot.minIncrementCents;

      if (amountCents < minimumBid) {
        throw new BidError(
          409,
          `Lance insuficiente. Mínimo: ${minimumBid.toString()} centavos.`,
        );
      }

      const previousBid = await tx.bid.findFirst({
        where: { lotId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });

      if (previousBid?.bidderId === bidderId) {
        throw new BidError(
          409,
          "Você já possui o maior lance deste lote.",
        );
      }

      // Participantes cujas carteiras serão alteradas pelo lance.
      // Também serão notificados após a confirmação da transação.
      const walletUserIds = [
        bidderId,
        ...(previousBid ? [previousBid.bidderId] : []),
      ].sort();

      const wallets: LockedWallet[] = [];

      // Bloqueia as carteiras em ordem determinística.
      for (const userId of walletUserIds) {
        const rows = await tx.$queryRaw<LockedWallet[]>`
          SELECT
            id,
            "userId",
            "totalCents",
            "committedCents"
          FROM "Wallet"
          WHERE "userId" = ${userId}
          FOR UPDATE
        `;

        const wallet = rows[0];

        if (!wallet) {
          throw new BidError(
            409,
            "Carteira necessária para o lance não encontrada.",
          );
        }

        wallets.push(wallet);
      }

      // O relógio é consultado depois de adquirir os bloqueios.
      // clock_timestamp() retorna o horário atual do PostgreSQL.
      const clock = await tx.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp() AS now
      `;

      const acceptedAt = clock[0]?.now;

      if (!acceptedAt) {
        throw new Error(
          "Não foi possível consultar o relógio do banco.",
        );
      }

      if (
        acceptedAt < lot.startsAt ||
        acceptedAt >= lot.endsAt
      ) {
        throw new BidError(
          409,
          "O lote não está disponível para receber lances.",
        );
      }

      const bidderWallet = wallets.find(
        (wallet) => wallet.userId === bidderId,
      );

      if (!bidderWallet) {
        throw new BidError(409, "Carteira não encontrada.");
      }

      const availableCents =
        bidderWallet.totalCents - bidderWallet.committedCents;

      if (availableCents < amountCents) {
        throw new BidError(
          409,
          "Saldo disponível insuficiente para este lance.",
        );
      }

      if (previousBid) {
        const previousWallet = wallets.find(
          (wallet) => wallet.userId === previousBid.bidderId,
        );

        if (
          !previousWallet ||
          previousWallet.committedCents < previousBid.amountCents
        ) {
          throw new BidError(
            409,
            "Inconsistência na reserva do lance anterior.",
          );
        }

        // Libera o valor reservado pelo líder anterior.
        await tx.wallet.update({
          where: { id: previousWallet.id },
          data: {
            committedCents: {
              decrement: previousBid.amountCents,
            },
          },
        });

        await tx.walletTransaction.create({
          data: {
            userId: previousBid.bidderId,
            type: "BID_RELEASE",
            amountCents: previousBid.amountCents,
            lotId,
          },
        });
      }

      // Reserva o valor do novo lance.
      await tx.wallet.update({
        where: { id: bidderWallet.id },
        data: {
          committedCents: {
            increment: amountCents,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          userId: bidderId,
          type: "BID_COMMIT",
          amountCents,
          lotId,
        },
      });

      const previousHash = previousBid?.hash ?? null;

      const hashPayload = JSON.stringify({
        lotId,
        bidderId,
        amountCents: amountCents.toString(),
        acceptedAt: acceptedAt.toISOString(),
        previousHash,
      });

      const hash = createHash("sha256")
        .update(hashPayload)
        .digest("hex");

      const bid = await tx.bid.create({
        data: {
          lotId,
          bidderId,
          amountCents,
          previousHash,
          hash,
          createdAt: acceptedAt,
        },
      });

      const remainingMs =
        lot.endsAt.getTime() - acceptedAt.getTime();

      const extended =
        remainingMs > 0 &&
        remainingMs <= ANTI_SNIPING_MS;

      const endsAt = extended
        ? new Date(acceptedAt.getTime() + ANTI_SNIPING_MS)
        : lot.endsAt;

      await tx.lot.update({
        where: { id: lotId },
        data: {
          currentBidCents: amountCents,
          endsAt,
          status: "LIVE",
        },
      });

      return {
        // Metadado interno utilizado para notificações privadas.
        // A rota HTTP deve remover este campo da resposta pública.
        affectedWalletUserIds: walletUserIds,

        bid: {
          id: bid.id,
          lotId: bid.lotId,
          bidderId: bid.bidderId,
          amountCents: bid.amountCents.toString(),
          previousHash: bid.previousHash,
          hash: bid.hash,
          createdAt: bid.createdAt,
        },

        lot: {
          id: lotId,
          currentBidCents: amountCents.toString(),
          endsAt,
          status: "LIVE" as const,
          extended,
        },
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 15000,
    },
  );
}
import { randomBytes } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

const MAX_BIGINT = 9223372036854775807n;

export class SettlementError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "SettlementError";
  }
}

type LockedLot = {
  id: string;
  auctioneerId: string;
  status: string;
  endsAt: Date;
  currentBidCents: bigint | null;
};

type LockedWallet = {
  id: string;
  userId: string;
  totalCents: bigint;
  committedCents: bigint;
};

function serializeSettlement(
  settlement: {
    id: string;
    lotId: string;
    winnerId: string | null;
    amountCents: bigint | null;
    settledAt: Date;
  },
) {
  return {
    id: settlement.id,
    lotId: settlement.lotId,
    winnerId: settlement.winnerId,
    amountCents: settlement.amountCents?.toString() ?? null,
    settledAt: settlement.settledAt,
  };
}

export async function settleLot(lotId: string) {
  return prisma.$transaction(
    async (tx) => {
      // O mesmo bloqueio usado pelo motor de lances.
      // Impede que um lance e um encerramento modifiquem
      // simultaneamente o mesmo lote.
      const lots = await tx.$queryRaw<LockedLot[]>`
        SELECT
          id,
          "auctioneerId",
          status,
          "endsAt",
          "currentBidCents"
        FROM "Lot"
        WHERE id = ${lotId}
        FOR UPDATE
      `;

      const lot = lots[0];

      if (!lot) {
        throw new SettlementError(404, "Lote não encontrado.");
      }

      // Uma liquidação concluída nunca deve ser executada novamente.
      const existing = await tx.settlement.findUnique({
        where: { lotId },
      });

      if (existing) {
        return {
          settlement: serializeSettlement(existing),
          alreadySettled: true,
        };
      }

      if (lot.status === "CANCELLED") {
        throw new SettlementError(
          409,
          "Não é possível liquidar um lote cancelado.",
        );
      }

      if (lot.status === "ENDED") {
        throw new SettlementError(
          409,
          "Lote encerrado sem registro de liquidação.",
        );
      }

      const clock = await tx.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp() AS now
      `;

      const now = clock[0]?.now;

      if (!now) {
        throw new Error("Falha ao consultar o relógio do banco.");
      }

      if (now < lot.endsAt) {
        throw new SettlementError(
          409,
          "O leilão ainda não atingiu o horário de encerramento.",
        );
      }

      const winningBid = await tx.bid.findFirst({
        where: { lotId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });

      if (!winningBid) {
        if (lot.currentBidCents !== null) {
          throw new SettlementError(
            409,
            "Inconsistência entre o lote e o histórico de lances.",
          );
        }

        const settlement = await tx.settlement.create({
          data: {
            lotId,
            winnerId: null,
            amountCents: null,
          },
        });

        await tx.lot.update({
          where: { id: lotId },
          data: { status: "ENDED" },
        });

        return {
          settlement: serializeSettlement(settlement),
          alreadySettled: false,
        };
      }

      if (
        lot.currentBidCents !== winningBid.amountCents ||
        winningBid.amountCents <= 0n
      ) {
        throw new SettlementError(
          409,
          "Inconsistência no lance vencedor.",
        );
      }

      if (winningBid.bidderId === lot.auctioneerId) {
        throw new SettlementError(
          409,
          "O leiloeiro não pode ser o vencedor do próprio lote.",
        );
      }

      // Cria a carteira do leiloeiro, se ainda não existir.
      // A chave única userId evita duplicação.
      await tx.wallet.upsert({
        where: { userId: lot.auctioneerId },
        update: {},
        create: {
          userId: lot.auctioneerId,
          totalCents: 0n,
          committedCents: 0n,
        },
      });

      // Bloqueia as carteiras em ordem determinística.
      const userIds = [
        winningBid.bidderId,
        lot.auctioneerId,
      ].sort();

      const wallets: LockedWallet[] = [];

      for (const userId of userIds) {
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
          throw new SettlementError(
            409,
            "Carteira necessária para liquidação não encontrada.",
          );
        }

        wallets.push(wallet);
      }

      const winnerWallet = wallets.find(
        (wallet) => wallet.userId === winningBid.bidderId,
      );

      const auctioneerWallet = wallets.find(
        (wallet) => wallet.userId === lot.auctioneerId,
      );

      if (!winnerWallet || !auctioneerWallet) {
        throw new SettlementError(
          409,
          "Não foi possível localizar as carteiras.",
        );
      }

      const amount = winningBid.amountCents;

      if (
        winnerWallet.totalCents < amount ||
        winnerWallet.committedCents < amount
      ) {
        throw new SettlementError(
          409,
          "Saldo reservado do vencedor inconsistente.",
        );
      }

      if (auctioneerWallet.totalCents > MAX_BIGINT - amount) {
        throw new SettlementError(
          409,
          "O crédito excede o limite da carteira do leiloeiro.",
        );
      }

      await tx.wallet.update({
        where: { id: winnerWallet.id },
        data: {
          totalCents: { decrement: amount },
          committedCents: { decrement: amount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          userId: winningBid.bidderId,
          type: "AUCTION_DEBIT",
          amountCents: amount,
          lotId,
        },
      });

      await tx.wallet.update({
        where: { id: auctioneerWallet.id },
        data: {
          totalCents: { increment: amount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          userId: lot.auctioneerId,
          type: "AUCTION_CREDIT",
          amountCents: amount,
          lotId,
        },
      });

      const settlement = await tx.settlement.create({
        data: {
          lotId,
          winnerId: winningBid.bidderId,
          amountCents: amount,
        },
      });

      await tx.receipt.create({
        data: {
          lotId,
          publicToken: randomBytes(24).toString("hex"),
          winnerAlias: `Participante-${winningBid.bidderId.slice(0, 8)}`,
          amountCents: amount,
        },
      });

      await tx.lot.update({
        where: { id: lotId },
        data: { status: "ENDED" },
      });

      return {
        settlement: serializeSettlement(settlement),
        alreadySettled: false,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 15000,
    },
  );
}
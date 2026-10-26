import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

export class LotCancellationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "LotCancellationError";
  }
}

type LockedLot = {
  id: string;
  auctioneerId: string;
  status: string;
  currentBidCents: bigint | null;
};

export async function cancelLot(
  lotId: string,
  auctioneerId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      // Utiliza o mesmo bloqueio do motor de lances e da liquidação.
      const lots = await tx.$queryRaw<LockedLot[]>`
        SELECT
          id,
          "auctioneerId",
          status,
          "currentBidCents"
        FROM "Lot"
        WHERE id = ${lotId}
        FOR UPDATE
      `;

      const lot = lots[0];

      if (!lot) {
        throw new LotCancellationError(
          404,
          "Lote não encontrado.",
        );
      }

      if (lot.auctioneerId !== auctioneerId) {
        throw new LotCancellationError(
          403,
          "Você não é responsável por este lote.",
        );
      }

      if (lot.status === "CANCELLED") {
        throw new LotCancellationError(
          409,
          "Este lote já foi cancelado.",
        );
      }

      if (lot.status === "ENDED") {
        throw new LotCancellationError(
          409,
          "Não é possível cancelar um lote encerrado.",
        );
      }

      // O histórico é consultado dentro da transação, após bloquear o lote.
      const bidCount = await tx.bid.count({
        where: {
          lotId,
        },
      });

      if (bidCount > 0 || lot.currentBidCents !== null) {
        throw new LotCancellationError(
          409,
          "Não é possível cancelar um lote que já recebeu lances.",
        );
      }

      const cancelledLot = await tx.lot.update({
        where: {
          id: lotId,
        },
        data: {
          status: "CANCELLED",
        },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
        },
      });

      return {
        lot: cancelledLot,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 15000,
    },
  );
}
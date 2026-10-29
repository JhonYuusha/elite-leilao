import { prisma } from "../lib/prisma.js";
import {
  settleLot,
  SettlementError,
} from "./settlement.service.js";

export interface AutomaticSettlementResult {
  processed: number;
  settled: number;
  alreadySettled: number;
  failed: number;
}

export async function processExpiredLots(
  limit = 25,
): Promise<AutomaticSettlementResult> {
  const now = new Date();

  const expiredLots = await prisma.lot.findMany({
    where: {
      status: {
        in: ["LIVE", "SCHEDULED"],
      },
      endsAt: {
        lte: now,
      },
      settlement: null,
    },
    select: {
      id: true,
      auctioneerId: true,
    },
    orderBy: [
      { endsAt: "asc" },
      { id: "asc" },
    ],
    take: limit,
  });

  const result: AutomaticSettlementResult = {
    processed: 0,
    settled: 0,
    alreadySettled: 0,
    failed: 0,
  };

  for (const lot of expiredLots) {
    result.processed += 1;

    try {
      const settlement = await settleLot(
        lot.id,
        lot.auctioneerId,
      );

      if (settlement.alreadySettled) {
        result.alreadySettled += 1;
      } else {
        result.settled += 1;
      }
    } catch (error) {
      result.failed += 1;

      if (error instanceof SettlementError) {
        console.error(
          `[automatic-settlement] Lote ${lot.id}:`,
          error.message,
        );
      } else {
        console.error(
          `[automatic-settlement] Falha inesperada no lote ${lot.id}:`,
          error,
        );
      }
    }
  }

  return result;
}

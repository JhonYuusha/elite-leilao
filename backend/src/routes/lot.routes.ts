import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const lotRoutes = Router();

const idSchema = z.uuid();

const publicLotSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  startingBidCents: true,
  minIncrementCents: true,
  currentBidCents: true,
  startsAt: true,
  endsAt: true,
  status: true,
  createdAt: true,
} as const;

function serializeLot<T extends {
  startingBidCents: bigint;
  minIncrementCents: bigint;
  currentBidCents: bigint | null;
}>(lot: T) {
  return {
    ...lot,
    startingBidCents: lot.startingBidCents.toString(),
    minIncrementCents: lot.minIncrementCents.toString(),
    currentBidCents: lot.currentBidCents?.toString() ?? null,
  };
}

lotRoutes.get("/", async (_req, res) => {
  try {
    const lots = await prisma.lot.findMany({
      where: {
        status: { not: "CANCELLED" },
      },
      select: publicLotSelect,
      orderBy: { endsAt: "asc" },
    });

    res.json({
      lots: lots.map(serializeLot),
    });
  } catch {
    res.status(500).json({
      error: "Não foi possível consultar os lotes.",
    });
  }
});

lotRoutes.get("/:id", async (req, res) => {
  const parsed = idSchema.safeParse(req.params.id);

  if (!parsed.success) {
    res.status(400).json({
      error: "Identificador de lote inválido.",
    });
    return;
  }

  try {
    const lot = await prisma.lot.findFirst({
      where: {
        id: parsed.data,
        status: { not: "CANCELLED" },
      },
      select: publicLotSelect,
    });

    if (!lot) {
      res.status(404).json({
        error: "Lote não encontrado.",
      });
      return;
    }

    res.json({
      lot: serializeLot(lot),
    });
  } catch {
    res.status(500).json({
      error: "Não foi possível consultar o lote.",
    });
  }
});
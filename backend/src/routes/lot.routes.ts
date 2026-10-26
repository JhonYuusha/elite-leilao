import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { createLotSchema } from "../schemas/lot.schema.js";
import {
  createLot,
  ExternalProductNotFoundError,
} from "../services/lot.service.js";
import {
  cancelLot,
  LotCancellationError,
} from "../services/lot-cancellation.service.js";
import { ExternalProductServiceError } from "../services/product.service.js";

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

function serializeLot<
  T extends {
    startingBidCents: bigint;
    minIncrementCents: bigint;
    currentBidCents: bigint | null;
  },
>(lot: T) {
  return {
    ...lot,
    startingBidCents: lot.startingBidCents.toString(),
    minIncrementCents: lot.minIncrementCents.toString(),
    currentBidCents: lot.currentBidCents?.toString() ?? null,
  };
}

// GET /lots - Catálogo público de lotes
lotRoutes.get("/", async (_req, res) => {
  try {
    const lots = await prisma.lot.findMany({
      where: {
        status: { not: "CANCELLED" },
      },
      select: publicLotSelect,
      orderBy: {
        endsAt: "asc",
      },
    });

    res.status(200).json({
      lots: lots.map(serializeLot),
    });
  } catch (error) {
    console.error(
      "[GET /lots] Falha interna ao consultar lotes:",
      error,
    );

    res.status(500).json({
      error: "Não foi possível consultar os lotes.",
    });
  }
});

// GET /lots/mine - Lotes do leiloeiro autenticado
lotRoutes.get(
  "/mine",
  requireAuth,
  requireRole("AUCTIONEER"),
  async (_req, res) => {
    try {
      const auctioneerId = res.locals.auth.sub;

      const lots = await prisma.lot.findMany({
        where: {
          auctioneerId,
        },
        select: {
          ...publicLotSelect,
          settlement: {
            select: {
              id: true,
              winnerId: true,
              amountCents: true,
              settledAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.status(200).json({
        lots: lots.map((lot) => ({
          ...serializeLot(lot),
          settlement: lot.settlement
            ? {
                ...lot.settlement,
                amountCents:
                  lot.settlement.amountCents?.toString() ?? null,
              }
            : null,
        })),
      });
    } catch (error) {
      console.error(
        "[GET /lots/mine] Falha ao consultar lotes do leiloeiro:",
        error,
      );

      res.status(500).json({
        error: "Não foi possível consultar seus leilões.",
      });
    }
  },
);

// GET /lots/:id - Detalhes públicos de um lote
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

    res.status(200).json({
      lot: serializeLot(lot),
    });
  } catch (error) {
    console.error(
      "[GET /lots/:id] Falha interna ao consultar lote:",
      error,
    );

    res.status(500).json({
      error: "Não foi possível consultar o lote.",
    });
  }
});

// POST /lots - Criação de lote por leiloeiro
lotRoutes.post(
  "/",
  requireAuth,
  requireRole("AUCTIONEER"),
  async (req, res) => {
    const parsed = createLotSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Dados inválidos para criação do lote.",
        details: z.flattenError(parsed.error),
      });
      return;
    }

    try {
      const auctioneerId = res.locals.auth.sub;

      const lot = await createLot(
        auctioneerId,
        parsed.data,
      );

      res.status(201).json({
        lot,
      });
    } catch (error) {
      if (error instanceof ExternalProductNotFoundError) {
        res.status(404).json({
          error: error.message,
        });
        return;
      }

      if (
        error instanceof Error &&
        error.message === "LOT_ENDS_IN_PAST"
      ) {
        res.status(400).json({
          error: "O encerramento deve ocorrer no futuro.",
        });
        return;
      }

      if (error instanceof ExternalProductServiceError) {
        console.error(
          "[POST /lots] Falha no catálogo externo:",
          error,
        );

        res.status(502).json({
          error: "Não foi possível consultar o catálogo externo.",
        });
        return;
      }

      console.error(
        "[POST /lots] Falha interna ao criar lote:",
        error,
      );

      res.status(500).json({
        error: "Erro interno ao criar lote.",
      });
    }
  },
);

// PATCH /lots/:id/cancel - Cancelamento pelo leiloeiro responsável
lotRoutes.patch(
  "/:id/cancel",
  requireAuth,
  requireRole("AUCTIONEER"),
  async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);

    if (!parsedId.success) {
      res.status(400).json({
        error: "Identificador de lote inválido.",
      });
      return;
    }

    try {
      const result = await cancelLot(
        parsedId.data,
        res.locals.auth.sub,
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof LotCancellationError) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }

      console.error(
        "[PATCH /lots/:id/cancel] Falha ao cancelar lote:",
        error,
      );

      res.status(500).json({
        error: "Não foi possível cancelar o lote.",
      });
    }
  },
);
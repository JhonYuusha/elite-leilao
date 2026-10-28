import { Router } from "express";
import { z } from "zod";

import {
  requireAuth,
  requireRole,
} from "../middlewares/auth.js";

import {
  settleLot,
  SettlementError,
} from "../services/settlement.service.js";

export const settlementRoutes = Router();

settlementRoutes.post(
  "/:id/settle",
  requireAuth,
  requireRole("AUCTIONEER"),
  async (req, res) => {
    const parsedId = z.uuid().safeParse(req.params.id);

    if (!parsedId.success) {
      res.status(400).json({
        error: "Identificador de lote inválido.",
      });
      return;
    }

    try {
      const result = await settleLot(
        parsedId.data,
        res.locals.auth.sub,
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof SettlementError) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }

      console.error(
        "[POST /lots/:id/settle] Falha ao liquidar lote:",
        error,
      );

      res.status(500).json({
        error: "Não foi possível liquidar o lote.",
      });
    }
  },
);
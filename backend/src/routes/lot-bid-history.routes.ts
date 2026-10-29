import { Router } from "express";
import { z } from "zod";

import { getLotBidHistory } from "../services/lot-bid-history.service.js";

export const lotBidHistoryRoutes = Router();

const lotIdSchema = z.uuid();

lotBidHistoryRoutes.get(
  "/:id/bids",
  async (req, res) => {
    const parsedId = lotIdSchema.safeParse(
      req.params.id,
    );

    if (!parsedId.success) {
      res.status(400).json({
        error: "Identificador de lote inválido.",
      });
      return;
    }

    try {
      const history = await getLotBidHistory(
        parsedId.data,
      );

      if (!history) {
        res.status(404).json({
          error: "Lote não encontrado.",
        });
        return;
      }

      res.status(200).json({ history });
    } catch (error) {
      console.error(
        "[GET /lots/:id/bids] Falha ao consultar histórico:",
        error,
      );

      res.status(500).json({
        error: "Não foi possível consultar o histórico de lances.",
      });
    }
  },
);

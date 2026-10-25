import { Router } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../middlewares/auth.js";
import { createBidSchema } from "../schemas/bid.schema.js";
import { BidError, placeBid } from "../services/bid.service.js";

export const bidRoutes = Router();

bidRoutes.post(
  "/:id/bids",
  requireAuth,
  requireRole("BIDDER"),
  async (req, res) => {
    const parsedId = z.uuid().safeParse(req.params.id);

    if (!parsedId.success) {
      res.status(400).json({
        error: "Identificador de lote inválido.",
      });
      return;
    }

    const parsedBody = createBidSchema.safeParse(req.body);

    if (!parsedBody.success) {
      res.status(400).json({
        error: "Dados inválidos para o lance.",
        details: z.flattenError(parsedBody.error),
      });
      return;
    }

    try {
      const result = await placeBid(
        parsedId.data,
        res.locals.auth.sub,
        BigInt(parsedBody.data.amountCents),
      );

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof BidError) {
        res.status(error.statusCode).json({
          error: error.message,
        });
        return;
      }

      console.error("[POST /lots/:id/bids]", error);

      res.status(500).json({
        error: "Não foi possível registrar o lance.",
      });
    }
  },
);
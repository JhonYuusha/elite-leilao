import { Router } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../middlewares/auth.js";
import { publishLotUpdated } from "../realtime/socket.js";
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

    let result: Awaited<ReturnType<typeof placeBid>>;

    try {
      result = await placeBid(
        parsedId.data,
        res.locals.auth.sub,
        BigInt(parsedBody.data.amountCents),
      );
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
      return;
    }

    // A transação já foi confirmada neste ponto.
    // Uma falha de comunicação não deve desfazer o lance.
    try {
      publishLotUpdated({
        lotId: result.lot.id,
        currentBidCents: result.lot.currentBidCents,
        endsAt: new Date(result.lot.endsAt).toISOString(),
        status: result.lot.status,
        extended: result.lot.extended,
      });
    } catch (error) {
      console.error("[Socket.IO] Falha ao publicar lance:", error);
    }

    res.status(201).json(result);
  },
);
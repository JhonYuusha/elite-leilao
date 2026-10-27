import { Router } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  publishLotUpdated,
  publishWalletUpdated,
} from "../realtime/socket.js";
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

    // Este campo é interno: não faz parte da resposta HTTP.
    const { affectedWalletUserIds, ...response } = result;

    // A transação já foi confirmada neste ponto.
    // Falhas no Socket.IO não devem desfazer o lance.
    try {
      publishLotUpdated({
        lotId: response.lot.id,
        currentBidCents: response.lot.currentBidCents,
        endsAt: new Date(response.lot.endsAt).toISOString(),
        status: response.lot.status,
        extended: response.lot.extended,
      });
    } catch (error) {
      console.error("[Socket.IO] Falha ao publicar lote:", error);
    }

    try {
      publishWalletUpdated(affectedWalletUserIds);
    } catch (error) {
      console.error("[Socket.IO] Falha ao publicar carteiras:", error);
    }

    res.status(201).json(response);
  },
);
import { Router } from "express";

import {
  requireAuth,
  requireRole,
} from "../middlewares/auth.js";

import { listMyBids } from "../services/bid-history.service.js";

export const bidHistoryRoutes = Router();

bidHistoryRoutes.get(
  "/mine",
  requireAuth,
  requireRole("BIDDER"),
  async (_req, res) => {
    try {
      const bidderId = res.locals.auth.sub;

      const lots = await listMyBids(bidderId);

      res.status(200).json({ lots });
    } catch (error) {
      console.error(
        "[GET /bids/mine] Falha ao consultar arremates:",
        error,
      );

      res.status(500).json({
        error:
          "Não foi possível consultar seus arremates.",
      });
    }
  },
);

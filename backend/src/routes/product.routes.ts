
import { Router } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../middlewares/auth.js";
import { getExternalProduct } from "../services/product.service.js";

export const productRoutes = Router();

const productIdSchema = z.coerce.number().int().positive().safe();

productRoutes.get(
  "/:id",
  requireAuth,
  requireRole("AUCTIONEER"),
  async (req, res) => {
    const parsed = productIdSchema.safeParse(req.params.id);

    if (!parsed.success) {
      res.status(400).json({
        error: "Identificador de produto inválido.",
      });
      return;
    }

    try {
      const product = await getExternalProduct(parsed.data);

      if (!product) {
        res.status(404).json({
          error: "Produto não encontrado.",
        });
        return;
      }

      res.json({ product });
    } catch {
      res.status(502).json({
        error: "Não foi possível consultar o catálogo externo.",
      });
    }
  },
);
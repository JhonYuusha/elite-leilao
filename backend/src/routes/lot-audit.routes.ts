import { Router } from "express";
import { z } from "zod";

import { getPublicLotAudit } from "../services/lot-audit.service.js";

export const lotAuditRoutes = Router();

lotAuditRoutes.get("/:id/audit", async (req, res) => {
  const parsed = z.uuid().safeParse(req.params.id);

  if (!parsed.success) {
    res.status(400).json({
      error: "Identificador de lote inválido.",
    });
    return;
  }

  try {
    const audit = await getPublicLotAudit(parsed.data);

    if (!audit) {
      res.status(404).json({
        error: "Lote não encontrado.",
      });
      return;
    }

    res.status(200).json({ audit });
  } catch (error) {
    console.error(
      "[GET /lots/:id/audit] Falha na auditoria:",
      error,
    );

    res.status(500).json({
      error: "Não foi possível auditar este lote.",
    });
  }
});

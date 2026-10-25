import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

export const receiptRoutes = Router();

const tokenSchema = z.string().regex(/^[a-f0-9]{48}$/);

receiptRoutes.get("/:token", async (req, res) => {
  const parsed = tokenSchema.safeParse(req.params.token);

  if (!parsed.success) {
    res.status(400).json({
      error: "Token de comprovante inválido.",
    });
    return;
  }

  try {
    const receipt = await prisma.receipt.findUnique({
      where: {
        publicToken: parsed.data,
      },
      select: {
        id: true,
        lotId: true,
        winnerAlias: true,
        amountCents: true,
        issuedAt: true,
        lot: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!receipt) {
      res.status(404).json({
        error: "Comprovante não encontrado.",
      });
      return;
    }

    res.status(200).json({
      receipt: {
        id: receipt.id,
        lotId: receipt.lotId,
        lotTitle: receipt.lot.title,
        winnerAlias: receipt.winnerAlias,
        amountCents: receipt.amountCents.toString(),
        issuedAt: receipt.issuedAt,
      },
    });
  } catch (error) {
    console.error(
      "[GET /receipts/:token] Falha ao consultar comprovante:",
      error,
    );

    res.status(500).json({
      error: "Não foi possível consultar o comprovante.",
    });
  }
});
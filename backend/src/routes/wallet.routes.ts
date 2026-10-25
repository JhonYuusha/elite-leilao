import { Router } from "express";
import { z } from "zod";

import { requireAuth, requireRole } from "../middlewares/auth.js";
import { depositSchema } from "../schemas/wallet.schema.js";
import {
  deposit,
  getWallet,
  getWalletTransactions,
  WalletLimitError,
  WalletNotFoundError,
} from "../services/wallet.service.js";

export const walletRoutes = Router();

walletRoutes.use(requireAuth, requireRole("BIDDER"));

walletRoutes.get("/", async (_req, res) => {
  try {
    const wallet = await getWallet(res.locals.auth.sub);
    res.json({ wallet });
  } catch (error) {
    if (error instanceof WalletNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error("[GET /wallet]", error);
    res.status(500).json({
      error: "Não foi possível consultar a carteira.",
    });
  }
});

walletRoutes.post("/deposits", async (req, res) => {
  const parsed = depositSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Dados inválidos para depósito.",
      details: z.flattenError(parsed.error),
    });
    return;
  }

  try {
    const result = await deposit(
      res.locals.auth.sub,
      BigInt(parsed.data.amountCents),
    );

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof WalletNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof WalletLimitError) {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error("[POST /wallet/deposits]", error);
    res.status(500).json({
      error: "Não foi possível realizar o depósito.",
    });
  }
});

walletRoutes.get("/transactions", async (_req, res) => {
  try {
    const transactions = await getWalletTransactions(
      res.locals.auth.sub,
    );

    res.json({ transactions });
  } catch (error) {
    if (error instanceof WalletNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    console.error("[GET /wallet/transactions]", error);
    res.status(500).json({
      error: "Não foi possível consultar as transações.",
    });
  }
});
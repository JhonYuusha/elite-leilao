import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";

import { authRoutes } from "./routes/auth.routes.js";
import { lotRoutes } from "./routes/lot.routes.js";
import { productRoutes } from "./routes/product.routes.js";
import { walletRoutes } from "./routes/wallet.routes.js";
import { bidRoutes } from "./routes/bid.routes.js";
import { bidHistoryRoutes } from "./routes/bid-history.routes.js";
import { settlementRoutes } from "./routes/settlement.routes.js";
import { receiptRoutes } from "./routes/receipt.routes.js";
import { lotBidHistoryRoutes } from "./routes/lot-bid-history.routes.js";
import { lotAuditRoutes } from "./routes/lot-audit.routes.js";

export const app = express();

const proxyHopsRaw = process.env.TRUST_PROXY_HOPS ?? "0";
const proxyHops = Number(proxyHopsRaw);

if (
  !/^\d+$/.test(proxyHopsRaw) ||
  !Number.isSafeInteger(proxyHops) ||
  proxyHops > 10
) {
  throw new Error(
    "TRUST_PROXY_HOPS deve ser um inteiro entre 0 e 10.",
  );
}

app.set("trust proxy", proxyHops);

app.disable("x-powered-by");

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ??
      "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use("/auth", authRoutes);
app.use("/bids", bidHistoryRoutes);
app.use("/lots", bidRoutes);
app.use("/lots", settlementRoutes);
app.use("/lots", lotBidHistoryRoutes);
app.use("/lots", lotAuditRoutes);
app.use("/lots", lotRoutes);
app.use("/products", productRoutes);
app.use("/wallet", walletRoutes);
app.use("/receipts", receiptRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "elite-leilao-api",
  });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch {
    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});
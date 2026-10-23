import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./routes/auth.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
}));

app.use(express.json({ limit: "1mb" }));
app.use("/auth", authRoutes);

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
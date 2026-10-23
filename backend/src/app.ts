import express from "express";
import cors from "cors";

export const app = express();

app.disable("x-powered-by");

app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
}));

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "elite-leilao-api",
  });
});

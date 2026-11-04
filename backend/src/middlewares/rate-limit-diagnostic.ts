
import type { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { createLoginRateLimit } from "./login-rate-limit.js";

const limiter = createLoginRateLimit();

const authenticate: RequestHandler = (req, res, next) => {
  const enabled =
    process.env.PROXY_DIAGNOSTIC_ENABLED === "true";
  const expectedToken = process.env.PROXY_DIAGNOSTIC_TOKEN;
  const suppliedToken = req.get("X-Diagnostic-Token");

  if (!enabled || !expectedToken || !suppliedToken) {
    res.sendStatus(404);
    return;
  }

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);

  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    res.sendStatus(404);
    return;
  }

  next();
};

const rejectLogin: RequestHandler = (_req, res) => {
  res.status(401).json({
    error: "Tentativa simulada de login.",
  });
};

export const rateLimitDiagnostic = [
  authenticate,
  limiter,
  rejectLogin,
];

import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/auth.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Autenticação necessária." });
    return;
  }

  try {
    const token = authorization.slice(7);
    res.locals.auth = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado." });
  }
};

export function requireRole(
  role: "AUCTIONEER" | "BIDDER",
): RequestHandler {
  return (_req, res, next) => {
    if (res.locals.auth?.role !== role) {
      res.status(403).json({ error: "Acesso não autorizado." });
      return;
    }

    next();
  };
}
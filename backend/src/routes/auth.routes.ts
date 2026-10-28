import { Router } from "express";
import type { Request, RequestHandler } from "express";
import { z } from "zod";

import { requireAuth } from "../middlewares/auth.js";

import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "../lib/refresh-cookie.js";

import {
  getAuthenticatedUser,
  InvalidCredentialsError,
  loginUser,
  logoutUser,
  refreshUserSession,
} from "../services/auth.service.js";

import {
  InvalidRefreshSessionError,
} from "../services/session.service.js";

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function allowedFrontendOrigin(): string {
  const frontendUrl =
    process.env.FRONTEND_URL ?? "http://localhost:5173";

  return new URL(frontendUrl).origin;
}

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.origin;

  if (!origin) {
    return false;
  }

  try {
    return (
      new URL(origin).origin === allowedFrontendOrigin()
    );
  } catch {
    return false;
  }
}

/**
 * Rotas que utilizam refresh cookie exigem
 * uma origem conhecida para reduzir o risco de CSRF.
 */
const requireTrustedOrigin: RequestHandler = (
  req,
  res,
  next,
) => {
  if (!isAllowedOrigin(req)) {
    res.status(403).json({
      error: "Origem da requisição não autorizada.",
    });
    return;
  }

  next();
};

/**
 * POST /auth/login
 */
authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Dados de login inválidos.",
    });
    return;
  }

  try {
    const result = await loginUser(
      parsed.data.email,
      parsed.data.password,
    );

    setRefreshCookie(res, result.refreshToken);

    res.setHeader("Cache-Control", "no-store");

    res.json({
      accessToken: result.accessToken,
      tokenType: "Bearer",
      user: result.user,
    });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "Não foi possível autenticar.",
    });
  }
});

/**
 * POST /auth/refresh
 */
authRoutes.post(
  "/refresh",
  requireTrustedOrigin,
  async (req, res) => {
    const token = readRefreshCookie(req);

    if (!token) {
      res.status(401).json({
        error: "Sessão não encontrada.",
      });
      return;
    }

    try {
      const result = await refreshUserSession(token);

      setRefreshCookie(res, result.refreshToken);

      res.setHeader("Cache-Control", "no-store");

      res.json({
        accessToken: result.accessToken,
        tokenType: "Bearer",
        user: result.user,
      });
    } catch (error) {
      if (error instanceof InvalidRefreshSessionError) {
        clearRefreshCookie(res);

        res.status(401).json({
          error: "Sessão inválida ou expirada.",
        });
        return;
      }

      res.status(500).json({
        error: "Não foi possível renovar a sessão.",
      });
    }
  },
);

/**
 * POST /auth/logout
 */
authRoutes.post(
  "/logout",
  requireTrustedOrigin,
  async (req, res) => {
    const token = readRefreshCookie(req);

    try {
      await logoutUser(token ?? undefined);

      clearRefreshCookie(res);

      res.setHeader("Cache-Control", "no-store");

      res.status(204).send();
    } catch {
      res.status(500).json({
        error: "Não foi possível encerrar a sessão.",
      });
    }
  },
);

/**
 * GET /auth/me
 */
authRoutes.get(
  "/me",
  requireAuth,
  async (_req, res) => {
    try {
      const user = await getAuthenticatedUser(
        res.locals.auth.sub,
      );

      if (!user) {
        res.status(401).json({
          error: "Usuário não encontrado.",
        });
        return;
      }

      res.json({ user });
    } catch {
      res.status(500).json({
        error: "Não foi possível consultar o usuário.",
      });
    }
  },
);
import { Router } from "express";
import type { Request, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "../lib/refresh-cookie.js";
import {
  createRefreshSession,
  InvalidRefreshSessionError,
  revokeRefreshSession,
  rotateRefreshSession,
} from "../services/session.service.js";

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

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
    return new URL(origin).origin === allowedFrontendOrigin();
  } catch {
    return false;
  }
}

// Rotas que usam o cookie de refresh exigem uma
// origem conhecida. Isso ajuda a impedir CSRF.
const requireTrustedOrigin: RequestHandler = (req, res, next) => {
  if (!isAllowedOrigin(req)) {
    res.status(403).json({
      error: "Origem da requisição não autorizada.",
    });
    return;
  }

  next();
};

authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Dados de login inválidos.",
    });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      res.status(401).json({
        error: "Credenciais inválidas.",
      });
      return;
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
    });

    // O refresh token não aparece no JSON.
    // Ele é entregue apenas pelo cookie HttpOnly.
    const refreshToken = await createRefreshSession(user.id);

    setRefreshCookie(res, refreshToken);

    res.setHeader("Cache-Control", "no-store");

    res.json({
      accessToken,
      tokenType: "Bearer",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    res.status(500).json({
      error: "Não foi possível autenticar.",
    });
  }
});

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
      const result = await rotateRefreshSession(token);

      const accessToken = signAccessToken({
        sub: result.user.id,
        role: result.user.role,
      });

      setRefreshCookie(res, result.refreshToken);

      res.setHeader("Cache-Control", "no-store");

      res.json({
        accessToken,
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

authRoutes.post(
  "/logout",
  requireTrustedOrigin,
  async (req, res) => {
    const token = readRefreshCookie(req);

    try {
      if (token) {
        await revokeRefreshSession(token);
      }

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

authRoutes.get("/me", requireAuth, async (_req, res) => {
  const auth = res.locals.auth as {
    sub: string;
    role: "AUCTIONEER" | "BIDDER";
  };

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: USER_SELECT,
    });

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
});
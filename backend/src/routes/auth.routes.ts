import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";
import { requireAuth } from "../middlewares/auth.js";

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Dados de login inválidos." });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Credenciais inválidas." });
      return;
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
    });

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
    res.status(500).json({ error: "Não foi possível autenticar." });
  }
});

authRoutes.get("/me", requireAuth, async (_req, res) => {
  const auth = res.locals.auth as {
    sub: string;
    role: "AUCTIONEER" | "BIDDER";
  };

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    res.status(401).json({ error: "Usuário não encontrado." });
    return;
  }

  res.json({ user });
});
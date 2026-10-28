import bcrypt from "bcryptjs";

import { signAccessToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

import {
  createRefreshSession,
  revokeRefreshSession,
  rotateRefreshSession,
} from "./session.service.js";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Credenciais inválidas.");
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Autentica um usuário e cria uma sessão persistente.
 * O refresh token é devolvido apenas para a camada HTTP,
 * que o envia por cookie HttpOnly
 */
export async function loginUser(
  email: string,
  password: string,
) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (
    !user ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    throw new InvalidCredentialsError();
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
  });

  const refreshToken = await createRefreshSession(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function refreshUserSession(
  refreshToken: string,
) {
  const result = await rotateRefreshSession(refreshToken);

  const accessToken = signAccessToken({
    sub: result.user.id,
    role: result.user.role,
  });

  return {
    accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
}

/**
 * Revoga a família de sessões associada ao token.
 */
export async function logoutUser(
  refreshToken: string | undefined,
) {
  if (refreshToken) {
    await revokeRefreshSession(refreshToken);
  }
}

export async function getAuthenticatedUser(
  userId: string,
) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });
}
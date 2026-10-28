import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_SESSION_DAYS = 7;

const REFRESH_SESSION_MS =
  REFRESH_SESSION_DAYS * 24 * 60 * 60 * 1000;

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

function getExpirationDate(): Date {
  return new Date(Date.now() + REFRESH_SESSION_MS);
}

export class InvalidRefreshSessionError extends Error {
  constructor() {
    super("Sessão inválida, expirada ou revogada.");
    this.name = "InvalidRefreshSessionError";
  }
}

export async function createRefreshSession(
  userId: string,
): Promise<string> {
  const token = generateRefreshToken();

  await prisma.refreshSession.create({
    data: {
      userId,
      familyId: randomUUID(),
      tokenHash: hashToken(token),
      expiresAt: getExpirationDate(),
    },
  });

  return token;
}

export async function rotateRefreshSession(
  token: string,
): Promise<{
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "AUCTIONEER" | "BIDDER";
  };
}> {
  const currentHash = hashToken(token);
  const nextToken = generateRefreshToken();

  const existing = await prisma.refreshSession.findUnique({
    where: { tokenHash: currentHash },
    select: { familyId: true },
  });

  if (!existing) {
    throw new InvalidRefreshSessionError();
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // Bloqueia operações concorrentes da mesma família
    // durante esta transação PostgreSQL.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${existing.familyId}, 0)
      )::text
    `;

    const now = new Date();

    const session = await tx.refreshSession.findUnique({
      where: { tokenHash: currentHash },
      include: {
        user: {
          select: USER_SELECT,
        },
      },
    });

    if (!session) {
      return { kind: "invalid" as const };
    }

    if (session.revokedAt || session.expiresAt <= now) {
      return { kind: "invalid" as const };
    }

    if (session.usedAt) {
      // Reutilização detectada: revoga a família inteira.
      await tx.refreshSession.updateMany({
        where: {
          familyId: session.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      return { kind: "reused" as const };
    }

    const nextSessionId = randomUUID();

    // Cria primeiro a sessão substituta para satisfazer
    // a relação de chave estrangeira replacedById.
    await tx.refreshSession.create({
      data: {
        id: nextSessionId,
        userId: session.userId,
        familyId: session.familyId,
        tokenHash: hashToken(nextToken),
        expiresAt: getExpirationDate(),
      },
    });

    // Marca o token anterior como utilizado.
    await tx.refreshSession.update({
      where: { id: session.id },
      data: {
        usedAt: now,
        replacedById: nextSessionId,
      },
    });

    return {
      kind: "rotated" as const,
      refreshToken: nextToken,
      user: session.user,
    };
  });

  if (outcome.kind !== "rotated") {
    throw new InvalidRefreshSessionError();
  }

  return {
    refreshToken: outcome.refreshToken,
    user: outcome.user,
  };
}

export async function revokeRefreshSession(
  token: string,
): Promise<void> {
  const currentHash = hashToken(token);

  const existing = await prisma.refreshSession.findUnique({
    where: { tokenHash: currentHash },
    select: { familyId: true },
  });

  if (!existing) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${existing.familyId}, 0)
      )::text
    `;

    await tx.refreshSession.updateMany({
      where: {
        familyId: existing.familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  });
}

export const refreshSessionConfig = {
  durationMs: REFRESH_SESSION_MS,
} as const;
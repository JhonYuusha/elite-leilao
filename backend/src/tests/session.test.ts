import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../lib/prisma.js";
import {
  createRefreshSession,
  InvalidRefreshSessionError,
  revokeRefreshSession,
  rotateRefreshSession,
} from "../services/session.service.js";

const TEST_EMAIL = `session-test-${randomUUID()}@demo.local`;

let userId: string;

async function getSession(token: string) {
  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  return prisma.refreshSession.findUnique({
    where: { tokenHash },
  });
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: "Teste de Sessões",
      email: TEST_EMAIL,
      passwordHash: "test-only",
      role: "BIDDER",
    },
  });

  userId = user.id;
});

afterAll(async () => {
  if (userId) {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  await prisma.$disconnect();
});

describe("Sessões persistentes", () => {
  it("cria um token aleatório e armazena apenas o hash", async () => {
    const token = await createRefreshSession(userId);
    const session = await getSession(token);

    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThanOrEqual(40);

    expect(session).not.toBeNull();
    expect(session?.userId).toBe(userId);
    expect(session?.tokenHash).not.toBe(token);
    expect(session?.revokedAt).toBeNull();
    expect(session?.usedAt).toBeNull();
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("renova uma sessão e invalida o token anterior", async () => {
    const originalToken = await createRefreshSession(userId);
    const originalSession = await getSession(originalToken);

    const result = await rotateRefreshSession(originalToken);

    expect(result.refreshToken).not.toBe(originalToken);
    expect(result.user.id).toBe(userId);
    expect(result.user.role).toBe("BIDDER");

    const previousSession = await getSession(originalToken);
    const nextSession = await getSession(result.refreshToken);

    expect(previousSession?.usedAt).not.toBeNull();
    expect(previousSession?.replacedById).toBe(nextSession?.id);
    expect(nextSession?.familyId).toBe(originalSession?.familyId);

    await expect(
      rotateRefreshSession(originalToken),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  it("revoga a família ao detectar reutilização", async () => {
    const originalToken = await createRefreshSession(userId);

    const rotated = await rotateRefreshSession(originalToken);

    await expect(
      rotateRefreshSession(originalToken),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError);

    const activeSession = await getSession(rotated.refreshToken);

    expect(activeSession?.revokedAt).not.toBeNull();

    await expect(
      rotateRefreshSession(rotated.refreshToken),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  it("impede renovação de sessão expirada", async () => {
    const token = await createRefreshSession(userId);
    const session = await getSession(token);

    if (!session) {
      throw new Error("Sessão de teste não encontrada.");
    }

    await prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    await expect(
      rotateRefreshSession(token),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  it("revoga uma sessão no logout", async () => {
    const token = await createRefreshSession(userId);

    await revokeRefreshSession(token);

    const session = await getSession(token);

    expect(session?.revokedAt).not.toBeNull();

    await expect(
      rotateRefreshSession(token),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  it("impede duas renovações bem-sucedidas com o mesmo token", async () => {
    const token = await createRefreshSession(userId);

    const results = await Promise.allSettled([
      rotateRefreshSession(token),
      rotateRefreshSession(token),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );

    const rejected = results.filter(
      (result) => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("revoga a sessão vencedora quando o token antigo é reutilizado", async () => {
    const token = await createRefreshSession(userId);

    const results = await Promise.allSettled([
      rotateRefreshSession(token),
      rotateRefreshSession(token),
    ]);

    const successful = results.find(
      (result) => result.status === "fulfilled",
    );

    const failed = results.find(
      (result) => result.status === "rejected",
    );

    expect(successful?.status).toBe("fulfilled");
    expect(failed?.status).toBe("rejected");

    if (successful?.status !== "fulfilled") {
      throw new Error("Nenhuma renovação foi concluída.");
    }

    const winningSession = await getSession(
      successful.value.refreshToken,
    );

    // A política atual revoga a família após reutilização.
    expect(winningSession?.revokedAt).not.toBeNull();

    await expect(
      rotateRefreshSession(successful.value.refreshToken),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  it("não deixa sessão utilizável após logout concorrente", async () => {
    const token = await createRefreshSession(userId);

    const results = await Promise.allSettled([
      rotateRefreshSession(token),
      revokeRefreshSession(token),
    ]);

    const rotated = results[0];
    const logout = results[1];

    expect(logout.status).toBe("fulfilled");

    if (rotated.status === "fulfilled") {
      const nextSession = await getSession(
        rotated.value.refreshToken,
      );

      expect(nextSession).not.toBeNull();
      expect(nextSession?.revokedAt).not.toBeNull();

      await expect(
        rotateRefreshSession(rotated.value.refreshToken),
      ).rejects.toBeInstanceOf(InvalidRefreshSessionError);
    } else {
      const originalSession = await getSession(token);

      expect(originalSession?.revokedAt).not.toBeNull();
    }
  });
});
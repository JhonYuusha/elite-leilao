import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";

const EMAIL = `auth-refresh-${randomUUID()}@demo.local`;
const PASSWORD = "Teste@123456";
const FRONTEND_ORIGIN =
  new URL(process.env.FRONTEND_URL ?? "http://localhost:5173").origin;

let userId: string;

function getRefreshCookie(
  response: { headers: Record<string, unknown> },
): string {
  const header = response.headers["set-cookie"];

  const cookies = Array.isArray(header)
    ? header.map(String)
    : typeof header === "string"
      ? [header]
      : [];

  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith("aureo_refresh_token="),
  );

  if (!refreshCookie) {
    throw new Error("Cookie de refresh não encontrado.");
  }

  return refreshCookie.split(";")[0];
}

async function login() {
  return request(app)
    .post("/auth/login")
    .set("Origin", FRONTEND_ORIGIN)
    .send({
      email: EMAIL,
      password: PASSWORD,
    });
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      name: "Teste HTTP de Sessão",
      email: EMAIL,
      passwordHash,
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

describe("Autenticação HTTP com refresh cookie", () => {
  it("cria cookie HttpOnly no login sem expor refresh token no JSON", async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(
      expect.any(String),
    );
    expect(response.body.tokenType).toBe("Bearer");
    expect(response.body.user.email).toBe(EMAIL);
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("no-store");

    const cookieHeader = response.headers["set-cookie"];
    const cookies = Array.isArray(cookieHeader)
      ? cookieHeader.map(String)
      : typeof cookieHeader === "string"
        ? [cookieHeader]
        : [];

    const cookie = cookies.find((value) =>
      value.startsWith("aureo_refresh_token="),
    );

    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/auth");
  });

  it("renova o access token e rotaciona o refresh cookie", async () => {
    const firstLogin = await login();
    expect(firstLogin.status).toBe(200);

    const originalCookie = getRefreshCookie(firstLogin);

    const response = await request(app)
      .post("/auth/refresh")
      .set("Origin", FRONTEND_ORIGIN)
      .set("Cookie", originalCookie);

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(
      expect.any(String),
    );
    expect(response.body.user.id).toBe(userId);
    expect(response.body.refreshToken).toBeUndefined();

    const rotatedCookie = getRefreshCookie(response);

    expect(rotatedCookie).not.toBe(originalCookie);

    const me = await request(app)
      .get("/auth/me")
      .set(
        "Authorization",
        `Bearer ${response.body.accessToken}`,
      );

    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(userId);
  });

  it("rejeita refresh sem cookie", async () => {
    const response = await request(app)
      .post("/auth/refresh")
      .set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(401);
  });

  it("rejeita refresh de origem não autorizada", async () => {
    const firstLogin = await login();
    expect(firstLogin.status).toBe(200);

    const response = await request(app)
      .post("/auth/refresh")
      .set("Origin", "https://origem-nao-autorizada.example")
      .set("Cookie", getRefreshCookie(firstLogin));

    expect(response.status).toBe(403);
  });

  it("rejeita refresh sem cabeçalho Origin", async () => {
    const firstLogin = await login();
    expect(firstLogin.status).toBe(200);

    const response = await request(app)
      .post("/auth/refresh")
      .set("Cookie", getRefreshCookie(firstLogin));

    expect(response.status).toBe(403);
  });

  it("revoga a sessão e limpa o cookie no logout", async () => {
    const firstLogin = await login();
    expect(firstLogin.status).toBe(200);

    const cookie = getRefreshCookie(firstLogin);

    const logout = await request(app)
      .post("/auth/logout")
      .set("Origin", FRONTEND_ORIGIN)
      .set("Cookie", cookie);

    expect(logout.status).toBe(204);

    const clearedCookie = logout.headers["set-cookie"];
    const clearedCookies = Array.isArray(clearedCookie)
      ? clearedCookie.map(String)
      : typeof clearedCookie === "string"
        ? [clearedCookie]
        : [];

    expect(
      clearedCookies.some(
        (value) =>
          value.startsWith("aureo_refresh_token=") &&
          value.includes("Path=/auth") &&
          value.includes("Expires="),
      ),
    ).toBe(true);

    const refresh = await request(app)
      .post("/auth/refresh")
      .set("Origin", FRONTEND_ORIGIN)
      .set("Cookie", cookie);

    expect(refresh.status).toBe(401);
  });

  it("detecta reutilização de refresh token antigo", async () => {
    const firstLogin = await login();
    expect(firstLogin.status).toBe(200);

    const originalCookie = getRefreshCookie(firstLogin);

    const firstRefresh = await request(app)
      .post("/auth/refresh")
      .set("Origin", FRONTEND_ORIGIN)
      .set("Cookie", originalCookie);

    expect(firstRefresh.status).toBe(200);

    const rotatedCookie = getRefreshCookie(firstRefresh);

    const replay = await request(app)
      .post("/auth/refresh")
      .set("Origin", FRONTEND_ORIGIN)
      .set("Cookie", originalCookie);

    expect(replay.status).toBe(401);

    const afterReplay = await request(app)
      .post("/auth/refresh")
      .set("Origin", FRONTEND_ORIGIN)
      .set("Cookie", rotatedCookie);

    expect(afterReplay.status).toBe(401);
  });

  it("não permite logout com origem não autorizada", async () => {
    const firstLogin = await login();
    expect(firstLogin.status).toBe(200);

    const cookie = getRefreshCookie(firstLogin);

    const response = await request(app)
      .post("/auth/logout")
      .set("Origin", "https://origem-nao-autorizada.example")
      .set("Cookie", cookie);

    expect(response.status).toBe(403);

    // A tentativa bloqueada não deve revogar a sessão.
    const refresh = await request(app)
      .post("/auth/refresh")
      .set("Origin", FRONTEND_ORIGIN)
      .set("Cookie", cookie);

    expect(refresh.status).toBe(200);
  });
});
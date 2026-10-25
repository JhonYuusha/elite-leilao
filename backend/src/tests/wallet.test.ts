import "dotenv/config";

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";

describe("Carteira financeira", () => {
  const userId = randomUUID();
  const email = `wallet-test-${userId}@example.com`;

  let bidderToken: string;
  let auctioneerToken: string;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        name: "Participante de Teste",
        email,
        passwordHash: "usuario-sem-login-por-senha",
        role: "BIDDER",
        wallet: {
          create: {
            totalCents: 0n,
            committedCents: 0n,
          },
        },
      },
    });

    bidderToken = signAccessToken({
      sub: userId,
      role: "BIDDER",
    });

    auctioneerToken = signAccessToken({
      sub: userId,
      role: "AUCTIONEER",
    });
  });

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({
      where: { userId },
    });

    await prisma.wallet.deleteMany({
      where: { userId },
    });

    await prisma.user.deleteMany({
      where: { id: userId },
    });
  });

  it("deve rejeitar consulta sem autenticação", async () => {
    const response = await request(app).get("/wallet");

    expect(response.status).toBe(401);
  });

  it("deve impedir acesso com papel de leiloeiro", async () => {
    const response = await request(app)
      .get("/wallet")
      .set("Authorization", `Bearer ${auctioneerToken}`);

    expect(response.status).toBe(403);
  });

  it("deve iniciar com saldo zerado", async () => {
    const response = await request(app)
      .get("/wallet")
      .set("Authorization", `Bearer ${bidderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.wallet).toEqual({
      totalCents: "0",
      committedCents: "0",
      availableCents: "0",
    });
  });

  it.each(["0", "-100", "1.50", "abc"])(
    "deve rejeitar depósito inválido: %s",
    async (amountCents) => {
      const response = await request(app)
        .post("/wallet/deposits")
        .set("Authorization", `Bearer ${bidderToken}`)
        .send({ amountCents });

      expect(response.status).toBe(400);
    },
  );

  it("deve registrar um depósito e atualizar o saldo", async () => {
    const response = await request(app)
      .post("/wallet/deposits")
      .set("Authorization", `Bearer ${bidderToken}`)
      .send({ amountCents: "50000" });

    expect(response.status).toBe(201);

    expect(response.body.wallet).toEqual({
      totalCents: "50000",
      committedCents: "0",
      availableCents: "50000",
    });

    expect(response.body.transaction).toMatchObject({
      type: "DEPOSIT",
      amountCents: "50000",
    });

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    expect(wallet?.totalCents).toBe(50000n);

    const transactions = await prisma.walletTransaction.findMany({
      where: { userId },
    });

    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.amountCents).toBe(50000n);
  });

  it("deve preservar depósitos simultâneos", async () => {
    const responses = await Promise.all([
      request(app)
        .post("/wallet/deposits")
        .set("Authorization", `Bearer ${bidderToken}`)
        .send({ amountCents: "1000" }),

      request(app)
        .post("/wallet/deposits")
        .set("Authorization", `Bearer ${bidderToken}`)
        .send({ amountCents: "2000" }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      201,
      201,
    ]);

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    expect(wallet?.totalCents).toBe(53000n);
  });

  it("deve listar o histórico financeiro", async () => {
    const response = await request(app)
      .get("/wallet/transactions")
      .set("Authorization", `Bearer ${bidderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.transactions).toHaveLength(3);

    for (const transaction of response.body.transactions) {
      expect(transaction.type).toBe("DEPOSIT");
      expect(transaction.amountCents).toEqual(expect.any(String));
      expect(transaction.id).toEqual(expect.any(String));
    }
  });

  it("deve rejeitar depósito acima do limite BIGINT", async () => {
    const response = await request(app)
      .post("/wallet/deposits")
      .set("Authorization", `Bearer ${bidderToken}`)
      .send({
        amountCents: "9223372036854775807",
      });

    expect(response.status).toBe(400);

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    expect(wallet?.totalCents).toBe(53000n);
  });
});
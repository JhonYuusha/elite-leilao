import "dotenv/config";

import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("GET /receipts/:token - Comprovantes públicos", () => {
  const auctioneerId = randomUUID();
  const lotId = randomUUID();
  const receiptId = randomUUID();
  const publicToken = randomBytes(24).toString("hex");
  const winnerAlias = "Participante-anonimo";

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: auctioneerId,
        name: "Leiloeiro Comprovantes",
        email: `receipt-${auctioneerId}@example.com`,
        passwordHash: "test",
        role: "AUCTIONEER",
      },
    });

    await prisma.lot.create({
      data: {
        id: lotId,
        auctioneerId,
        title: "Relógio de Teste",
        description: "Lote utilizado nos testes de comprovantes.",
        sourceApi: "test",
        sourceItemId: randomUUID(),
        itemSnapshot: { title: "Relógio de Teste" },
        startingBidCents: 10000n,
        minIncrementCents: 1000n,
        currentBidCents: 15000n,
        startsAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() - 60_000),
        status: "ENDED",
      },
    });

    await prisma.receipt.create({
      data: {
        id: receiptId,
        lotId,
        publicToken,
        winnerAlias,
        amountCents: 15000n,
      },
    });
  });

  afterAll(async () => {
    await prisma.receipt.deleteMany({
      where: { lotId },
    });

    await prisma.lot.deleteMany({
      where: { id: lotId },
    });

    await prisma.user.deleteMany({
      where: { id: auctioneerId },
    });
  });

  it("deve permitir consulta sem autenticação", async () => {
    const response = await request(app).get(
      `/receipts/${publicToken}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.receipt.id).toBe(receiptId);
  });

  it("deve retornar os dados públicos do comprovante", async () => {
    const response = await request(app).get(
      `/receipts/${publicToken}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.receipt).toEqual({
      id: receiptId,
      lotId,
      lotTitle: "Relógio de Teste",
      winnerAlias,
      amountCents: "15000",
      issuedAt: expect.any(String),
    });

    expect(
      new Date(response.body.receipt.issuedAt).getTime(),
    ).not.toBeNaN();
  });

  it("não deve expor dados privados", async () => {
    const response = await request(app).get(
      `/receipts/${publicToken}`,
    );

    expect(response.status).toBe(200);

    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain(auctioneerId);
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("winnerId");
    expect(serialized).not.toContain("bidderId");
    expect(serialized).not.toContain("publicToken");
    expect(serialized).not.toContain("receipt-");
  });

  it("deve rejeitar token inválido", async () => {
    const response = await request(app).get(
      "/receipts/token-invalido",
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Token de comprovante inválido.",
    );
  });

  it("deve retornar 404 para token válido inexistente", async () => {
    const unknownToken = randomBytes(24).toString("hex");

    const response = await request(app).get(
      `/receipts/${unknownToken}`,
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toBe(
      "Comprovante não encontrado.",
    );
  });
});
import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";

import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";

describe("Motor de lances", () => {
  const auctioneerId = randomUUID();
  const bidderAId = randomUUID();
  const bidderBId = randomUUID();

  const tokenA = signAccessToken({
    sub: bidderAId,
    role: "BIDDER",
  });

  const tokenB = signAccessToken({
    sub: bidderBId,
    role: "BIDDER",
  });

  const auctioneerToken = signAccessToken({
    sub: auctioneerId,
    role: "AUCTIONEER",
  });

  const lotIds: string[] = [];

  async function createTestLot(
    options: {
      startingBidCents?: bigint;
      minIncrementCents?: bigint;
      startsAt?: Date;
      endsAt?: Date;
    } = {},
  ) {
    const now = Date.now();

    const lot = await prisma.lot.create({
      data: {
        auctioneerId,
        title: "Lote de Teste",
        description: "Lote criado para testes automatizados.",
        sourceApi: "test",
        sourceItemId: randomUUID(),
        itemSnapshot: {
          title: "Lote de Teste",
        },
        startingBidCents: options.startingBidCents ?? 10000n,
        minIncrementCents: options.minIncrementCents ?? 1000n,
        startsAt:
          options.startsAt ??
          new Date(now - 60_000),
        endsAt:
          options.endsAt ??
          new Date(now + 3_600_000),
        status: "LIVE",
      },
    });

    lotIds.push(lot.id);

    return lot;
  }

  async function sendBid(
    lotId: string,
    token: string,
    amountCents: string,
  ) {
    return request(app)
      .post(`/lots/${lotId}/bids`)
      .set("Authorization", `Bearer ${token}`)
      .send({ amountCents });
  }

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: auctioneerId,
          name: "Leiloeiro Teste",
          email: `auctioneer-${auctioneerId}@example.com`,
          passwordHash: "test",
          role: "AUCTIONEER",
        },
        {
          id: bidderAId,
          name: "Participante A",
          email: `bidder-${bidderAId}@example.com`,
          passwordHash: "test",
          role: "BIDDER",
        },
        {
          id: bidderBId,
          name: "Participante B",
          email: `bidder-${bidderBId}@example.com`,
          passwordHash: "test",
          role: "BIDDER",
        },
      ],
    });

    await prisma.wallet.createMany({
      data: [
        {
          userId: bidderAId,
          totalCents: 100000n,
          committedCents: 0n,
        },
        {
          userId: bidderBId,
          totalCents: 100000n,
          committedCents: 0n,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({
      where: {
        userId: { in: [bidderAId, bidderBId] },
      },
    });

    await prisma.bid.deleteMany({
      where: { lotId: { in: lotIds } },
    });

    await prisma.lot.deleteMany({
      where: { id: { in: lotIds } },
    });

    await prisma.wallet.deleteMany({
      where: {
        userId: { in: [bidderAId, bidderBId] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [auctioneerId, bidderAId, bidderBId],
        },
      },
    });
  });

  it("deve rejeitar lance sem autenticação", async () => {
    const lot = await createTestLot();

    const response = await request(app)
      .post(`/lots/${lot.id}/bids`)
      .send({ amountCents: "10000" });

    expect(response.status).toBe(401);
  });

  it("deve impedir que leiloeiros façam lances", async () => {
    const lot = await createTestLot();

    const response = await sendBid(
      lot.id,
      auctioneerToken,
      "10000",
    );

    expect(response.status).toBe(403);
  });

  it("deve registrar o primeiro lance e reservar saldo", async () => {
    const lot = await createTestLot();

    const response = await sendBid(
      lot.id,
      tokenA,
      "10000",
    );

    expect(response.status).toBe(201);
    expect(response.body.bid.amountCents).toBe("10000");
    expect(response.body.bid.previousHash).toBeNull();

    const savedLot = await prisma.lot.findUnique({
      where: { id: lot.id },
    });

    expect(savedLot?.currentBidCents).toBe(10000n);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: bidderAId },
    });

    expect(wallet?.committedCents).toBeGreaterThanOrEqual(10000n);

    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        userId: bidderAId,
        lotId: lot.id,
        type: "BID_COMMIT",
      },
    });

    expect(transaction?.amountCents).toBe(10000n);
  });

  it("deve rejeitar lance abaixo do mínimo", async () => {
    const lot = await createTestLot();

    const response = await sendBid(
      lot.id,
      tokenA,
      "9999",
    );

    expect(response.status).toBe(409);
  });

  it("deve rejeitar lance superior ao saldo disponível", async () => {
    const lot = await createTestLot();

    const response = await sendBid(
      lot.id,
      tokenB,
      "999999",
    );

    expect(response.status).toBe(409);
  });

  it("deve liberar a reserva do líder anterior", async () => {
    const lot = await createTestLot();

    const first = await sendBid(lot.id, tokenA, "10000");
    expect(first.status).toBe(201);

    const before = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bidderAId },
    });

    const second = await sendBid(lot.id, tokenB, "11000");
    expect(second.status).toBe(201);

    const after = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bidderAId },
    });

    expect(after.committedCents).toBe(
      before.committedCents - 10000n,
    );

    const release = await prisma.walletTransaction.findFirst({
      where: {
        userId: bidderAId,
        lotId: lot.id,
        type: "BID_RELEASE",
      },
    });

    expect(release?.amountCents).toBe(10000n);

    expect(second.body.bid.previousHash).toBe(
      first.body.bid.hash,
    );
  });

  it("deve impedir lance do líder atual", async () => {
    const lot = await createTestLot();

    const first = await sendBid(lot.id, tokenA, "10000");
    expect(first.status).toBe(201);

    const second = await sendBid(lot.id, tokenA, "11000");
    expect(second.status).toBe(409);
  });

  it("deve produzir hashes HMAC-SHA256 v2 verificáveis e encadeados", async () => {
    const secret = process.env.BID_AUDIT_HMAC_KEY;

    expect(secret).toBeDefined();
    expect(secret?.length).toBeGreaterThanOrEqual(32);

    if (!secret) {
      throw new Error("Chave HMAC de testes não configurada.");
    }

    const lot = await createTestLot();

    const firstResponse = await sendBid(
      lot.id,
      tokenB,
      "10000",
    );

    expect(firstResponse.status).toBe(201);

    const firstBid = await prisma.bid.findFirstOrThrow({
      where: { lotId: lot.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    expect(firstBid.hashVersion).toBe(2);
    expect(firstBid.previousHash).toBeNull();

    const firstPayload = JSON.stringify({
      lotId: firstBid.lotId,
      bidderId: firstBid.bidderId,
      amountCents: firstBid.amountCents.toString(),
      acceptedAt: firstBid.createdAt.toISOString(),
      previousHash: firstBid.previousHash,
    });

    const expectedFirstHash = createHmac("sha256", secret)
      .update(`aureo:bid:v2:${firstPayload}`)
      .digest("hex");

    expect(firstBid.hash).toBe(expectedFirstHash);
    expect(firstResponse.body.bid.hash).toBe(firstBid.hash);

    const secondResponse = await sendBid(
      lot.id,
      tokenA,
      "11000",
    );

    expect(secondResponse.status).toBe(201);

    const secondBid = await prisma.bid.findFirstOrThrow({
      where: {
        lotId: lot.id,
        bidderId: bidderAId,
      },
    });

    expect(secondBid.hashVersion).toBe(2);
    expect(secondBid.previousHash).toBe(firstBid.hash);

    const secondPayload = JSON.stringify({
      lotId: secondBid.lotId,
      bidderId: secondBid.bidderId,
      amountCents: secondBid.amountCents.toString(),
      acceptedAt: secondBid.createdAt.toISOString(),
      previousHash: secondBid.previousHash,
    });

    const expectedSecondHash = createHmac("sha256", secret)
      .update(`aureo:bid:v2:${secondPayload}`)
      .digest("hex");

    expect(secondBid.hash).toBe(expectedSecondHash);
    expect(secondResponse.body.bid.hash).toBe(secondBid.hash);
    expect(secondResponse.body.bid.previousHash).toBe(
      firstBid.hash,
    );
  });

  it("deve prorrogar lote nos últimos dois minutos", async () => {
    const lot = await createTestLot({
      endsAt: new Date(Date.now() + 90_000),
    });

    const response = await sendBid(
      lot.id,
      tokenA,
      "10000",
    );

    expect(response.status).toBe(201);
    expect(response.body.lot.extended).toBe(true);

    const bidTime = new Date(
      response.body.bid.createdAt,
    ).getTime();

    const newEnd = new Date(
      response.body.lot.endsAt,
    ).getTime();

    expect(newEnd - bidTime).toBe(120_000);
  });

  it("deve rejeitar lance em lote encerrado", async () => {
    const lot = await createTestLot({
      endsAt: new Date(Date.now() - 60_000),
    });

    const response = await sendBid(
      lot.id,
      tokenA,
      "10000",
    );

    expect(response.status).toBe(409);
  });

  it("deve serializar lances simultâneos no mesmo lote", async () => {
    const lot = await createTestLot();

    const responses = await Promise.all([
      sendBid(lot.id, tokenA, "10000"),
      sendBid(lot.id, tokenB, "10000"),
    ]);

    const statuses = responses
      .map((response) => response.status)
      .sort();

    expect(statuses).toEqual([201, 409]);

    const bids = await prisma.bid.findMany({
      where: { lotId: lot.id },
    });

    expect(bids).toHaveLength(1);
  });

  it("não deve permitir reservas simultâneas acima do saldo em lotes diferentes", async () => {
    const lotA = await createTestLot();
    const lotB = await createTestLot();

    const userId = randomUUID();
    const token = signAccessToken({
      sub: userId,
      role: "BIDDER",
    });

    await prisma.user.create({
      data: {
        id: userId,
        name: "Participante Concorrência",
        email: `concurrency-${userId}@example.com`,
        passwordHash: "test",
        role: "BIDDER",
        wallet: {
          create: {
            totalCents: 100000n,
            committedCents: 0n,
          },
        },
      },
    });

    try {
      const responses = await Promise.all([
        sendBid(lotA.id, token, "80000"),
        sendBid(lotB.id, token, "80000"),
      ]);

      const statuses = responses
        .map((response) => response.status)
        .sort();

      expect(statuses).toEqual([201, 409]);

      const wallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId },
      });

      expect(wallet.totalCents).toBe(100000n);
      expect(wallet.committedCents).toBe(80000n);

      const bids = await prisma.bid.findMany({
        where: {
          bidderId: userId,
          lotId: { in: [lotA.id, lotB.id] },
        },
      });

      expect(bids).toHaveLength(1);

      const transactions =
        await prisma.walletTransaction.findMany({
          where: {
            userId,
            type: "BID_COMMIT",
          },
        });

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.amountCents).toBe(80000n);
    } finally {
      await prisma.walletTransaction.deleteMany({
        where: { userId },
      });

      await prisma.bid.deleteMany({
        where: { bidderId: userId },
      });

      await prisma.wallet.deleteMany({
        where: { userId },
      });

      await prisma.user.delete({
        where: { id: userId },
      });
    }
  });
});
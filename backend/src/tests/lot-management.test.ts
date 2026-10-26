import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";

describe("GET /lots/mine - Gerenciamento de lotes", () => {
  const auctioneerId = randomUUID();
  const otherAuctioneerId = randomUUID();
  const bidderId = randomUUID();

  const auctioneerToken = signAccessToken({
    sub: auctioneerId,
    role: "AUCTIONEER",
  });

  const otherAuctioneerToken = signAccessToken({
    sub: otherAuctioneerId,
    role: "AUCTIONEER",
  });

  const bidderToken = signAccessToken({
    sub: bidderId,
    role: "BIDDER",
  });

  const lotIds: string[] = [];

  let scheduledLotId: string;
  let cancelledLotId: string;
  let settledLotId: string;
  let otherAuctioneerLotId: string;

  async function createTestLot(
    ownerId: string,
    status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED",
  ) {
    const now = Date.now();

    const lot = await prisma.lot.create({
      data: {
        auctioneerId: ownerId,
        title: `Lote de teste ${status}`,
        description: "Teste de gerenciamento administrativo.",
        sourceApi: "test",
        sourceItemId: randomUUID(),
        itemSnapshot: {
          origin: "test",
        },
        startingBidCents: 15000n,
        minIncrementCents: 1000n,
        currentBidCents: null,
        startsAt: new Date(now + 60_000),
        endsAt: new Date(now + 3_600_000),
        status,
      },
    });

    lotIds.push(lot.id);

    return lot;
  }

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: auctioneerId,
          name: "Leiloeiro de Teste",
          email: `management-a-${auctioneerId}@example.com`,
          passwordHash: "test",
          role: "AUCTIONEER",
        },
        {
          id: otherAuctioneerId,
          name: "Outro Leiloeiro",
          email: `management-b-${otherAuctioneerId}@example.com`,
          passwordHash: "test",
          role: "AUCTIONEER",
        },
        {
          id: bidderId,
          name: "Participante de Teste",
          email: `management-bidder-${bidderId}@example.com`,
          passwordHash: "test",
          role: "BIDDER",
        },
      ],
    });

    const scheduledLot = await createTestLot(
      auctioneerId,
      "SCHEDULED",
    );

    const cancelledLot = await createTestLot(
      auctioneerId,
      "CANCELLED",
    );

    const settledLot = await createTestLot(
      auctioneerId,
      "ENDED",
    );

    const otherAuctioneerLot = await createTestLot(
      otherAuctioneerId,
      "LIVE",
    );

    scheduledLotId = scheduledLot.id;
    cancelledLotId = cancelledLot.id;
    settledLotId = settledLot.id;
    otherAuctioneerLotId = otherAuctioneerLot.id;

    await prisma.settlement.create({
      data: {
        lotId: settledLotId,
        winnerId: bidderId,
        amountCents: 25000n,
      },
    });
  });

  afterAll(async () => {
    await prisma.settlement.deleteMany({
      where: {
        lotId: {
          in: lotIds,
        },
      },
    });

    await prisma.lot.deleteMany({
      where: {
        id: {
          in: lotIds,
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [auctioneerId, otherAuctioneerId, bidderId],
        },
      },
    });
  });

  it("deve rejeitar visitantes sem autenticação", async () => {
    const response = await request(app).get("/lots/mine");

    expect(response.status).toBe(401);
  });

  it("deve impedir acesso de participantes", async () => {
    const response = await request(app)
      .get("/lots/mine")
      .set("Authorization", `Bearer ${bidderToken}`);

    expect(response.status).toBe(403);
  });

  it("deve listar somente os lotes do leiloeiro autenticado", async () => {
    const response = await request(app)
      .get("/lots/mine")
      .set("Authorization", `Bearer ${auctioneerToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.lots)).toBe(true);

    const ids = response.body.lots.map(
      (lot: { id: string }) => lot.id,
    );

    expect(ids).toContain(scheduledLotId);
    expect(ids).toContain(cancelledLotId);
    expect(ids).toContain(settledLotId);
    expect(ids).not.toContain(otherAuctioneerLotId);
  });

  it("deve manter lotes cancelados no histórico administrativo", async () => {
    const response = await request(app)
      .get("/lots/mine")
      .set("Authorization", `Bearer ${auctioneerToken}`);

    expect(response.status).toBe(200);

    const cancelledLot = response.body.lots.find(
      (lot: { id: string }) => lot.id === cancelledLotId,
    );

    expect(cancelledLot).toBeDefined();
    expect(cancelledLot.status).toBe("CANCELLED");
  });

  it("deve retornar os dados da liquidação sem perder precisão monetária", async () => {
    const response = await request(app)
      .get("/lots/mine")
      .set("Authorization", `Bearer ${auctioneerToken}`);

    expect(response.status).toBe(200);

    const settledLot = response.body.lots.find(
      (lot: { id: string }) => lot.id === settledLotId,
    );

    expect(settledLot).toBeDefined();
    expect(settledLot.status).toBe("ENDED");
    expect(settledLot.settlement).toBeDefined();
    expect(settledLot.settlement.amountCents).toBe("25000");
    expect(settledLot.settlement.winnerId).toBe(bidderId);
    expect(typeof settledLot.startingBidCents).toBe("string");
    expect(typeof settledLot.minIncrementCents).toBe("string");
  });

  it("deve retornar liquidação nula para lotes não liquidados", async () => {
    const response = await request(app)
      .get("/lots/mine")
      .set("Authorization", `Bearer ${auctioneerToken}`);

    expect(response.status).toBe(200);

    const scheduledLot = response.body.lots.find(
      (lot: { id: string }) => lot.id === scheduledLotId,
    );

    expect(scheduledLot).toBeDefined();
    expect(scheduledLot.settlement).toBeNull();
  });

  it("deve isolar os dados quando outro leiloeiro consulta seus lotes", async () => {
    const response = await request(app)
      .get("/lots/mine")
      .set("Authorization", `Bearer ${otherAuctioneerToken}`);

    expect(response.status).toBe(200);

    const ids = response.body.lots.map(
      (lot: { id: string }) => lot.id,
    );

    expect(ids).toContain(otherAuctioneerLotId);
    expect(ids).not.toContain(scheduledLotId);
    expect(ids).not.toContain(cancelledLotId);
    expect(ids).not.toContain(settledLotId);
  });

  it("não deve expor dados internos dos lotes", async () => {
    const response = await request(app)
      .get("/lots/mine")
      .set("Authorization", `Bearer ${auctioneerToken}`);

    expect(response.status).toBe(200);

    for (const lot of response.body.lots) {
      expect(lot).not.toHaveProperty("itemSnapshot");
      expect(lot).not.toHaveProperty("sourceItemId");
      expect(lot).not.toHaveProperty("auctioneerId");
      expect(typeof lot.startingBidCents).toBe("string");
    }
  });
});
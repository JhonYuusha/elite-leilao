import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";

describe("PATCH /lots/:id/cancel - Cancelamento de lotes", () => {
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

  async function createTestLot(
    options: {
      auctioneerId?: string;
      status?: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
      currentBidCents?: bigint | null;
    } = {},
  ) {
    const now = Date.now();

    const lot = await prisma.lot.create({
      data: {
        auctioneerId: options.auctioneerId ?? auctioneerId,
        title: "Lote de teste de cancelamento",
        description: "Lote utilizado nos testes automatizados.",
        sourceApi: "test",
        sourceItemId: randomUUID(),
        itemSnapshot: {
          origin: "test",
        },
        startingBidCents: 10000n,
        minIncrementCents: 1000n,
        currentBidCents: options.currentBidCents ?? null,
        startsAt: new Date(now - 60_000),
        endsAt: new Date(now + 3_600_000),
        status: options.status ?? "LIVE",
      },
    });

    lotIds.push(lot.id);

    return lot;
  }

  async function cancelAs(
    lotId: string,
    token: string = auctioneerToken,
  ) {
    return request(app)
      .patch(`/lots/${lotId}/cancel`)
      .set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: auctioneerId,
          name: "Leiloeiro de Cancelamento",
          email: `cancel-owner-${auctioneerId}@example.com`,
          passwordHash: "test",
          role: "AUCTIONEER",
        },
        {
          id: otherAuctioneerId,
          name: "Outro Leiloeiro de Cancelamento",
          email: `cancel-other-${otherAuctioneerId}@example.com`,
          passwordHash: "test",
          role: "AUCTIONEER",
        },
        {
          id: bidderId,
          name: "Participante de Cancelamento",
          email: `cancel-bidder-${bidderId}@example.com`,
          passwordHash: "test",
          role: "BIDDER",
        },
      ],
    });

    await prisma.wallet.create({
      data: {
        userId: bidderId,
        totalCents: 100000n,
        committedCents: 0n,
      },
    });
  });

  afterAll(async () => {
    await prisma.walletTransaction.deleteMany({
      where: {
        lotId: {
          in: lotIds,
        },
      },
    });

    await prisma.bid.deleteMany({
      where: {
        lotId: {
          in: lotIds,
        },
      },
    });

    await prisma.receipt.deleteMany({
      where: {
        lotId: {
          in: lotIds,
        },
      },
    });

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

    await prisma.wallet.deleteMany({
      where: {
        userId: bidderId,
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

  it("deve rejeitar cancelamento sem autenticação", async () => {
    const lot = await createTestLot();

    const response = await request(app)
      .patch(`/lots/${lot.id}/cancel`);

    expect(response.status).toBe(401);

    const storedLot = await prisma.lot.findUniqueOrThrow({
      where: {
        id: lot.id,
      },
    });

    expect(storedLot.status).toBe("LIVE");
  });

  it("deve impedir cancelamento por participantes", async () => {
    const lot = await createTestLot();

    const response = await cancelAs(
      lot.id,
      bidderToken,
    );

    expect(response.status).toBe(403);
  });

  it("deve rejeitar identificadores inválidos", async () => {
    const response = await cancelAs("id-invalido");

    expect(response.status).toBe(400);
  });

  it("deve retornar 404 para lote inexistente", async () => {
    const response = await cancelAs(
      "00000000-0000-4000-8000-000000000000",
    );

    expect(response.status).toBe(404);
  });

  it("deve impedir cancelamento por outro leiloeiro", async () => {
    const lot = await createTestLot();

    const response = await cancelAs(
      lot.id,
      otherAuctioneerToken,
    );

    expect(response.status).toBe(403);

    const storedLot = await prisma.lot.findUniqueOrThrow({
      where: {
        id: lot.id,
      },
    });

    expect(storedLot.status).toBe("LIVE");
  });

  it("deve cancelar um lote sem lances", async () => {
    const lot = await createTestLot();

    const response = await cancelAs(lot.id);

    expect(response.status).toBe(200);
    expect(response.body.lot.id).toBe(lot.id);
    expect(response.body.lot.status).toBe("CANCELLED");

    const storedLot = await prisma.lot.findUniqueOrThrow({
      where: {
        id: lot.id,
      },
    });

    expect(storedLot.status).toBe("CANCELLED");
  });

  it("deve permitir cancelar um lote agendado", async () => {
    const lot = await createTestLot({
      status: "SCHEDULED",
    });

    const response = await cancelAs(lot.id);

    expect(response.status).toBe(200);
    expect(response.body.lot.status).toBe("CANCELLED");
  });

  it("deve impedir o cancelamento repetido", async () => {
    const lot = await createTestLot();

    const firstResponse = await cancelAs(lot.id);
    const secondResponse = await cancelAs(lot.id);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
  });

  it("deve impedir o cancelamento de lotes encerrados", async () => {
    const lot = await createTestLot({
      status: "ENDED",
    });

    const response = await cancelAs(lot.id);

    expect(response.status).toBe(409);
  });

  it("deve impedir o cancelamento quando já existem lances", async () => {
    const lot = await createTestLot();

    const bidResponse = await request(app)
      .post(`/lots/${lot.id}/bids`)
      .set("Authorization", `Bearer ${bidderToken}`)
      .send({
        amountCents: "10000",
      });

    expect(bidResponse.status).toBe(201);

    const cancelResponse = await cancelAs(lot.id);

    expect(cancelResponse.status).toBe(409);

    const storedLot = await prisma.lot.findUniqueOrThrow({
      where: {
        id: lot.id,
      },
    });

    expect(storedLot.status).toBe("LIVE");
    expect(storedLot.currentBidCents).toBe(10000n);
  });

  it("deve impedir o cancelamento quando há valor de lance registrado", async () => {
    const lot = await createTestLot({
      currentBidCents: 15000n,
    });

    const response = await cancelAs(lot.id);

    expect(response.status).toBe(409);
  });

  it("deve ocultar o lote cancelado do catálogo público", async () => {
    const lot = await createTestLot();

    const cancelResponse = await cancelAs(lot.id);

    expect(cancelResponse.status).toBe(200);

    const catalogResponse = await request(app).get("/lots");

    expect(catalogResponse.status).toBe(200);

    const publicIds = catalogResponse.body.lots.map(
      (item: { id: string }) => item.id,
    );

    expect(publicIds).not.toContain(lot.id);

    const detailResponse = await request(app).get(
      `/lots/${lot.id}`,
    );

    expect(detailResponse.status).toBe(404);

    const managementResponse = await request(app)
      .get("/lots/mine")
      .set("Authorization", `Bearer ${auctioneerToken}`);

    expect(managementResponse.status).toBe(200);

    const managedLot = managementResponse.body.lots.find(
      (item: { id: string }) => item.id === lot.id,
    );

    expect(managedLot).toBeDefined();
    expect(managedLot.status).toBe("CANCELLED");
  });

  it("deve serializar cancelamentos simultâneos do mesmo lote", async () => {
    const lot = await createTestLot();

    const responses = await Promise.all([
      cancelAs(lot.id),
      cancelAs(lot.id),
    ]);

    const statuses = responses
      .map((response) => response.status)
      .sort();

    expect(statuses).toEqual([200, 409]);

    const storedLot = await prisma.lot.findUniqueOrThrow({
      where: {
        id: lot.id,
      },
    });

    expect(storedLot.status).toBe("CANCELLED");
  });

  it("deve impedir que lance e cancelamento sejam aceitos juntos", async () => {
    const lot = await createTestLot();

    const [cancelResponse, bidResponse] = await Promise.all([
      cancelAs(lot.id),
      request(app)
        .post(`/lots/${lot.id}/bids`)
        .set("Authorization", `Bearer ${bidderToken}`)
        .send({
          amountCents: "10000",
        }),
    ]);

    const acceptedCount = [
      cancelResponse.status === 200,
      bidResponse.status === 201,
    ].filter(Boolean).length;

    expect(acceptedCount).toBe(1);

    if (cancelResponse.status === 200) {
      expect(bidResponse.status).toBe(409);
    } else {
      expect(cancelResponse.status).toBe(409);
      expect(bidResponse.status).toBe(201);
    }

    const storedLot = await prisma.lot.findUniqueOrThrow({
      where: {
        id: lot.id,
      },
    });

    const bids = await prisma.bid.findMany({
      where: {
        lotId: lot.id,
      },
    });

    if (storedLot.status === "CANCELLED") {
      expect(bids).toHaveLength(0);
      expect(storedLot.currentBidCents).toBeNull();
    } else {
      expect(storedLot.status).toBe("LIVE");
      expect(bids).toHaveLength(1);
      expect(storedLot.currentBidCents).toBe(10000n);
    }
  });
});
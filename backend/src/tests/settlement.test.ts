import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/auth.js";

describe("Liquidação de leilões", () => {
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

  async function createLot(ended = true) {
    const now = Date.now();

    const lot = await prisma.lot.create({
      data: {
        auctioneerId,
        title: "Lote para Liquidação",
        description: "Teste automatizado de encerramento.",
        sourceApi: "test",
        sourceItemId: randomUUID(),
        itemSnapshot: { title: "Lote para Liquidação" },
        startingBidCents: 10000n,
        minIncrementCents: 1000n,
        startsAt: new Date(now - 3_600_000),
        endsAt: new Date(now + (ended ? -60_000 : 3_600_000)),
        status: "LIVE",
      },
    });

    lotIds.push(lot.id);
    return lot;
  }

  async function createWinningBid(lotId: string) {
    const bid = await prisma.bid.create({
      data: {
        lotId,
        bidderId,
        amountCents: 10000n,
        previousHash: null,
        hash: randomUUID().replaceAll("-", ""),
      },
    });

    await prisma.lot.update({
      where: { id: lotId },
      data: { currentBidCents: 10000n },
    });

    await prisma.wallet.update({
      where: { userId: bidderId },
      data: { committedCents: { increment: 10000n } },
    });

    await prisma.walletTransaction.create({
      data: {
        userId: bidderId,
        lotId,
        type: "BID_COMMIT",
        amountCents: 10000n,
      },
    });

    return bid;
  }

  async function settle(lotId: string, token = auctioneerToken) {
    return request(app)
      .post(`/lots/${lotId}/settle`)
      .set("Authorization", `Bearer ${token}`);
  }

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: auctioneerId,
          name: "Leiloeiro Liquidação",
          email: `settlement-a-${auctioneerId}@example.com`,
          passwordHash: "test",
          role: "AUCTIONEER",
        },
        {
          id: otherAuctioneerId,
          name: "Outro Leiloeiro",
          email: `settlement-b-${otherAuctioneerId}@example.com`,
          passwordHash: "test",
          role: "AUCTIONEER",
        },
        {
          id: bidderId,
          name: "Participante Liquidação",
          email: `settlement-bidder-${bidderId}@example.com`,
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
    await prisma.receipt.deleteMany({
      where: { lotId: { in: lotIds } },
    });

    await prisma.settlement.deleteMany({
      where: { lotId: { in: lotIds } },
    });

    await prisma.walletTransaction.deleteMany({
      where: {
        userId: {
          in: [auctioneerId, otherAuctioneerId, bidderId],
        },
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
        userId: {
          in: [auctioneerId, otherAuctioneerId, bidderId],
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

  it("deve rejeitar liquidação sem autenticação", async () => {
    const lot = await createLot();
    const response = await request(app).post(`/lots/${lot.id}/settle`);

    expect(response.status).toBe(401);
  });

  it("deve impedir que participantes liquidem lotes", async () => {
    const lot = await createLot();
    const response = await settle(lot.id, bidderToken);

    expect(response.status).toBe(403);
  });

  it("deve impedir liquidação por outro leiloeiro", async () => {
    const lot = await createLot();
    const response = await settle(lot.id, otherAuctioneerToken);

    expect(response.status).toBe(403);
  });

  it("deve impedir liquidação antes do encerramento", async () => {
    const lot = await createLot(false);
    const response = await settle(lot.id);

    expect(response.status).toBe(409);

    const savedLot = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(savedLot.status).toBe("LIVE");
  });

  it("deve encerrar lote sem lances e sem movimentação financeira", async () => {
    const lot = await createLot();
    const response = await settle(lot.id);

    expect(response.status).toBe(200);
    expect(response.body.alreadySettled).toBe(false);
    expect(response.body.settlement.winnerId).toBeNull();
    expect(response.body.settlement.amountCents).toBeNull();

    const savedLot = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(savedLot.status).toBe("ENDED");

    const transactions = await prisma.walletTransaction.findMany({
      where: { lotId: lot.id },
    });

    expect(transactions).toHaveLength(0);
  });

  it("deve transferir o valor do vencedor para o leiloeiro", async () => {
    const lot = await createLot();
    await createWinningBid(lot.id);

    const winnerBefore = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bidderId },
    });

    const response = await settle(lot.id);

    expect(response.status).toBe(200);
    expect(response.body.alreadySettled).toBe(false);
    expect(response.body.settlement.winnerId).toBe(bidderId);
    expect(response.body.settlement.amountCents).toBe("10000");

    const winnerAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bidderId },
    });

    const auctioneerWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: auctioneerId },
    });

    expect(winnerAfter.totalCents).toBe(winnerBefore.totalCents - 10000n);
    expect(winnerAfter.committedCents).toBe(winnerBefore.committedCents - 10000n);
    expect(auctioneerWallet.totalCents).toBe(10000n);

    const debit = await prisma.walletTransaction.findFirst({
      where: {
        lotId: lot.id,
        userId: bidderId,
        type: "AUCTION_DEBIT",
      },
    });

    const credit = await prisma.walletTransaction.findFirst({
      where: {
        lotId: lot.id,
        userId: auctioneerId,
        type: "AUCTION_CREDIT",
      },
    });

    expect(debit?.amountCents).toBe(10000n);
    expect(credit?.amountCents).toBe(10000n);

    const receipt = await prisma.receipt.findUnique({
      where: { lotId: lot.id },
    });

    expect(receipt?.amountCents).toBe(10000n);
    expect(receipt?.publicToken).toMatch(/^[a-f0-9]{48}$/);
  });

  it("deve ser idempotente ao liquidar o mesmo lote novamente", async () => {
    const lot = await createLot();
    await createWinningBid(lot.id);

    const first = await settle(lot.id);
    const second = await settle(lot.id);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.alreadySettled).toBe(false);
    expect(second.body.alreadySettled).toBe(true);
    expect(second.body.settlement.id).toBe(first.body.settlement.id);

    const debits = await prisma.walletTransaction.count({
      where: { lotId: lot.id, type: "AUCTION_DEBIT" },
    });

    const credits = await prisma.walletTransaction.count({
      where: { lotId: lot.id, type: "AUCTION_CREDIT" },
    });

    expect(debits).toBe(1);
    expect(credits).toBe(1);
  });

  it("deve impedir pagamento duplicado em liquidações simultâneas", async () => {
    const lot = await createLot();
    await createWinningBid(lot.id);

    const responses = await Promise.all([
      settle(lot.id),
      settle(lot.id),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 200]);
    expect(responses.map((r) => r.body.alreadySettled).sort()).toEqual([
      false,
      true,
    ]);

    const settlements = await prisma.settlement.count({
      where: { lotId: lot.id },
    });

    const receipts = await prisma.receipt.count({
      where: { lotId: lot.id },
    });

    const debits = await prisma.walletTransaction.count({
      where: { lotId: lot.id, type: "AUCTION_DEBIT" },
    });

    const credits = await prisma.walletTransaction.count({
      where: { lotId: lot.id, type: "AUCTION_CREDIT" },
    });

    expect(settlements).toBe(1);
    expect(receipts).toBe(1);
    expect(debits).toBe(1);
    expect(credits).toBe(1);
  });

  it("deve preservar créditos ao liquidar lotes diferentes simultaneamente", async () => {
    const lotA = await createLot();
    const lotB = await createLot();

    await createWinningBid(lotA.id);
    await createWinningBid(lotB.id);

    const auctioneerBefore = await prisma.wallet.findUnique({
      where: { userId: auctioneerId },
    });

    const balanceBefore = auctioneerBefore?.totalCents ?? 0n;

    const winnerBefore = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bidderId },
    });

    const responses = await Promise.all([
      settle(lotA.id),
      settle(lotB.id),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 200]);
    expect(responses.every((r) => r.body.alreadySettled === false)).toBe(true);

    const auctioneerAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId: auctioneerId },
    });

    const winnerAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bidderId },
    });

    expect(auctioneerAfter.totalCents).toBe(balanceBefore + 20000n);
    expect(winnerAfter.totalCents).toBe(winnerBefore.totalCents - 20000n);
    expect(winnerAfter.committedCents).toBe(winnerBefore.committedCents - 20000n);

    const ids = [lotA.id, lotB.id];

    expect(
      await prisma.settlement.count({
        where: { lotId: { in: ids } },
      }),
    ).toBe(2);

    expect(
      await prisma.receipt.count({
        where: { lotId: { in: ids } },
      }),
    ).toBe(2);

    expect(
      await prisma.walletTransaction.count({
        where: {
          lotId: { in: ids },
          type: "AUCTION_DEBIT",
        },
      }),
    ).toBe(2);

    expect(
      await prisma.walletTransaction.count({
        where: {
          lotId: { in: ids },
          type: "AUCTION_CREDIT",
        },
      }),
    ).toBe(2);

    const savedLots = await prisma.lot.findMany({
      where: { id: { in: ids } },
    });

    expect(savedLots).toHaveLength(2);
    expect(savedLots.every((lot) => lot.status === "ENDED")).toBe(true);
  });
});
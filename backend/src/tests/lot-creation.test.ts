import "dotenv/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { getExternalProduct } from "../services/product.service.js";

vi.mock("../services/product.service.js", () => ({
  getExternalProduct: vi.fn(),
}));

const mockedGetExternalProduct = vi.mocked(getExternalProduct);

const demoProduct = {
  id: 1,
  title: "Produto de Teste",
  description: "Produto importado para teste.",
  category: "electronics",
  thumbnail: "https://example.com/product.webp",
};

function validPayload() {
  const now = Date.now();

  return {
    sourceItemId: 1,
    startingBidCents: "50000",
    minIncrementCents: "1000",
    startsAt: new Date(now + 60_000).toISOString(),
    endsAt: new Date(now + 3_600_000).toISOString(),
  };
}

async function login(
  email: string,
): Promise<{ token: string; userId: string }> {
  const response = await request(app)
    .post("/auth/login")
    .send({
      email,
      password: "Demo@123456",
    });

  expect(response.status).toBe(200);

  return {
    token: response.body.accessToken,
    userId: response.body.user.id,
  };
}

describe("POST /lots - Criação de lotes", () => {
  const createdLotIds: string[] = [];

  afterEach(async () => {
    mockedGetExternalProduct.mockReset();

    if (createdLotIds.length > 0) {
      await prisma.lot.deleteMany({
        where: {
          id: { in: createdLotIds },
        },
      });

      createdLotIds.length = 0;
    }
  });

  it("deve rejeitar requisições sem autenticação", async () => {
    const response = await request(app)
      .post("/lots")
      .send(validPayload());

    expect(response.status).toBe(401);
    expect(mockedGetExternalProduct).not.toHaveBeenCalled();
  });

  it("deve impedir que participantes criem lotes", async () => {
    const { token } = await login("participante1@demo.local");

    const response = await request(app)
      .post("/lots")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload());

    expect(response.status).toBe(403);
    expect(mockedGetExternalProduct).not.toHaveBeenCalled();
  });

  it("deve rejeitar valores monetários inválidos", async () => {
    const { token } = await login("leiloeiro@demo.local");

    const response = await request(app)
      .post("/lots")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validPayload(),
        startingBidCents: "-100",
      });

    expect(response.status).toBe(400);
    expect(mockedGetExternalProduct).not.toHaveBeenCalled();
  });

  it("deve rejeitar encerramento anterior ao início", async () => {
    const { token } = await login("leiloeiro@demo.local");

    const payload = validPayload();

    const response = await request(app)
      .post("/lots")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...payload,
        endsAt: new Date(
          Date.parse(payload.startsAt) - 60_000,
        ).toISOString(),
      });

    expect(response.status).toBe(400);
    expect(mockedGetExternalProduct).not.toHaveBeenCalled();
  });

  it("deve retornar 404 quando o produto externo não existir", async () => {
    mockedGetExternalProduct.mockResolvedValueOnce(null);

    const { token } = await login("leiloeiro@demo.local");

    const response = await request(app)
      .post("/lots")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload());

    expect(response.status).toBe(404);
    expect(mockedGetExternalProduct).toHaveBeenCalledWith(1);
  });

  it("deve criar um lote associado ao leiloeiro autenticado", async () => {
    mockedGetExternalProduct.mockResolvedValueOnce(demoProduct);

    const { token, userId } = await login("leiloeiro@demo.local");

    const response = await request(app)
      .post("/lots")
      .set("Authorization", `Bearer ${token}`)
      .send(validPayload());

    expect(response.status).toBe(201);

    const lotId = response.body.lot?.id;

    expect(lotId).toEqual(expect.any(String));

    createdLotIds.push(lotId);

    expect(response.body.lot).toMatchObject({
      id: lotId,
      auctioneerId: userId,
      title: demoProduct.title,
      sourceApi: "dummyjson",
      sourceItemId: "1",
      startingBidCents: "50000",
      minIncrementCents: "1000",
      status: "SCHEDULED",
    });

    const savedLot = await prisma.lot.findUnique({
      where: { id: lotId },
    });

    expect(savedLot).not.toBeNull();
    expect(savedLot?.auctioneerId).toBe(userId);
    expect(savedLot?.startingBidCents).toBe(50000n);
    expect(savedLot?.minIncrementCents).toBe(1000n);
    expect(savedLot?.imageUrl).toBe(demoProduct.thumbnail);
    expect(savedLot?.itemSnapshot).toMatchObject(demoProduct);
  });
});
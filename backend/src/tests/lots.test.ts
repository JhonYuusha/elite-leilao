import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("Catálogo público de lotes", () => {
  it("deve listar os lotes sem expor dados internos", async () => {
    const response = await request(app).get("/lots");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.lots)).toBe(true);

    for (const lot of response.body.lots) {
      expect(typeof lot.startingBidCents).toBe("string");
      expect(typeof lot.minIncrementCents).toBe("string");
      expect(lot.status).not.toBe("CANCELLED");
      expect(lot).not.toHaveProperty("itemSnapshot");
      expect(lot).not.toHaveProperty("auctioneerId");
    }
  });

  it("deve consultar um lote existente por ID", async () => {
    const lot = await prisma.lot.findFirst({
      where: { status: { not: "CANCELLED" } },
      select: { id: true },
    });

    expect(lot).not.toBeNull();

    const response = await request(app).get(`/lots/${lot!.id}`);

    expect(response.status).toBe(200);
    expect(response.body.lot.id).toBe(lot!.id);
    expect(typeof response.body.lot.startingBidCents).toBe("string");
  });

  it("deve rejeitar identificadores inválidos", async () => {
    const response = await request(app).get("/lots/id-invalido");

    expect(response.status).toBe(400);
  });

  it("deve retornar 404 para lote inexistente", async () => {
    const response = await request(app).get(
      "/lots/00000000-0000-4000-8000-000000000000",
    );

    expect(response.status).toBe(404);
  });
});
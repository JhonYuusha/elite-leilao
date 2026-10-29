import { describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("GET /lots/:id/audit - Auditoria pública", () => {
  it("rejeita identificadores inválidos", async () => {
    const response = await request(app).get(
      "/lots/id-invalido/audit",
    );

    expect(response.status).toBe(400);
  });

  it("retorna 404 para lote inexistente", async () => {
    const response = await request(app).get(
      "/lots/00000000-0000-4000-8000-000000000000/audit",
    );

    expect(response.status).toBe(404);
  });

  it("permite consulta pública sem expor IDs privados", async () => {
    const lot = await prisma.lot.findFirst({
      where: {
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });

    expect(lot).not.toBeNull();

    const response = await request(app).get(
      `/lots/${lot!.id}/audit`,
    );

    expect(response.status).toBe(200);
    expect(response.body.audit.lotId).toBe(lot!.id);
    expect(
      typeof response.body.audit.integrity.valid,
    ).toBe("boolean");
    expect(
      Array.isArray(response.body.audit.bids),
    ).toBe(true);

    for (const bid of response.body.audit.bids) {
      expect(bid).not.toHaveProperty("bidderId");
      expect(bid).not.toHaveProperty("email");
      expect(bid).not.toHaveProperty("passwordHash");
    }
  });
});

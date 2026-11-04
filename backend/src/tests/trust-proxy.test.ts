import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";

function createTestApp(trustedHops: number) {
  const app = express();

  app.set("trust proxy", trustedHops);

  app.get("/test/ip", (req, res) => {
    res.json({
      ip: req.ip,
    });
  });

  return app;
}

describe("Segurança do trust proxy", () => {
  it("ignora X-Forwarded-For quando não confia em proxies", async () => {
    const app = createTestApp(0);

    const response = await request(app)
      .get("/test/ip")
      .set("X-Forwarded-For", "203.0.113.10");

    expect(response.status).toBe(200);
    expect(response.body.ip).not.toBe("203.0.113.10");
  });

  it("considera o endereço mais próximo quando confia em um proxy", async () => {
    const app = createTestApp(1);

    const response = await request(app)
      .get("/test/ip")
      .set(
        "X-Forwarded-For",
        "203.0.113.99, 198.51.100.42",
      );

    expect(response.status).toBe(200);
    expect(response.body.ip).toBe("198.51.100.42");
    expect(response.body.ip).not.toBe("203.0.113.99");
  });

  it("não utiliza um IP falso à esquerda da cadeia com um proxy confiável", async () => {
    const app = createTestApp(1);

    const first = await request(app)
      .get("/test/ip")
      .set(
        "X-Forwarded-For",
        "203.0.113.10, 198.51.100.42",
      );

    const second = await request(app)
      .get("/test/ip")
      .set(
        "X-Forwarded-For",
        "203.0.113.20, 198.51.100.42",
      );

    expect(first.body.ip).toBe("198.51.100.42");
    expect(second.body.ip).toBe(first.body.ip);
  });
});

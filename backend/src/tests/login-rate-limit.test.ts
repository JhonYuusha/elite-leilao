import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";

import {
  createLoginRateLimit,
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_MESSAGE,
} from "../middlewares/login-rate-limit.js";

describe("Rate limiting do login", () => {
  it("deve bloquear requisições acima do limite", async () => {
    const app = express();

    const limiter = createLoginRateLimit();

    app.post("/auth/login", limiter, (_req, res) => {
      res.status(401).json({
        error: "Credenciais inválidas.",
      });
    });

    for (
      let attempt = 0;
      attempt < LOGIN_RATE_LIMIT_MAX;
      attempt++
    ) {
      const response = await request(app)
        .post("/auth/login");

      expect(response.status).toBe(401);
    }

    const blocked = await request(app)
      .post("/auth/login");

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual(
      LOGIN_RATE_LIMIT_MESSAGE,
    );
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("deve manter a rota disponível abaixo do limite", async () => {
    const app = express();

    app.post(
      "/auth/login",
      createLoginRateLimit(),
      (_req, res) => {
        res.status(401).json({
          error: "Credenciais inválidas.",
        });
      },
    );

    const response = await request(app)
      .post("/auth/login");

    expect(response.status).toBe(401);
  });
});
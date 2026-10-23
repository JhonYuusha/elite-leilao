import "dotenv/config";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

describe("Autenticação", () => {
  it("deve autenticar um participante com credenciais válidas", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "participante1@demo.local",
        password: "Demo@123456",
      });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.tokenType).toBe("Bearer");

    expect(response.body.user).toMatchObject({
      email: "participante1@demo.local",
      role: "BIDDER",
    });

    expect(response.body.user).not.toHaveProperty("passwordHash");
  });

  it("deve rejeitar senha incorreta", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "participante1@demo.local",
        password: "senha-incorreta",
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Credenciais inválidas.");
  });

  it("deve rejeitar dados inválidos", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "email-invalido",
        password: "",
      });

    expect(response.status).toBe(400);
  });

  it("deve rejeitar acesso sem token", async () => {
    const response = await request(app).get("/auth/me");

    expect(response.status).toBe(401);
  });

  it("deve rejeitar token inválido", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer token-invalido");

    expect(response.status).toBe(401);
  });

  it("deve retornar o usuário autenticado", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({
        email: "participante1@demo.local",
        password: "Demo@123456",
      });

    expect(login.status).toBe(200);

    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      email: "participante1@demo.local",
      role: "BIDDER",
    });

    expect(response.body.user).not.toHaveProperty("passwordHash");
  });
});
describe("Autorização por papel", () => {
  const protectedApp = express();

  protectedApp.get(
    "/auctioneer-only",
    requireAuth,
    requireRole("AUCTIONEER"),
    (_req, res) => {
      res.status(200).json({ allowed: true });
    },
  );

  it("deve impedir que um participante acesse uma rota de leiloeiro", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({
        email: "participante1@demo.local",
        password: "Demo@123456",
      });

    expect(login.status).toBe(200);

    const response = await request(protectedApp)
      .get("/auctioneer-only")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("deve permitir acesso ao leiloeiro", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({
        email: "leiloeiro@demo.local",
        password: "Demo@123456",
      });

    expect(login.status).toBe(200);

    const response = await request(protectedApp)
      .get("/auctioneer-only")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ allowed: true });
  });
});
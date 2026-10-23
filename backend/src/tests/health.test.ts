import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("GET /health", () => {
  it("deve retornar o estado da API", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "elite-leilao-api",
    });
  });
});

describe("GET /health/db", () => {
  it("deve confirmar a conexão com o PostgreSQL", async () => {
    const response = await request(app).get("/health/db");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      database: "connected",
    });
  });
});
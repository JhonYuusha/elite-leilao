import "dotenv/config";

import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import type { Server as SocketServer } from "socket.io";

import {
  initializeSocket,
  publishLotUpdated,
  publishWalletUpdated,
} from "../realtime/socket.js";

describe("Socket.IO - autenticação e isolamento", () => {
  let httpServer: HttpServer;
  let socketServer: SocketServer;
  let url: string;

  const clients: Socket[] = [];

  const userA = "11111111-1111-4111-8111-111111111111";
  const userB = "22222222-2222-4222-8222-222222222222";
  const lotId = "33333333-3333-4333-8333-333333333333";

  const originalJwtSecret = process.env.JWT_SECRET;

  const secret =
    originalJwtSecret &&
    originalJwtSecret !== "replace-with-a-secure-secret"
      ? originalJwtSecret
      : "segredo-exclusivo-para-testes-de-socket-io";

  function createToken(
    userId: string,
    expiresIn: number = 3600,
  ): string {
    return jwt.sign(
      { role: "BIDDER" },
      secret,
      {
        subject: userId,
        expiresIn,
        algorithm: "HS256",
      },
    );
  }

  function connect(token?: string): Socket {
    const client = createClient(url, {
      autoConnect: false,
      reconnection: false,
      forceNew: true,
      transports: ["websocket"],
      auth: token ? { token } : {},
    });

    clients.push(client);
    client.connect();

    return client;
  }

  function waitForEvent(
    client: Socket,
    event: string,
    timeoutMs = 3000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Tempo esgotado: ${event}`));
      }, timeoutMs);

      const onEvent = (data: unknown) => {
        cleanup();
        resolve(data);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      function cleanup() {
        clearTimeout(timer);
        client.off(event, onEvent);
        client.off("connect_error", onError);
      }

      client.once(event, onEvent);
      client.once("connect_error", onError);
    });
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;

    httpServer = createServer();
    socketServer = initializeSocket(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", resolve);
    });

    const address = httpServer.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const client of clients) {
      client.disconnect();
    }

    await new Promise<void>((resolve) => {
      socketServer.close(() => resolve());
    });

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it("permite conexão pública sem autenticação", async () => {
    const visitor = connect();

    await waitForEvent(visitor, "connect");

    expect(visitor.connected).toBe(true);
  });

  it("rejeita um JWT inválido", async () => {
    const client = connect("token-invalido");

    const error = (await waitForEvent(
      client,
      "connect_error",
    )) as Error;

    expect(error.message).toContain("Sessão inválida");
    expect(client.connected).toBe(false);
  });

  it("aceita JWT válido e entrega evento privado", async () => {
    const client = connect(createToken(userA));

    await waitForEvent(client, "connect");

    const received = waitForEvent(
      client,
      "wallet:updated",
    );

    publishWalletUpdated([userA]);

    await expect(received).resolves.toBeUndefined();
  });

  it("impede acesso à sala privada de outro usuário", async () => {
    const clientA = connect(createToken(userA));
    const clientB = connect(createToken(userB));
    const visitor = connect();

    await Promise.all([
      waitForEvent(clientA, "connect"),
      waitForEvent(clientB, "connect"),
      waitForEvent(visitor, "connect"),
    ]);

    let receivedByB = false;
    let receivedByVisitor = false;

    clientB.on("wallet:updated", () => {
      receivedByB = true;
    });

    visitor.on("wallet:updated", () => {
      receivedByVisitor = true;
    });

    // Nenhum cliente pode escolher sua própria sala privada.
    clientB.emit("user:join", userA);
    visitor.emit("user:join", userA);

    const receivedByA = waitForEvent(
      clientA,
      "wallet:updated",
    );

    publishWalletUpdated([userA]);

    await receivedByA;
    await delay(150);

    expect(receivedByB).toBe(false);
    expect(receivedByVisitor).toBe(false);
  });

  it("mantém as atualizações públicas de lotes", async () => {
    const visitor = connect();

    await waitForEvent(visitor, "connect");

    visitor.emit("lot:join", lotId);

    const received = waitForEvent(
      visitor,
      "lot:updated",
    );

    await delay(100);

    publishLotUpdated({
      lotId,
      currentBidCents: "25000",
      endsAt: new Date(Date.now() + 60000).toISOString(),
      status: "LIVE",
      extended: false,
    });

    const event = (await received) as {
      lotId: string;
    };

    expect(event.lotId).toBe(lotId);
  });

  it("rejeita JWT expirado", async () => {
    const expiredToken = jwt.sign(
      { role: "BIDDER" },
      secret,
      {
        subject: userA,
        expiresIn: -1,
        algorithm: "HS256",
      },
    );

    const client = connect(expiredToken);

    const error = (await waitForEvent(
      client,
      "connect_error",
    )) as Error;

    expect(error.message).toContain("Sessão inválida");
    expect(client.connected).toBe(false);
  });

  it("desconecta a sessão privada após expiração", async () => {
    const client = connect(createToken(userA, 2));

    await waitForEvent(client, "connect");

    await waitForEvent(
      client,
      "disconnect",
      4000,
    );

    expect(client.connected).toBe(false);
  });

  it("não mantém acesso à conta anterior após troca de identidade", async () => {
    const client = connect(createToken(userA));

    await waitForEvent(client, "connect");

    expect(client.connected).toBe(true);

    // Simula logout da conta A.
    const disconnected = waitForEvent(
      client,
      "disconnect",
    );

    client.disconnect();

    await disconnected;

    expect(client.connected).toBe(false);

    // Simula login na conta B utilizando o mesmo cliente.
    client.auth = {
      token: createToken(userB),
    };

    const reconnected = waitForEvent(
      client,
      "connect",
    );

    client.connect();

    await reconnected;

    expect(client.connected).toBe(true);

    let receivedFromA = false;

    const handleWalletUpdated = () => {
      receivedFromA = true;
    };

    client.on("wallet:updated", handleWalletUpdated);

    // Um evento privado da conta A não pode chegar à conta B.
    publishWalletUpdated([userA]);

    await delay(200);

    expect(receivedFromA).toBe(false);

    client.off("wallet:updated", handleWalletUpdated);

    // A conta B deve receber seus próprios eventos.
    const receivedFromB = waitForEvent(
      client,
      "wallet:updated",
    );

    publishWalletUpdated([userB]);

    await expect(receivedFromB).resolves.toBeUndefined();
  });
});
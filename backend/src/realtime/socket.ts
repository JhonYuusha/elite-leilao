import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { z } from "zod";

import { verifyAccessToken } from "../lib/auth.js";

interface LotUpdatedEvent {
  lotId: string;
  currentBidCents: string;
  endsAt: string;
  status: "LIVE";
  extended: boolean;
}

let io: Server | null = null;

export function initializeSocket(httpServer: HttpServer): Server {
  if (io) {
    throw new Error("O Socket.IO já foi inicializado.");
  }

  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    // Visitantes anônimos continuam recebendo eventos públicos.
    if (token === undefined || token === null || token === "") {
      next();
      return;
    }

    if (typeof token !== "string") {
      next(new Error("Credenciais de conexão inválidas."));
      return;
    }

    try {
      // Verifica assinatura, expiração e papel do usuário.
      const auth = verifyAccessToken(token);

      // O decode é usado apenas após a verificação do JWT.
      const payload = jwt.decode(token);

      if (!payload || typeof payload === "string") {
        next(new Error("Token inválido."));
        return;
      }

      if (
        typeof payload.exp !== "number" ||
        !Number.isSafeInteger(payload.exp)
      ) {
        next(new Error("Token sem expiração válida."));
        return;
      }

      const expiresInMs = payload.exp * 1000 - Date.now();

      if (expiresInMs <= 0) {
        next(new Error("Sessão expirada."));
        return;
      }

      socket.data.userId = auth.sub;
      socket.data.role = auth.role;
      socket.data.expiresInMs = expiresInMs;

      next();
    } catch {
      next(new Error("Sessão inválida ou expirada."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    const expiresInMs = socket.data.expiresInMs as number | undefined;

    if (userId && expiresInMs !== undefined) {
      // A sala privada é definida exclusivamente pelo servidor.
      void socket.join(`user:${userId}`);

      // Encerra a conexão quando o JWT expira.
      const expirationTimer = setTimeout(() => {
        socket.disconnect(true);
      }, expiresInMs);

      expirationTimer.unref();

      socket.on("disconnect", () => {
        clearTimeout(expirationTimer);
      });
    }

    socket.on("lot:join", (lotId: unknown) => {
      const parsed = z.uuid().safeParse(lotId);

      if (!parsed.success) {
        return;
      }

      void socket.join(`lot:${parsed.data}`);
    });

    socket.on("lot:leave", (lotId: unknown) => {
      const parsed = z.uuid().safeParse(lotId);

      if (!parsed.success) {
        return;
      }

      void socket.leave(`lot:${parsed.data}`);
    });
  });

  return io;
}

export function publishLotUpdated(event: LotUpdatedEvent): void {
  if (!io) {
    return;
  }

  io.to(`lot:${event.lotId}`).emit("lot:updated", event);

  io.emit("lots:updated", {
    lotId: event.lotId,
  });
}

export function publishWalletUpdated(userIds: string[]): void {
  if (!io) {
    return;
  }

  for (const userId of new Set(userIds)) {
    io.to(`user:${userId}`).emit("wallet:updated");
  }
}
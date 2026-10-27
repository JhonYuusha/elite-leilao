import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";

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

  io.on("connection", (socket) => {
    socket.on("lot:join", (lotId: unknown) => {
      const parsed = z.uuid().safeParse(lotId);

      if (!parsed.success) {
        return;
      }

      socket.join(`lot:${parsed.data}`);
    });

    socket.on("lot:leave", (lotId: unknown) => {
      const parsed = z.uuid().safeParse(lotId);

      if (!parsed.success) {
        return;
      }

      socket.leave(`lot:${parsed.data}`);
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
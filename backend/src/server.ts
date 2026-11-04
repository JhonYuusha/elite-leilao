import "dotenv/config";
import { createServer } from "node:http";

import { app } from "./app.js";
import { initializeSocket } from "./realtime/socket.js";
import { startSettlementScheduler } from "./services/settlement-scheduler.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT ?? 3333);

const httpServer = createServer(app);

initializeSocket(httpServer);

let stopScheduler: (() => Promise<void>) | undefined;
let shuttingDown = false;

httpServer.listen(port, () => {
  console.log(`API disponível em http://localhost:${port}`);
  console.log("Socket.IO disponível no mesmo servidor HTTP.");

  if (process.env.SETTLEMENT_SCHEDULER_ENABLED === "true") {
  stopScheduler = startSettlementScheduler();
  }
});

async function shutdown(signal: string) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`[server] Recebido ${signal}. Encerrando...`);

  const forceExit = setTimeout(() => {
    console.error("[server] Tempo limite de encerramento excedido.");
    process.exit(1);
  }, 25_000);

  forceExit.unref();

  try {
    await stopScheduler?.();

    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    await prisma.$disconnect();

    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error("[server] Falha no encerramento:", error);
    process.exit(1);
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
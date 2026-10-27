import "dotenv/config";
import { createServer } from "node:http";

import { app } from "./app.js";
import { initializeSocket } from "./realtime/socket.js";

const port = Number(process.env.PORT ?? 3333);

const httpServer = createServer(app);

initializeSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`API disponível em http://localhost:${port}`);
  console.log("Socket.IO disponível no mesmo servidor HTTP.");
});
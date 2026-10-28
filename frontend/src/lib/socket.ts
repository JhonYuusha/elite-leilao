import { io } from "socket.io-client";

import {
  getAccessToken,
  subscribeToAccessToken,
} from "./api";

const SOCKET_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3333";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export function synchronizeSocketAuth(): void {
  const token = getAccessToken();

  if (!token) {
    socket.disconnect();
    socket.auth = {};
    return;
  }

  const previousToken =
    typeof socket.auth === "object" &&
    socket.auth !== null &&
    "token" in socket.auth
      ? socket.auth.token
      : undefined;

  if (socket.connected && previousToken === token) {
    return;
  }

  socket.auth = { token };

  if (socket.connected) {
    socket.disconnect();
  }

  socket.connect();
}

// Mantém a conexão privada sincronizada com o JWT
subscribeToAccessToken(() => {
  synchronizeSocketAuth();
});
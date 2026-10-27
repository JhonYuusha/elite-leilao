import { io } from "socket.io-client";

import { TOKEN_KEY } from "./api";

const SOCKET_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3333";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

function currentToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function synchronizeSocketAuth(): void {
  const token = currentToken();

  socket.auth = token ? { token } : {};

  // Uma nova conexão é necessária para trocar a identidade
  // e as salas privadas vinculadas à sessão anterior.
  if (socket.connected) {
    socket.disconnect();
  }

  socket.connect();
}
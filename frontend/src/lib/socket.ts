import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3333";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});
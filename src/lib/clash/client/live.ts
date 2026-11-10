"use client";

// Live duel socket client — single shared connection to the
// real-time duel service.
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let authed = false;

export function isLiveAuthed(): boolean {
  return authed;
}

export function setLiveAuthed(v: boolean): void {
  authed = v;
}

export function getLiveSocket(): Socket {
  if (!socket) {
    const url =
      process.env.NEXT_PUBLIC_LIVE_SOCKET_URL ||
      (typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:3003`
        : "http://localhost:3003");
    socket = io(url, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
      timeout: 12000,
    });
  }
  return socket;
}

export function disconnectLive() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  authed = false;
}

"use client";

// Live duel socket client — single shared connection to the
// duel mini-service through the sandbox gateway.
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
    socket = io("/?XTransformPort=3003", {
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
}

"use client";

import { useEffect, useCallback, useSyncExternalStore } from "react";

export type Route = { path: string; segments: string[] };

function readHash(): string {
  if (typeof window === "undefined") return "/";
  return window.location.hash.replace(/^#/, "") || "/";
}

function toRoute(raw: string): Route {
  const path = raw.split("?")[0] || "/";
  return { path, segments: path.split("/").filter(Boolean) };
}

// Cached snapshots so useSyncExternalStore receives a stable object per hash.
const SERVER_ROUTE: Route = toRoute("/");
let lastRaw = "/";
let lastRoute: Route = SERVER_ROUTE;

function getClientSnapshot(): Route {
  const raw = readHash();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastRoute = toRoute(raw);
  }
  return lastRoute;
}

function getServerSnapshot(): Route {
  return SERVER_ROUTE;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function navigate(to: string, replace = false) {
  const target = `#${to.startsWith("/") ? to : "/" + to}`;
  if (typeof window !== "undefined") {
    if (replace) window.history.replaceState(null, "", target);
    else window.location.hash = target;
    if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

/**
 * Hash-based route. The server always renders "/", and the client switches to
 * the real hash right after hydration — this avoids hydration mismatches when
 * a deep link (e.g. #/quiz/guest) is opened directly.
 */
export function useRoute(): Route {
  const route = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [route.path]);
  return route;
}

export function useNavigate() {
  return useCallback((to: string, replace = false) => navigate(to, replace), []);
}

/** Build an absolute invite/share URL. */
export function absoluteUrl(hashPath: string): string {
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "/";
  return `${base}#${hashPath.startsWith("/") ? hashPath : "/" + hashPath}`;
}

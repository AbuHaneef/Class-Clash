"use client";

import { useEffect, useState, useCallback } from "react";

export type Route = { path: string; segments: string[] };

function parse(): Route {
  const raw = typeof window !== "undefined"
    ? window.location.hash.replace(/^#/, "") || "/"
    : "/";
  const path = raw.split("?")[0] || "/";
  return { path, segments: path.split("/").filter(Boolean) };
}

export function navigate(to: string, replace = false) {
  const target = `#${to.startsWith("/") ? to : "/" + to}`;
  if (typeof window !== "undefined") {
    if (replace) window.history.replaceState(null, "", target);
    else window.location.hash = target;
    if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function useNavigate() {
  return useCallback((to: string, replace = false) => navigate(to, replace), []);
}

/** Build an absolute invite/share URL that survives the sandbox gateway. */
export function absoluteUrl(hashPath: string): string {
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "/";
  return `${base}#${hashPath.startsWith("/") ? hashPath : "/" + hashPath}`;
}

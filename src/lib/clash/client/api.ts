"use client";

// Typed fetch wrapper for the ClassClash API.
export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/clash${path}`, { credentials: "same-origin" });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: "Network error — check your connection and retry." };
  }
}

export async function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/clash${path}`, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: "Network error — check your connection and retry." };
  }
}

export function localDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

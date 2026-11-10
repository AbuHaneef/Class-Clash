import { NextRequest, NextResponse } from "next/server";

// ── API error & wrapper ──────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data as Record<string, unknown>, init);
}

export function ok<T extends object>(data: T) {
  return NextResponse.json({ ok: true, ...data });
}

export function fail(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  }
  console.error("[clash-api]", e);
  return NextResponse.json(
    { ok: false, error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

export async function readBody<T = Record<string, unknown>>(
  req: NextRequest
): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid request body.");
  }
}

export function requireString(
  body: Record<string, unknown>,
  field: string,
  opts?: { min?: number; max?: number }
): string {
  const v = body[field];
  if (typeof v !== "string" || !v.trim())
    throw new ApiError(400, `Field "${field}" is required.`);
  const s = v.trim();
  if (opts?.min && s.length < opts.min)
    throw new ApiError(400, `"${field}" must be at least ${opts.min} characters.`);
  if (opts?.max && s.length > opts.max)
    throw new ApiError(400, `"${field}" must be at most ${opts.max} characters.`);
  return s;
}

export function requireInt(
  body: Record<string, unknown>,
  field: string,
  opts?: { min?: number; max?: number }
): number {
  const v = body[field];
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) throw new ApiError(400, `Field "${field}" must be a number.`);
  if (opts?.min !== undefined && n < opts.min)
    throw new ApiError(400, `"${field}" must be ≥ ${opts.min}.`);
  if (opts?.max !== undefined && n > opts.max)
    throw new ApiError(400, `"${field}" must be ≤ ${opts.max}.`);
  return n;
}

// ── In-memory rate limiter (per server process) ──────────────

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) {
    const wait = Math.ceil((b.reset - now) / 1000);
    throw new ApiError(429, `Too many requests. Try again in ${wait}s.`);
  }
  // opportunistic cleanup
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
}

export function clientKey(req: NextRequest, scope: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  return `${scope}:${ip}`;
}

// ── JSON helpers for SQLite string columns ───────────────────

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// ── Dates ────────────────────────────────────────────────────

export function todayStr(d = new Date()): string {
  // client-supplied local dates are used for streaks/missions; default UTC
  return d.toISOString().slice(0, 10);
}

export function isValidDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

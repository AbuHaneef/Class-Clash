import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError } from "./api";

export const SESSION_COOKIE = "clash_session";
const SESSION_DAYS = 30;

// ── Passwords (scrypt) ───────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

// ── Sessions ─────────────────────────────────────────────────

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createAuthSession(userId: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.authSession.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function destroyAuthSession(token: string) {
  await db.authSession.deleteMany({ where: { token } });
}

export async function getUserFromRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.authSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.suspendedUntil && session.user.suspendedUntil > new Date())
    throw new ApiError(403, "Your account is temporarily restricted.");
  if (session.user.deletedAt) return null;
  return session.user;
}

export async function requireUser(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  return user;
}

export const ROLES = ["student", "teacher", "school_admin", "reviewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export async function requireRole(req: NextRequest, ...roles: Role[]) {
  const user = await requireUser(req);
  if (!roles.includes(user.role as Role))
    throw new ApiError(403, "You don't have permission to do that.");
  return user;
}

export async function requireAdmin(req: NextRequest) {
  return requireRole(req, "admin");
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  };
}

// ── Audit ────────────────────────────────────────────────────

export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  details?: string
) {
  await db.auditLog.create({
    data: { actorId, action, entity, entityId: entityId ?? null, details: details ?? null },
  });
}

// ── Misc ─────────────────────────────────────────────────────

export function shortCode(len = 6): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

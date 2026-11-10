import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, requireString, rateLimit, clientKey } from "@/lib/clash/server/api";
import { hashPassword, createAuthSession, SESSION_COOKIE, audit } from "@/lib/clash/server/auth";
import { validateDisplayName } from "@/lib/clash/game";

export async function POST(req: NextRequest) {
  try {
    rateLimit(clientKey(req, "register"), 5, 60_000);
    const body = await readBody(req);
    const email = requireString(body, "email", { min: 5, max: 120 }).toLowerCase();
    const password = requireString(body, "password", { min: 8, max: 72 });
    const displayName = requireString(body, "displayName", { min: 3, max: 16 });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.ok)
      return NextResponse.json({ ok: false, error: nameCheck.error }, { status: 400 });

    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail)
      return NextResponse.json({ ok: false, error: "That email is already registered. Try signing in." }, { status: 400 });
    const existingName = await db.user.findUnique({ where: { displayName } });
    if (existingName)
      return NextResponse.json({ ok: false, error: "That display name is taken. Try another!" }, { status: 400 });

    const user = await db.user.create({
      data: { email, passwordHash: hashPassword(password), displayName, onboarded: false },
    });
    const { token, expiresAt } = await createAuthSession(user.id);
    await audit(user.id, "register", "user", user.id);

    const res = ok({ userId: user.id });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return res;
  } catch (e) {
    return fail(e);
  }
}

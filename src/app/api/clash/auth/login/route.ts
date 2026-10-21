import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, requireString, rateLimit, clientKey } from "@/lib/clash/server/api";
import { verifyPassword, createAuthSession, SESSION_COOKIE } from "@/lib/clash/server/auth";

export async function POST(req: NextRequest) {
  try {
    rateLimit(clientKey(req, "login"), 10, 60_000);
    const body = await readBody(req);
    const email = requireString(body, "email").toLowerCase();
    const password = requireString(body, "password");

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash))
      return NextResponse.json({ ok: false, error: "Wrong email or password." }, { status: 401 });
    if (user.deletedAt)
      return NextResponse.json({ ok: false, error: "This account no longer exists." }, { status: 401 });
    if (user.suspendedUntil && user.suspendedUntil > new Date())
      return NextResponse.json(
        { ok: false, error: `Account restricted until ${user.suspendedUntil.toLocaleDateString()}.` },
        { status: 403 }
      );

    const { token, expiresAt } = await createAuthSession(user.id);
    const res = ok({ userId: user.id, onboarded: user.onboarded, role: user.role });
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

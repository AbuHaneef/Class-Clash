import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/clash/server/api";
import { destroyAuthSession, SESSION_COOKIE } from "@/lib/clash/server/auth";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) await destroyAuthSession(token);
    const res = ok({ bye: true });
    res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", expires: new Date(0) });
    return res;
  } catch (e) {
    return fail(e);
  }
}

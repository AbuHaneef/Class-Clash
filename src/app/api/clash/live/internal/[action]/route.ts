import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/clash/server/api";
import { liveAuth, liveStart, liveFinish, assertInternalKey } from "@/lib/clash/server/live";

// Internal endpoints for the live-duel socket service ONLY.
// Guarded by a shared secret header — never callable from browsers.
export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    assertInternalKey(req);
    const { action } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    switch (action) {
      case "auth":
        return ok(await liveAuth(body.token));
      case "start":
        return ok(await liveStart(body));
      case "finish":
        return ok(await liveFinish(body));
      default:
        return ok({ error: "Unknown action." });
    }
  } catch (e) {
    return fail(e);
  }
}

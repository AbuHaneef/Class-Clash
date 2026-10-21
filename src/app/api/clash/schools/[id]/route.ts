import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/clash/server/api";
import { getUserFromRequest } from "@/lib/clash/server/auth";
import { schoolDetail } from "@/lib/clash/server/schools";

// GET /api/clash/schools/[id] — school detail (members + recent form)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const me = await getUserFromRequest(req);
    return ok(await schoolDetail(id, me?.id ?? null));
  } catch (e) {
    return fail(e);
  }
}

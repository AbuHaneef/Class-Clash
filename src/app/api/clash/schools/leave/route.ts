import { NextRequest } from "next/server";
import { ok, fail, rateLimit } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { leaveSchool } from "@/lib/clash/server/schools";

// POST /api/clash/schools/leave — leave current school
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    rateLimit(`school-leave:${user.id}`, 8, 60_000);
    await leaveSchool(user.id);
    return ok({ left: true });
  } catch (e) {
    return fail(e);
  }
}

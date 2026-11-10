import { NextRequest } from "next/server";
import { ok, fail, readBody, requireString, rateLimit } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { joinSchool } from "@/lib/clash/server/schools";
import { notify } from "@/lib/clash/server/gamification";
import { db } from "@/lib/db";

// POST /api/clash/schools/join — join with a code
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    rateLimit(`school-join:${user.id}`, 8, 60_000);
    const body = await readBody(req);
    const code = requireString(body, "code", { min: 4, max: 8 });
    const school = await joinSchool(user, code);

    // tell the founder (quietly) — nice touch, cheap
    if (school.creatorId && school.creatorId !== user.id) {
      const members = await db.user.count({ where: { schoolId: school.id, deletedAt: null } });
      if (members <= 25) {
        await notify(
          school.creatorId,
          "system",
          `${user.displayName} joined ${school.name}`,
          `Your school now has ${members} member${members === 1 ? "" : "s"} in the league.`,
          "/#/leagues"
        );
      }
    }
    return ok({ school });
  } catch (e) {
    return fail(e);
  }
}

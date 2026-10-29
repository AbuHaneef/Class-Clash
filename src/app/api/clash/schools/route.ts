import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, requireString, rateLimit } from "@/lib/clash/server/api";
import { getUserFromRequest, requireUser } from "@/lib/clash/server/auth";
import { createSchool, leagueTable, SCHOOL_COLORS } from "@/lib/clash/server/schools";

// GET /api/clash/schools — league table (public) + my school
export async function GET(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    const table = await leagueTable(me?.id ?? null);

    let mySchool: {
      id: string; name: string; motto: string | null; color: string; joinCode: string;
      memberCount: number; totalPoints: number; crowns: number; rank: number | null;
      topContributor: { displayName: string; avatar: string; points: number } | null; demoSquad: boolean;
    } | null = null;
    if (me?.schoolId) {
      const s = await db.school.findUnique({ where: { id: me.schoolId } });
      if (s) {
        const row = table.find((r) => r.id === s.id);
        mySchool = {
          id: s.id,
          name: s.name,
          motto: s.motto,
          color: s.color,
          joinCode: s.joinCode,
          memberCount: row?.memberCount ?? 0,
          totalPoints: row?.totalPoints ?? 0,
          crowns: row?.crowns ?? 0,
          rank: row?.rank ?? null,
          topContributor: row?.topContributor ?? null,
          demoSquad: row?.demoSquad ?? false,
        };
      }
    }
    return ok({ table, mySchool, colors: SCHOOL_COLORS });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/clash/schools — create a school
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    rateLimit(`school-create:${user.id}`, 3, 60_000);
    const body = await readBody(req);
    const name = requireString(body, "name", { min: 4, max: 40 });
    const school = await createSchool(user, {
      name,
      motto: typeof body.motto === "string" ? body.motto : undefined,
      color: typeof body.color === "string" ? body.color : undefined,
    });
    return ok({ school });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { ok, fail, readBody, todayStr } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { claimMission } from "@/lib/clash/server/gamification";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await readBody(req);
    const missionCode = String(body.missionCode ?? "");
    const localDate =
      typeof body.localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate)
        ? body.localDate
        : todayStr();
    const result = await claimMission(user.id, missionCode, localDate);
    return ok({ awarded: result.awarded, levelUp: result.levelUp, newLevel: result.newLevel });
  } catch (e) {
    return fail(e);
  }
}

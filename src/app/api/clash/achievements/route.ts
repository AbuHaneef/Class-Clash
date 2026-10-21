import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";

// Badge cabinet + today's mission progress.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const today = new Date().toISOString().slice(0, 10);
    const [badges, mine, missions, myMissions] = await Promise.all([
      db.badge.findMany({ orderBy: { sort: "asc" } }),
      db.userBadge.findMany({ where: { userId: user.id }, include: { badge: true } }),
      db.mission.findMany({ where: { active: true } }),
      db.userMission.findMany({ where: { userId: user.id, date: today } }),
    ]);
    const earnedMap = new Map(mine.map((m) => [m.badgeId, m.earnedAt]));
    const missionMap = new Map(myMissions.map((m) => [m.missionCode, m]));

    return ok({
      badges: badges.map((b) => ({
        code: b.code,
        name: b.name,
        description: b.description,
        icon: b.icon,
        color: b.color,
        earned: earnedMap.has(b.id),
        earnedAt: earnedMap.get(b.id) ?? null,
      })),
      missions: missions.map((m) => {
        const um = missionMap.get(m.code);
        return {
          code: m.code,
          name: m.name,
          description: m.description,
          icon: m.icon,
          target: m.target,
          xpReward: m.xpReward,
          progress: um?.progress ?? 0,
          completed: um?.completed ?? false,
          claimed: um?.claimed ?? false,
        };
      }),
    });
  } catch (e) {
    return fail(e);
  }
}

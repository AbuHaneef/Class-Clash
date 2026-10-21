import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { getUserFromRequest } from "@/lib/clash/server/auth";
import { levelProgress } from "@/lib/clash/game";

// Leaderboards: rating | xp | season — real students only (no demo/bots).
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "rating";
    const gradeId = url.searchParams.get("gradeId");
    const subjectId = url.searchParams.get("subjectId");
    const me = await getUserFromRequest(req);

    const whereBase = {
      onboarded: true,
      isBot: false,
      isDemo: false,
      deletedAt: null,
      role: "student" as const,
      ...(gradeId ? { gradeId } : {}),
    };

    let entries: {
      id: string;
      displayName: string;
      avatar: string;
      value: number;
      sub: string;
      level: number;
      gradeName: string | null;
    }[] = [];

    if (type === "rating") {
      const users = await db.user.findMany({
        where: { ...whereBase, rating: { gt: 0 } },
        orderBy: [{ rating: "desc" }, { xp: "desc" }],
        take: 50,
        include: { grade: true },
      });
      entries = users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatar: u.avatar,
        value: u.rating,
        sub: `${u.seasonPoints} season pts`,
        level: levelProgress(u.xp).level,
        gradeName: u.grade?.name ?? null,
      }));
    } else if (type === "xp") {
      const users = await db.user.findMany({
        where: { ...whereBase, xp: { gt: 0 } },
        orderBy: [{ xp: "desc" }, { rating: "desc" }],
        take: 50,
        include: { grade: true },
      });
      entries = users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatar: u.avatar,
        value: u.xp,
        sub: `Rating ${u.rating}`,
        level: levelProgress(u.xp).level,
        gradeName: u.grade?.name ?? null,
      }));
    } else if (type === "subject" && subjectId) {
      // Subject mastery: competitive points from match records in this subject
      const matches = await db.matchRecord.findMany({
        where: { challenge: { subjectId } },
        include: { user: { include: { grade: true } } },
        take: 500,
        orderBy: { createdAt: "desc" },
      });
      const agg = new Map<
        string,
        { displayName: string; avatar: string; wins: number; games: number; gradeName: string | null; xp: number }
      >();
      for (const m of matches) {
        if (m.user.isBot || m.user.isDemo) continue;
        const cur = agg.get(m.userId) ?? {
          displayName: m.user.displayName,
          avatar: m.user.avatar,
          wins: 0,
          games: 0,
          gradeName: m.user.grade?.name ?? null,
          xp: m.user.xp,
        };
        cur.games++;
        if (m.result === "win") cur.wins++;
        agg.set(m.userId, cur);
      }
      entries = [...agg.entries()]
        .sort((a, b) => b[1].wins - a[1].wins || b[1].games - a[1].games)
        .slice(0, 50)
        .map(([id, v]) => ({
          id,
          displayName: v.displayName,
          avatar: v.avatar,
          value: v.wins,
          sub: `${v.wins}W / ${v.games} matches`,
          level: levelProgress(v.xp).level,
          gradeName: v.gradeName,
        }));
    } else {
      // season
      const users = await db.user.findMany({
        where: { ...whereBase, seasonPoints: { gt: 0 } },
        orderBy: [{ seasonPoints: "desc" }, { rating: "desc" }],
        take: 50,
        include: { grade: true },
      });
      entries = users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatar: u.avatar,
        value: u.seasonPoints,
        sub: `Rating ${u.rating}`,
        level: levelProgress(u.xp).level,
        gradeName: u.grade?.name ?? null,
      }));
    }

    return ok({
      type,
      entries,
      myRank: me ? entries.findIndex((e) => e.id === me.id) + 1 || null : null,
    });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { levelProgress } from "@/lib/clash/game";

// Eligible duel opponents: real, onboarded classmates (same grade).
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user.gradeId) return ok({ classmates: [], rivals: [] });
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    const classmates = await db.user.findMany({
      where: {
        gradeId: user.gradeId,
        onboarded: true,
        isBot: false,
        deletedAt: null,
        id: { not: user.id },
        ...(q ? { displayName: { contains: q } } : {}),
      },
      include: { grade: true, champions: true },
      take: 30,
    });

    const rivals = await db.rivalry.findMany({
      where: { userId: user.id },
      include: { rival: true },
    });
    const rivalIds = new Set(rivals.map((r) => r.rivalId));

    return ok({
      classmates: classmates.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        avatar: c.avatar,
        rating: c.rating,
        level: levelProgress(c.xp).level,
        streak: c.streakCount,
        titles: c.champions.length,
        isRival: rivalIds.has(c.id),
      })),
      rivals: rivals.map((r) => ({
        id: r.rival.id,
        displayName: r.rival.displayName,
        avatar: r.rival.avatar,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { getUserFromRequest } from "@/lib/clash/server/auth";
import { meUser } from "@/lib/clash/server/sanitize";
import { levelProgress } from "@/lib/clash/game";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return ok({ user: null });
    const me = meUser(
      await db.user.findUnique({ where: { id: user.id }, include: { grade: true } }) ?? user
    );
    const unread = await db.notification.count({ where: { userId: user.id, read: false } });
    const myChampions = await db.champion.count({ where: { userId: user.id } });
    return ok({ user: { ...me, levelInfo: levelProgress(user.xp), unread, titles: myChampions } });
  } catch (e) {
    return fail(e);
  }
}

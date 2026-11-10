import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireUser, shortCode } from "@/lib/clash/server/auth";

// Create a share link for an achievement moment (badge / champion / result).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    rateLimit(`share:${user.id}`, 10, 60_000);
    const body = await readBody(req);
    const type = ["badge", "champion", "result", "level"].includes(String(body.type))
      ? String(body.type)
      : "result";
    const refId = typeof body.refId === "string" ? body.refId.slice(0, 64) : null;

    let title = "ClassClash";
    let subtitle = "";
    if (type === "badge" && refId) {
      const badge = await db.badge.findUnique({ where: { code: refId } });
      if (badge) {
        const earned = await db.userBadge.findFirst({
          where: { userId: user.id, badgeId: badge.id },
        });
        if (!earned) return ok({ error: "You haven't earned that badge yet." });
        title = `${badge.name} unlocked!`;
        subtitle = badge.description;
      }
    } else if (type === "champion") {
      const titles = await db.champion.count({ where: { userId: user.id } });
      if (titles === 0) return ok({ error: "Win a championship first!" });
      title = "Champion! 🏆";
      subtitle = `${user.displayName} holds ${titles} ClassClash title${titles > 1 ? "s" : ""}`;
    } else if (type === "result" && refId) {
      const session = await db.quizSession.findFirst({
        where: { id: refId, userId: user.id, status: "completed" },
        include: { subject: true },
      });
      if (!session) return ok({ error: "Result not found." });
      title = `${session.correctCount}/${session.totalCount} in ${session.subject.name}`;
      subtitle = `Score ${session.score} pts on ClassClash`;
    } else if (type === "level") {
      title = `Level up! ${user.displayName}`;
      subtitle = "Climbing the ClassClash ranks";
    }

    const token = shortCode(8);
    await db.shareLink.create({ data: { token, userId: user.id, type, refId } });
    return ok({ token, title, subtitle });
  } catch (e) {
    return fail(e);
  }
}

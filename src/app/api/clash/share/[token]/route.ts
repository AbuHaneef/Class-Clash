import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { levelProgress } from "@/lib/clash/game";

// Public share-card data — safe fields only, no email or private info.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const link = await db.shareLink.findUnique({
      where: { token },
      include: { user: { include: { grade: true } } },
    });
    if (!link || link.user.deletedAt)
      return Response.json({ ok: false, error: "Share link not found." }, { status: 404 });
    const user = link.user;

    let title = "ClassClash";
    let subtitle = "";
    if (link.type === "badge" && link.refId) {
      const badge = await db.badge.findUnique({ where: { code: link.refId } });
      if (badge) {
        title = `${badge.name} unlocked!`;
        subtitle = badge.description;
      }
    } else if (link.type === "champion") {
      const titles = await db.champion.count({ where: { userId: user.id } });
      title = "Champion! 🏆";
      subtitle = `${user.displayName} holds ${titles} ClassClash title${titles > 1 ? "s" : ""}`;
    } else if (link.type === "result" && link.refId) {
      const session = await db.quizSession.findFirst({
        where: { id: link.refId, status: "completed" },
        include: { subject: true },
      });
      if (session) {
        title = `${session.correctCount}/${session.totalCount} in ${session.subject.name}`;
        subtitle = `Score ${session.score} pts on ClassClash`;
      }
    } else if (link.type === "level") {
      title = `Level up!`;
      subtitle = `${user.displayName} reached level ${levelProgress(user.xp).level}`;
    }

    const titlesCount = await db.champion.count({ where: { userId: user.id } });
    return ok({
      share: {
        type: link.type,
        title,
        subtitle,
        createdAt: link.createdAt,
        player: {
          displayName: user.displayName,
          avatar: user.avatar,
          gradeName: user.grade?.name ?? null,
          level: user.isBot ? null : levelProgress(user.xp).level,
          titles: titlesCount,
        },
      },
    });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { getUserFromRequest, requireUser } from "@/lib/clash/server/auth";
import { levelProgress } from "@/lib/clash/game";

// Public profile — safe fields only (no email, no private data).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const me = await getUserFromRequest(req);
    const user = await db.user.findUnique({
      where: { id },
      include: { grade: true, champions: { include: { subject: true, grade: true } } },
    });
    if (!user || user.deletedAt)
      return Response.json({ ok: false, error: "Profile not found." }, { status: 404 });

    const [badges, matches, sessions] = await Promise.all([
      db.userBadge.findMany({
        where: { userId: id },
        include: { badge: true },
        orderBy: { earnedAt: "desc" },
      }),
      db.matchRecord.findMany({
        where: { userId: id },
        include: { opponent: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.quizSession.count({ where: { userId: id, status: "completed" } }),
    ]);

    const wins = await db.matchRecord.count({ where: { userId: id, result: "win" } });
    const losses = await db.matchRecord.count({ where: { userId: id, result: "loss" } });
    const draws = await db.matchRecord.count({ where: { userId: id, result: "draw" } });

    const answered = await db.questionAttempt.count({ where: { quizSession: { userId: id } } });
    const correct = await db.questionAttempt.count({
      where: { quizSession: { userId: id }, isCorrect: true },
    });

    const isMe = me?.id === id;

    return ok({
      profile: {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        isBot: user.isBot,
        isMe,
        gradeName: user.grade?.name ?? null,
        level: user.isBot ? null : levelProgress(user.xp).level,
        levelTitle: user.isBot ? "Guardian bot" : levelProgress(user.xp).title,
        xp: user.isBot ? null : user.xp,
        rating: user.isBot ? null : user.rating,
        streak: user.isBot ? null : user.streakCount,
        joined: user.createdAt,
        titles: user.champions.map((c) => ({
          gradeId: c.gradeId,
          subjectId: c.subjectId,
          subjectName: c.subject.name,
          gradeName: c.grade.name,
          wonAt: c.wonAt,
          defences: c.defences,
        })),
        badges: badges.map((b) => ({
          code: b.badge.code,
          name: b.badge.name,
          icon: b.badge.icon,
          color: b.badge.color,
          earnedAt: b.earnedAt,
        })),
        record: { wins, losses, draws, quizzesCompleted: sessions, answered, accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0 },
        recentMatches: matches.map((m) => ({
          id: m.id,
          type: m.type,
          result: m.result,
          score: m.score,
          opponentScore: m.opponentScore,
          opponentName: m.opponent.displayName,
          opponentAvatar: m.opponent.avatar,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireUser(req);
    if (me.id !== id && me.role !== "admin")
      return Response.json({ ok: false, error: "Not allowed." }, { status: 403 });
    await db.user.update({ where: { id }, data: { deletedAt: new Date() } });
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}

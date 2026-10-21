import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { parseJson } from "@/lib/clash/server/api";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user.gradeId) return ok({ daily: null, message: "Set up your class first." });
    const date = new Date().toISOString().slice(0, 10);

    let daily = await db.dailyChallenge.findUnique({
      where: { date_gradeId: { date, gradeId: user.gradeId } },
      include: { subject: true },
    });
    // Lazily materialize today's set so it exists for everyone in the grade
    if (!daily) {
      const { pickQuestionIds } = await import("@/lib/clash/server/quiz");
      const subjectGrades = await db.subjectGrade.findMany({
        where: { gradeId: user.gradeId },
        include: { subject: { select: { id: true, order: true, name: true } } },
      });
      if (subjectGrades.length === 0) return ok({ daily: null, message: "No subjects for your class yet." });
      const sorted = subjectGrades.sort((a, b) => a.subject.order - b.subject.order);
      const dayNum = Math.floor(new Date(date + "T12:00:00Z").getTime() / 86400000);
      const subject = sorted[dayNum % sorted.length].subject;
      const count = Number((await db.platformConfig.findUnique({ where: { key: "dailyQuestions" } }))?.value ?? 5);
      const ids = await pickQuestionIds(user.gradeId, subject.id, { count });
      if (ids.length === 0) return ok({ daily: null, message: "Daily challenge isn't ready yet." });
      daily = await db.dailyChallenge.create({
        data: { date, gradeId: user.gradeId, subjectId: subject.id, questionIds: JSON.stringify(ids) },
        include: { subject: true },
      });
    }

    const myEntry = await db.dailyEntry.findFirst({
      where: { dailyChallengeId: daily.id, userId: user.id },
      include: { quizSession: true },
    });
    const entries = await db.dailyEntry.findMany({
      where: { dailyChallengeId: daily.id },
      include: { user: true },
      orderBy: [{ score: "desc" }, { totalTimeMs: "asc" }],
      take: 20,
    });

    return ok({
      daily: {
        id: daily.id,
        date: daily.date,
        subject: { id: daily.subject.id, name: daily.subject.name, color: daily.subject.color, icon: daily.subject.icon },
        questionCount: parseJson<string[]>(daily.questionIds, []).length,
        myEntry: myEntry
          ? {
              score: myEntry.score,
              correctCount: myEntry.correctCount,
              sessionId: myEntry.quizSessionId,
              sessionStatus: myEntry.quizSession.status,
            }
          : null,
        leaderboard: entries.map((e, i) => ({
          rank: i + 1,
          id: e.user.id,
          displayName: e.user.displayName,
          avatar: e.user.avatar,
          score: e.score,
          correctCount: e.correctCount,
          timeMs: e.totalTimeMs,
          isMe: e.userId === user.id,
        })),
      },
    });
  } catch (e) {
    return fail(e);
  }
}

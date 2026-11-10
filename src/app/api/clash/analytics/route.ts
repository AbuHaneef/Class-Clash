import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";

// Learning analytics — computed from real attempt records only.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const attempts = await db.questionAttempt.findMany({
      where: { quizSession: { userId: user.id } },
      include: {
        question: { include: { subject: true, topic: true } },
        quizSession: { select: { mode: true, startedAt: true, subjectId: true, score: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });

    // By subject
    const subjectAgg = new Map<string, { name: string; color: string; icon: string; correct: number; total: number }>();
    // By topic
    const topicAgg = new Map<string, { name: string; subject: string; correct: number; total: number }>();
    for (const a of attempts) {
      const s = subjectAgg.get(a.question.subjectId) ?? {
        name: a.question.subject.name,
        color: a.question.subject.color,
        icon: a.question.subject.icon,
        correct: 0,
        total: 0,
      };
      s.total++;
      if (a.isCorrect) s.correct++;
      subjectAgg.set(a.question.subjectId, s);

      const t = topicAgg.get(a.question.topicId) ?? {
        name: a.question.topic.name,
        subject: a.question.subject.name,
        correct: 0,
        total: 0,
      };
      t.total++;
      if (a.isCorrect) t.correct++;
      topicAgg.set(a.question.topicId, t);
    }

    // Progress over time: daily accuracy for last 14 active days
    const byDay = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      const day = a.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(day) ?? { correct: 0, total: 0 };
      cur.total++;
      if (a.isCorrect) cur.correct++;
      byDay.set(day, cur);
    }
    const progress = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, v]) => ({ date, accuracy: Math.round((v.correct / v.total) * 100), answered: v.total }));

    // Recent sessions history
    const sessions = await db.quizSession.findMany({
      where: { userId: user.id, status: "completed" },
      include: { subject: true },
      orderBy: { completedAt: "desc" },
      take: 15,
    });

    const strongest = [...topicAgg.values()]
      .filter((t) => t.total >= 3)
      .map((t) => ({ ...t, accuracy: Math.round((t.correct / t.total) * 100) }))
      .sort((a, b) => b.accuracy - a.accuracy);
    const weakest = [...strongest].reverse();

    const totalAnswered = attempts.length;
    const totalCorrect = attempts.filter((a) => a.isCorrect).length;

    // Personal bests per subject
    const bests = await db.quizSession.groupBy({
      by: ["subjectId"],
      where: { userId: user.id, status: "completed" },
      _max: { score: true },
    });
    const subjectNames = new Map([...subjectAgg.entries()].map(([id, v]) => [id, v.name]));

    return ok({
      analytics: {
        totalAnswered,
        totalCorrect,
        overallAccuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
        sampleSize: totalAnswered,
        smallSample: totalAnswered < 20,
        subjects: [...subjectAgg.entries()].map(([id, v]) => ({
          id,
          name: v.name,
          color: v.color,
          icon: v.icon,
          accuracy: Math.round((v.correct / v.total) * 100),
          answered: v.total,
          best: bests.find((b) => b.subjectId === id)?._max.score ?? null,
        })),
        strongest: strongest.slice(0, 3),
        weakest: weakest.slice(0, 3),
        progress,
        sessions: sessions.map((s) => ({
          id: s.id,
          subjectName: s.subject.name,
          subjectColor: s.subject.color,
          mode: s.mode,
          score: s.score,
          correctCount: s.correctCount,
          totalCount: s.totalCount,
          completedAt: s.completedAt,
        })),
      },
    });
  } catch (e) {
    return fail(e);
  }
}

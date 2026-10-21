import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { getUserFromRequest } from "@/lib/clash/server/auth";

// Subject detail for a grade: topics with question counts, champion, my stats.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const gradeId = url.searchParams.get("gradeId");
    const me = await getUserFromRequest(req);
    const myGradeId = gradeId ?? me?.gradeId ?? null;

    const subject = await db.subject.findUnique({ where: { id } });
    if (!subject)
      return Response.json({ ok: false, error: "Subject not found." }, { status: 404 });

    const grades = await db.subjectGrade.findMany({
      where: { subjectId: id },
      include: { grade: true },
    });
    if (grades.length === 0)
      return ok({ subject: null, message: "This subject isn't available yet." });

    const activeGradeId =
      myGradeId && grades.some((g) => g.gradeId === myGradeId) ? myGradeId : grades[0].gradeId;
    const activeGrade = grades.find((g) => g.gradeId === activeGradeId)!.grade;

    const topics = await db.topic.findMany({
      where: { subjectId: id },
      orderBy: { order: "asc" },
    });
    const topicCounts = await db.question.groupBy({
      by: ["topicId"],
      where: { subjectId: id, gradeId: activeGradeId, status: "published" },
      _count: { id: true },
    });
    const countMap = new Map(topicCounts.map((t) => [t.topicId, t._count.id]));

    const champion = await db.champion.findUnique({
      where: { gradeId_subjectId: { gradeId: activeGradeId, subjectId: id } },
      include: { user: true },
    });

    // my recent accuracy for this subject (real data only)
    let myStats: { answered: number; correct: number; accuracy: number; bestScore: number | null } | null = null;
    if (me) {
      const attempts = await db.questionAttempt.count({
        where: { quizSession: { userId: me.id, subjectId: id }, question: { subjectId: id } },
      });
      const correct = await db.questionAttempt.count({
        where: { quizSession: { userId: me.id, subjectId: id }, question: { subjectId: id }, isCorrect: true },
      });
      const best = await db.quizSession.findFirst({
        where: { userId: me.id, subjectId: id, status: "completed" },
        orderBy: { score: "desc" },
      });
      myStats = {
        answered: attempts,
        correct,
        accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
        bestScore: best?.score ?? null,
      };
    }

    return ok({
      subject: {
        id: subject.id,
        name: subject.name,
        slug: subject.slug,
        icon: subject.icon,
        color: subject.color,
        description: subject.description,
        grades: grades.map((g) => ({ id: g.grade.id, name: g.grade.name, hasContent: g.grade.hasContent })),
        activeGrade: { id: activeGrade.id, name: activeGrade.name },
        topics: topics.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          questionCount: countMap.get(t.id) ?? 0,
        })),
        totalQuestions: [...countMap.values()].reduce((a, b) => a + b, 0),
        champion: champion
          ? {
              userId: champion.user.id,
              displayName: champion.user.displayName,
              avatar: champion.user.avatar,
              isBot: champion.user.isBot,
              wonAt: champion.wonAt,
              defences: champion.defences,
            }
          : null,
        myStats,
        iAmChampion: me ? champion?.userId === me.id : false,
      },
    });
  } catch (e) {
    return fail(e);
  }
}

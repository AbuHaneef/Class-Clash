import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { sanitizeQuestion } from "@/lib/clash/server/sanitize";
import { fetchQuestionsWithMeta } from "@/lib/clash/server/quiz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    const session = await db.quizSession.findUnique({
      where: { id },
      include: { attempts: true, subject: true },
    });
    if (!session || session.userId !== user.id)
      return Response.json({ ok: false, error: "Quiz session not found." }, { status: 404 });

    const qIds = parseJson<string[]>(session.questionIds, []);
    const questions = await fetchQuestionsWithMeta(qIds);
    const topic = session.topicId
      ? await db.topic.findUnique({ where: { id: session.topicId } })
      : null;

    // For in-progress sessions: hide answers for already-answered questions in
    // competitive modes; practice shows its own feedback via the answer call.
    return ok({
      session: {
        id: session.id,
        mode: session.mode,
        status: session.status,
        subjectId: session.subjectId,
        subjectName: session.subject.name,
        topicName: topic?.name ?? null,
        totalCount: session.totalCount,
        currentIndex: session.currentIndex,
        score: session.score,
        correctCount: session.correctCount,
        timeLimitPer: session.timeLimitPer,
        startedAt: session.startedAt,
        answeredQuestionIds: session.attempts.map((a) => a.questionId),
      },
      questions: questions.map((q) => sanitizeQuestion(q)),
    });
  } catch (e) {
    return fail(e);
  }
}

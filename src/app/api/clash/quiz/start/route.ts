import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { startQuizSession } from "@/lib/clash/server/quiz";
import { sanitizeQuestion } from "@/lib/clash/server/sanitize";
import { fetchQuestionsWithMeta } from "@/lib/clash/server/quiz";
import { rateLimit } from "@/lib/clash/server/api";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    rateLimit(`quiz-start:${user.id}`, 8, 60_000);
    const body = await readBody2(req);
    const session = await startQuizSession(user, {
      mode: String(body.mode ?? "practice"),
      subjectId: body.subjectId ? String(body.subjectId) : undefined,
      topicId: body.topicId ? String(body.topicId) : undefined,
      difficulty: body.difficulty ? String(body.difficulty) : undefined,
      count: body.count ? Number(body.count) : undefined,
      challengeId: body.challengeId ? String(body.challengeId) : undefined,
    });
    const questions = await fetchQuestionsWithMeta(parseJson<string[]>(session.questionIds, []));
    return ok({
      sessionId: session.id,
      mode: session.mode,
      timeLimitPer: session.timeLimitPer,
      currentIndex: session.currentIndex,
      questions: questions.map((q) => sanitizeQuestion(q)),
    });
  } catch (e) {
    return fail(e);
  }
}

async function readBody2(req: NextRequest) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

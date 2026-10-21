import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit, clientKey } from "@/lib/clash/server/api";

// Guest demo answer check — validates server-side, saves nothing.
export async function POST(req: NextRequest) {
  try {
    rateLimit(clientKey(req, "guest-answer"), 60, 60_000);
    const body = await readBody(req);
    const questionId = String(body.questionId ?? "");
    const optionId = typeof body.optionId === "string" ? body.optionId : null;
    const question = await db.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!question)
      return Response.json({ ok: false, error: "Question not found." }, { status: 404 });
    const options = [...question.options].sort((a, b) => a.order - b.order);
    const correctIndex = options.findIndex((o) => o.isCorrect);
    const chosen = options.findIndex((o) => o.id === optionId);
    const isCorrect = chosen >= 0 && options[chosen]?.isCorrect === true;
    return ok({
      correct: isCorrect,
      correctIndex,
      explanation: question.explanation,
    });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { answerQuestion } from "@/lib/clash/server/quiz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    rateLimit(`answer:${user.id}`, 150, 60_000);
    const body = await readBody(req);
    const result = await answerQuestion(user.id, id, {
      questionId: String(body.questionId ?? ""),
      optionId: typeof body.optionId === "string" && body.optionId ? body.optionId : null,
      timeSpentMs: Math.max(0, Number(body.timeSpentMs ?? 0)),
    });
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { ok, fail, readBody, rateLimit, todayStr } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { completeQuizSession } from "@/lib/clash/server/quiz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    rateLimit(`complete:${user.id}`, 12, 60_000);
    const body = await readBody(req);
    const localDate =
      typeof body.localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate)
        ? body.localDate
        : todayStr();
    const result = await completeQuizSession(user.id, id, localDate);
    return ok({ result });
  } catch (e) {
    return fail(e);
  }
}

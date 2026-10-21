import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit, requireString } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { audit } from "@/lib/clash/server/auth";

// Report a user or a question (confusing / incorrect / inappropriate).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    rateLimit(`report:${user.id}`, 5, 60_000);
    const body = await readBody(req);
    const targetType = body.targetType === "question" ? "question" : "user";
    const targetId = requireString(body, "targetId");
    const reason = requireString(body, "reason", { min: 3, max: 120 });
    const details = typeof body.details === "string" ? body.details.slice(0, 500) : null;

    if (targetType === "user") {
      const target = await db.user.findUnique({ where: { id: targetId } });
      if (!target) return ok({ error: "Reported user not found." });
    } else {
      const target = await db.question.findUnique({ where: { id: targetId } });
      if (!target) return ok({ error: "Reported question not found." });
    }

    await db.report.create({ data: { reporterId: user.id, targetType, targetId, reason, details } });
    await audit(user.id, "report", targetType, targetId, reason);
    return ok({ reported: true });
  } catch (e) {
    return fail(e);
  }
}

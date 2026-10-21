import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireRole, audit } from "@/lib/clash/server/auth";

// ── Admin/Reviewer: edit / publish / reject / archive a question ──
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireRole(req, "admin", "reviewer");
    rateLimit(`q-edit:${admin.id}`, 60, 60_000);
    const body = await readBody(req);
    const question = await db.question.findUnique({ where: { id }, include: { options: true } });
    if (!question) return Response.json({ ok: false, error: "Question not found." }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (typeof body.text === "string" && body.text.trim().length >= 8) {
      const normalized = body.text.toLowerCase().replace(/\s+/g, " ").trim();
      const dup = await db.question.findFirst({ where: { normalized, NOT: { id } } });
      if (dup) return ok({ error: "Another question already has this text." });
      data.text = body.text.trim();
      data.normalized = normalized;
    }
    if (typeof body.explanation === "string" && body.explanation.trim().length >= 5)
      data.explanation = body.explanation.trim();
    if (["easy", "medium", "hard"].includes(String(body.difficulty)))
      data.difficulty = String(body.difficulty);

    // Status transitions (audit-logged)
    if (["published", "rejected", "archived", "pending"].includes(String(body.status))) {
      const to = String(body.status);
      data.status = to;
      data.reviewNote = `${to} by ${admin.displayName}${typeof body.note === "string" ? ": " + body.note : ""}`;
      await audit(admin.id, `question.${to}`, "question", id, typeof body.note === "string" ? body.note : undefined);
    }

    // Replace options if provided (exactly one correct)
    if (Array.isArray(body.options) && body.options.length >= 2 && body.options.length <= 6) {
      const correct = body.options.filter((o: { isCorrect?: boolean }) => o?.isCorrect).length;
      if (correct !== 1) return ok({ error: "Mark exactly one correct option." });
      await db.questionOption.deleteMany({ where: { questionId: id } });
      let order = 0;
      for (const o of body.options) {
        order++;
        await db.questionOption.create({
          data: { questionId: id, text: String(o.text).trim(), isCorrect: Boolean(o.isCorrect), order },
        });
      }
    }

    await db.question.update({ where: { id }, data });
    return ok({ done: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireRole(req, "admin");
    await db.question.update({ where: { id }, data: { status: "archived" } });
    await audit(admin.id, "question.archive", "question", id);
    return ok({ archived: true });
  } catch (e) {
    return fail(e);
  }
}

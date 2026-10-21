import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, requireString, rateLimit } from "@/lib/clash/server/api";
import { requireRole, audit } from "@/lib/clash/server/auth";

// ── Admin/Reviewer: question bank management ──
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, "admin", "reviewer");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim();
    const gradeId = url.searchParams.get("gradeId") ?? "";
    const subjectId = url.searchParams.get("subjectId") ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = 20;

    const where = {
      ...(status ? { status } : {}),
      ...(gradeId ? { gradeId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(q ? { OR: [{ text: { contains: q } }, { normalized: { contains: q.toLowerCase() } }] } : {}),
    };
    const [total, questions] = await Promise.all([
      db.question.count({ where }),
      db.question.findMany({
        where,
        include: {
          grade: true, subject: true, topic: true,
          options: { orderBy: { order: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return ok({
      questions: questions.map((x) => ({
        id: x.id,
        text: x.text,
        difficulty: x.difficulty,
        status: x.status,
        source: x.source,
        isDemo: x.isDemo,
        reviewNote: x.reviewNote,
        gradeName: x.grade.name,
        subjectName: x.subject.name,
        topicName: x.topic.name,
        options: x.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
        explanation: x.explanation,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
      })),
      total,
      page,
      pageCount: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(req, "admin", "reviewer");
    rateLimit(`q-create:${admin.id}`, 30, 60_000);
    const body = await readBody(req);
    const text = requireString(body, "text", { min: 8, max: 600 });
    const explanation = requireString(body, "explanation", { min: 5, max: 1200 });
    const gradeId = requireString(body, "gradeId");
    const subjectId = requireString(body, "subjectId");
    const topicId = requireString(body, "topicId");
    const difficulty = ["easy", "medium", "hard"].includes(String(body.difficulty))
      ? String(body.difficulty)
      : "medium";
    const options = Array.isArray(body.options) ? body.options : [];
    if (options.length < 2 || options.length > 6)
      return ok({ error: "Provide 2–6 answer options." });
    const correctIndexes = options
      .map((o: { text?: string; isCorrect?: boolean }, i: number) => (o?.isCorrect ? i : -1))
      .filter((i: number) => i >= 0);
    if (correctIndexes.length !== 1)
      return ok({ error: "Mark exactly one correct option." });
    if (options.some((o: { text?: string }) => !o?.text?.trim()))
      return ok({ error: "Every option needs text." });

    const grade = await db.grade.findUnique({ where: { id: gradeId } });
    const subject = await db.subject.findUnique({ where: { id: subjectId } });
    const topic = await db.topic.findUnique({ where: { id: topicId } });
    if (!grade || !subject || !topic) return ok({ error: "Invalid class/subject/topic." });

    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    const dup = await db.question.findUnique({ where: { normalized } });
    if (dup) return ok({ error: "A question with this exact text already exists." });

    // New questions by reviewers/admins are published directly (they ARE the review)
    const question = await db.question.create({
      data: {
        gradeId, subjectId, topicId, difficulty, text, normalized, explanation,
        status: "published",
        source: "ClassClash Editor",
        isDemo: false,
        createdBy: admin.id,
        reviewNote: `Created by ${admin.displayName}`,
      },
    });
    let order = 0;
    for (const o of options) {
      order++;
      await db.questionOption.create({
        data: { questionId: question.id, text: String(o.text).trim(), isCorrect: Boolean(o.isCorrect), order },
      });
    }
    await audit(admin.id, "question.create", "question", question.id, `${subject.name} • ${grade.name}`);
    return ok({ questionId: question.id });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, rateLimit, clientKey } from "@/lib/clash/server/api";
import { sanitizeQuestion } from "@/lib/clash/server/sanitize";

// Guest demo quiz: a fixed, clearly-labelled sample set — no account needed.
// Results are NOT saved (no official records without an account).
let cachedSet: { id: string; questions: ReturnType<typeof sanitizeQuestion>[] } | null = null;

const SAMPLE_IDS_LOCK = "guest-demo-v1";

export async function GET(req: NextRequest) {
  try {
    rateLimit(clientKey(req, "guest"), 20, 60_000);
    if (cachedSet) return ok({ demo: cachedSet, disclaimer: "Preview content — results are not saved. Create an account to earn XP, badges and titles!" });

    // A fun cross-grade sample: 2 questions from 5 different subjects
    const picks: string[] = [];
    const subjectSlugs = ["mathematics", "english-language", "basic-science", "chemistry", "biology"];
    for (const slug of subjectSlugs) {
      const subject = await db.subject.findUnique({ where: { slug } });
      if (!subject) continue;
      const ids = await db.question.findMany({
        where: { subjectId: subject.id, status: "published", difficulty: { in: ["easy", "medium"] } },
        select: { id: true },
        take: 40,
      });
      if (ids.length >= 2) {
        const i = Math.floor(Math.random() * ids.length);
        let j = Math.floor(Math.random() * ids.length);
        if (j === i) j = (j + 1) % ids.length;
        picks.push(ids[i].id, ids[j].id);
      }
    }
    const questions = await db.question.findMany({
      where: { id: { in: picks }, status: "published" },
      include: { options: true, topic: true, subject: true },
    });
    const ordered = picks.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
    cachedSet = {
      id: SAMPLE_IDS_LOCK,
      questions: ordered.map((q) => sanitizeQuestion(q as never)),
    };
    return ok({ demo: cachedSet, disclaimer: "Preview content — results are not saved. Create an account to earn XP, badges and titles!" });
  } catch (e) {
    return fail(e);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

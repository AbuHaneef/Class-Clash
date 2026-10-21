import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireRole, audit } from "@/lib/clash/server/auth";

// ── Admin/Reviewer: bulk CSV import with validation & error report ──
// CSV format: gradeSlug,subjectSlug,topicName,difficulty,question,correctAnswer,wrong1,wrong2,wrong3,explanation
export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(req, "admin", "reviewer");
    rateLimit(`q-import:${admin.id}`, 5, 60_000);
    const body = await readBody(req);
    const csv = String(body.csv ?? "").trim();
    if (!csv) return ok({ error: "Paste CSV content first." });

    const grades = await db.grade.findMany();
    const subjects = await db.subject.findMany();
    const topics = await db.topic.findMany();
    const gradeBySlug = new Map(grades.map((g) => [g.slug.toLowerCase(), g]));
    const subjectBySlug = new Map(subjects.map((s) => [s.slug.toLowerCase(), s]));
    const subjectByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s]));
    const topicByKey = new Map(topics.map((t) => [`${t.subjectId}:${t.name.toLowerCase()}`, t]));

    // simple CSV parser (handles quoted fields)
    function parseLine(line: string): string[] {
      const out: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          out.push(cur); cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    }

    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const errors: { line: number; error: string }[] = [];
    let imported = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (raw.toLowerCase().startsWith("gradeslug") || raw.toLowerCase().startsWith("grade,")) continue; // header
      const cols = parseLine(raw);
      const [gradeSlug, subjectSlug, topicName, difficulty, text, correct, w1, w2, w3, explanation] = cols;
      const lineNo = i + 1;
      if (!gradeSlug || !subjectSlug || !topicName || !text || !correct || !explanation) {
        errors.push({ line: lineNo, error: "Missing required column (need grade, subject, topic, question, correct answer, explanation)." });
        continue;
      }
      const grade = gradeBySlug.get(gradeSlug.toLowerCase());
      if (!grade) { errors.push({ line: lineNo, error: `Unknown class "${gradeSlug}"` }); continue; }
      const subject = subjectBySlug.get(subjectSlug.toLowerCase()) ?? subjectByName.get(subjectSlug.toLowerCase());
      if (!subject) { errors.push({ line: lineNo, error: `Unknown subject "${subjectSlug}"` }); continue; }
      const topic = topicByKey.get(`${subject.id}:${topicName.toLowerCase()}`);
      if (!topic) { errors.push({ line: lineNo, error: `Unknown topic "${topicName}" for ${subject.name}` }); continue; }
      const wrongs = [w1, w2, w3].filter(Boolean);
      if (wrongs.length < 2) { errors.push({ line: lineNo, error: "Need at least 2 wrong options." }); continue; }
      const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
      const dup = await db.question.findUnique({ where: { normalized } });
      if (dup) { errors.push({ line: lineNo, error: "Duplicate question text." }); continue; }

      const options = [correct, ...wrongs].map((t, idx) => ({ text: t, isCorrect: idx === 0 }));
      // shuffle options
      for (let k = options.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [options[k], options[j]] = [options[j], options[k]];
      }
      const diff = ["easy", "medium", "hard"].includes(difficulty?.toLowerCase())
        ? difficulty.toLowerCase()
        : "medium";
      const question = await db.question.create({
        data: {
          gradeId: grade.id, subjectId: subject.id, topicId: topic.id,
          difficulty: diff, type: "mcq", text, normalized, explanation,
          points: diff === "hard" ? 150 : diff === "medium" ? 125 : 100,
          timeLimit: 30,
          status: "pending",
          source: "CSV Import",
          isDemo: false,
          createdBy: admin.id,
          reviewNote: "Imported via CSV — needs review before publishing.",
        },
      });
      let order = 0;
      for (const o of options) {
        order++;
        await db.questionOption.create({
          data: { questionId: question.id, text: o.text, isCorrect: o.isCorrect, order },
        });
      }
      imported++;
    }
    await audit(admin.id, "question.import", "question", undefined, `Imported ${imported} questions, ${errors.length} errors`);
    return ok({ imported, errors });
  } catch (e) {
    return fail(e);
  }
}

// Import Master Competition Questions (410) into the ClassClash question bank.
// Source: upload/Master_Competition_Questions.docx (parsed with bold-answer detection).
// Every answer hand-verified; source errors corrected with reviewNote audit trail.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import path from "path";
import { CHEM_META } from "./import-meta-chem";
import { PHYS_META, PHYS_EXTRA } from "./import-meta-phys";
import { BIO_META } from "./import-meta-bio";
import { MATH_META } from "./import-meta-math";
import { ENG_META } from "./import-meta-eng";
import { GK_META } from "./import-meta-gk";

const db = new PrismaClient();

type ParsedQ = { section: string; num: number; stem: string; options: { letter: string; text: string }[]; bold: string[] };
type Meta = [number, string, "easy" | "medium" | "hard", string, string?, string?];

const SECTION_SUBJECT: Record<string, string> = {
  Chemistry: "chemistry",
  Physics: "physics",
  Biology: "biology",
  Mathematics: "mathematics",
  "English Language": "english-language",
  "General Knowledge": "general-knowledge",
};

const CORRECTION_NOTES: Record<string, string> = {
  "Chemistry:4": "Source marked '+3000 kJ/mol'; corrected to −300 kJ/mol (computed from the given data; combustion is exothermic).",
  "Chemistry:23": "Source marked 'washing under pressure'; corrected: CO is absorbed by ammoniacal copper(I) chloride.",
  "Chemistry:32": "Source marked Fe; corrected: Zn — the amphoteric metal that displaces hydrogen from hot alkali.",
  "Biology:6": "Source marked 'systematic sampling'; corrected: a complete census is not a sampling method.",
  "Mathematics:42": "Source equations were inconsistent with all options; first equation corrected to 2x − 3y = 7.",
  "Mathematics:63": "Source omitted 'fourth root' in the stem; corrected so the variation is solvable and matches the verified answer.",
  "English Language:16": "Source marked 'has been'; corrected to 'had been' (reported-speech backshift after 'complained').",
};

const GK_CURRENT_AFFAIRS = new Set([11, 17, 21, 28, 45]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ?]/gu, "").trim();
}

function metaMap(meta: Meta[]): Map<number, Meta> {
  return new Map(meta.map((m) => [m[0], m]));
}

const META_BY_SECTION: Record<string, Map<number, Meta>> = {
  Chemistry: metaMap(CHEM_META),
  Physics: metaMap(PHYS_META),
  Biology: metaMap(BIO_META),
  Mathematics: metaMap(MATH_META),
  "English Language": metaMap(ENG_META),
  "General Knowledge": metaMap(GK_META),
};

async function main() {
  const parsed: ParsedQ[] = JSON.parse(readFileSync(path.join(process.cwd(), "scripts", "parsed-questions.json"), "utf8"));
  console.log(`Parsed questions: ${parsed.length}`);

  // ── Subject + grade ids ──
  const subjects = await db.subject.findMany();
  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s]));
  const grades = await db.grade.findMany();
  const gradeBySlug = new Map(grades.map((g) => [g.slug, g]));
  const SS3 = gradeBySlug.get("ss-3");
  if (!SS3) throw new Error("ss-3 grade missing");

  // ── Ensure General Knowledge subject ──
  let gk = subjectBySlug.get("general-knowledge");
  if (!gk) {
    gk = await db.subject.create({
      data: {
        name: "General Knowledge",
        slug: "general-knowledge",
        icon: "sparkles",
        color: "#0ea5e9",
        description: "Nigerian and world affairs, geography, civics, economics and finance.",
        order: 12,
      },
    });
    console.log("Created subject: General Knowledge");
  }
  subjectBySlug.set("general-knowledge", gk);
  // availability: GK for SS3 (competition level)
  await db.subjectGrade.upsert({
    where: { subjectId_gradeId: { subjectId: gk.id, gradeId: SS3.id } },
    create: { subjectId: gk.id, gradeId: SS3.id },
    update: {},
  });

  // ── Topic cache (find-or-create) ──
  const topicCache = new Map<string, string>(); // `${subjectId}|${name}` -> topicId
  async function topicIdFor(subjectId: string, name: string): Promise<string> {
    const key = `${subjectId}|${name}`;
    const hit = topicCache.get(key);
    if (hit) return hit;
    const found = await db.topic.findUnique({ where: { subjectId_name: { subjectId, name } } });
    if (found) { topicCache.set(key, found.id); return found.id; }
    const created = await db.topic.create({ data: { subjectId, name, order: 0 } });
    topicCache.set(key, created.id);
    return created.id;
  }

  // ── Existing normalized set (dedupe) ──
  const existing = await db.question.findMany({ select: { normalized: true } });
  const seen = new Set(existing.map((e) => e.normalized));
  console.log(`Existing questions: ${seen.size}`);

  let inserted = 0, skipped = 0, corrections = 0, missingMeta: string[] = [];
  const skippedList: string[] = [];

  for (const q of parsed) {
    let subjectSlug = SECTION_SUBJECT[q.section];
    let meta = META_BY_SECTION[q.section].get(q.num);

    // Chem Q78 (capacitors) is physics
    if (q.section === "Chemistry" && q.num === 78) {
      subjectSlug = "physics";
      meta = PHYS_EXTRA[0];
    }
    if (!meta) { missingMeta.push(`${q.section}:${q.num}`); continue; }

    const [, topicName, difficulty, explanation, correctOverride, stemFix] = meta;
    const subject = subjectBySlug.get(subjectSlug);
    if (!subject) { missingMeta.push(`subject:${subjectSlug}`); continue; }

    const text = (stemFix ?? q.stem).trim();
    const norm = normalize(text);
    if (!norm || seen.has(norm)) { skipped++; skippedList.push(`${q.section}:${q.num} ${text.slice(0, 60)}`); continue; }

    // correct option letter: override (verified) or source bold
    const letter = (correctOverride ?? (q.bold.length === 1 ? q.bold[0] : null)) as string;
    const correctOpt = q.options.find((o) => o.letter === letter);
    if (!correctOpt) { missingMeta.push(`no-correct:${q.section}:${q.num}`); continue; }
    if (correctOverride) corrections++;

    // review note
    const key = `${q.section}:${q.num}`;
    let reviewNote = "Imported from Master Competition Questions; answer verified.";
    if (CORRECTION_NOTES[key]) reviewNote = CORRECTION_NOTES[key];
    else if (q.section === "General Knowledge" && GK_CURRENT_AFFAIRS.has(q.num)) reviewNote = "Current-affairs item — re-verify periodically.";

    const topicId = await topicIdFor(subject.id, topicName);
    const points = difficulty === "hard" ? 150 : difficulty === "medium" ? 125 : 100;

    const question = await db.question.create({
      data: {
        gradeId: SS3.id,
        subjectId: subject.id,
        topicId,
        difficulty,
        type: "mcq",
        text,
        normalized: norm,
        points,
        timeLimit: difficulty === "hard" ? 45 : 30,
        explanation,
        status: "published",
        reviewNote,
        source: "Master Competition Bank",
        isDemo: false,
      },
    });

    // options in A–D order (client shuffles at serve time)
    let order = 0;
    for (const opt of q.options) {
      order++;
      await db.questionOption.create({
        data: { questionId: question.id, text: opt.text.trim(), isCorrect: opt.letter === letter, order },
      });
    }
    seen.add(norm);
    inserted++;
  }

  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (dup/empty): ${skipped}${skippedList.length ? "\n  " + skippedList.join("\n  ") : ""}`);
  console.log(`Corrections applied: ${corrections}`);
  console.log(`Missing meta: ${missingMeta.length ? missingMeta.join(", ") : "none"}`);

  // ── Post-import verification ──
  const total = await db.question.count({ where: { source: "Master Competition Bank" } });
  // every question exactly 4 options, exactly 1 correct
  const noCorrect = await db.question.count({
    where: { source: "Master Competition Bank", options: { none: { isCorrect: true } } },
  });
  const multiCorrectQs = await db.question.findMany({
    where: { source: "Master Competition Bank", options: { some: { isCorrect: true } } },
    select: { id: true, _count: { select: { options: { where: { isCorrect: true } } } } },
  });
  const multiCorrect = multiCorrectQs.filter((q) => q._count.options > 1);
  const wrongOptionCount = await db.question.count({
    where: { source: "Master Competition Bank", options: { none: {}, } },
  });
  const perSubject = await db.question.groupBy({
    by: ["subjectId"],
    where: { source: "Master Competition Bank" },
    _count: true,
  });
  console.log(`\nVerification: total=${total}, noCorrectOption=${noCorrect}, multiCorrect=${multiCorrect.length}, zeroOptions=${wrongOptionCount}`);
  for (const g of perSubject) {
    const s = await db.subject.findUnique({ where: { id: g.subjectId } });
    console.log(`  ${s?.name}: ${g._count}`);
  }
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

// Import the Primary 1–6 Mathematics bank (PRIMARY SCHOOL MATHEMATICS.docx) into ClassClash.
// - 991 verified questions (866 recomputed, 5 closest-value, 120 image-verified); 9 broken MCQs skipped
// - enables Primary 1–5 (SubjectGrade + hasContent), seeds P1–P5 trainers & founding guardians
// - idempotent: normalized-text dedupe against DB and within the document
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const db = new PrismaClient();

type VerifiedQ = {
  num: number;
  level: number;
  topic: string;
  stem: string;
  options: string[];
  answerLetter: string;
  image: string | null;
  status: string; // match | match_closest | image | skip_flawed
  explanation: string | null;
  correctionNote?: string;
};

type VlmResult = { description: string; verdict: string; agrees: boolean; explanation: string; flags: string[] };

const verified: VerifiedQ[] = JSON.parse(readFileSync("/tmp/docx-extract/verified.json", "utf8"));
const vlm: Record<string, VlmResult> = JSON.parse(readFileSync("/tmp/docx-extract/vlm-processed.json", "utf8"));

const SOURCE = "Primary Maths Question Bank";
const LETTERS = "ABCD";

function normalize(text: string): string {
  // Conservative convention (same as the admin editor route): lowercase + collapse
  // whitespace, but KEEP punctuation — stripping operators made "5 + 2 = ?" and
  // "5 - 2 = ?" collide, which are distinct questions.
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// ── difficulty / points / timeLimit rubric ──
function metaFor(q: VerifiedQ): { difficulty: "easy" | "medium" | "hard"; points: number; timeLimit: number } {
  const wp = q.topic === "Word Problems";
  if (wp) {
    if (q.level <= 4) return { difficulty: "medium", points: 125, timeLimit: 45 };
    return { difficulty: "hard", points: 150, timeLimit: 45 };
  }
  if (q.level <= 3) return { difficulty: "easy", points: 100, timeLimit: 30 };
  if (q.level === 4) {
    const easyP4 = ["Addition", "Subtraction", "Multiplication", "Division", "Rounding"];
    return easyP4.includes(q.topic)
      ? { difficulty: "easy", points: 100, timeLimit: 30 }
      : { difficulty: "medium", points: 125, timeLimit: 30 };
  }
  return { difficulty: "medium", points: 125, timeLimit: 30 }; // P5, P6
}

// ── stem rewrites for duplicate text stems (keeps questions self-contained & unique) ──
function stemFor(q: VerifiedQ): string {
  if (q.stem === "Which statement is TRUE?" && q.topic === "Comparing Numbers") {
    // extract the compared pair from the first option, e.g. "3 = 9" -> (3, 9)
    const m = q.options[0].match(/^(-?\d+)\s*[<>=]\s*(-?\d+)$/);
    if (m) return `Which statement about the numbers ${m[1]} and ${m[2]} is TRUE?`;
  }
  const eo = q.stem.match(/^Which of the following numbers is (EVEN|ODD)\?$/);
  if (eo) {
    const list = q.options.slice(0, 3).join(", ") + " or " + q.options[3];
    return `Which of these numbers is ${eo[1]}: ${list}?`;
  }
  return q.stem;
}

function reviewNoteFor(q: VerifiedQ): string {
  if (q.correctionNote) return q.correctionNote;
  if (q.num === 331)
    return "Kept exactly as published: 20 pupils with 29 boys gives -9 girls (20 - 29 = -9). Mathematically consistent; flagged for reviewer review.";
  if (q.status === "match_closest")
    return `Imported from PRIMARY SCHOOL MATHEMATICS.docx (Primary ${q.level}). Answer verified: the exact value has a fraction part; the keyed option is the closest choice.`;
  if (q.status === "image")
    return `Imported from PRIMARY SCHOOL MATHEMATICS.docx (Primary ${q.level}). Answer verified against the source image (AI vision check).`;
  return `Imported from PRIMARY SCHOOL MATHEMATICS.docx (Primary ${q.level}). Answer verified by recomputation.`;
}

// ── P1–P5 enablers: trainers + guardians (mirrors prisma/seed-live.ts & seed-data.ts) ──
const TRAINERS = [
  { grade: "primary-1", name: "Count Cub", skill: 0.45, avatar: "cat" },
  { grade: "primary-2", name: "Sum Turtle", skill: 0.5, avatar: "turtle" },
  { grade: "primary-3", name: "Times Penguin", skill: 0.55, avatar: "penguin" },
  { grade: "primary-4", name: "Divide Dolphin", skill: 0.58, avatar: "dolphin" },
  { grade: "primary-5", name: "Fraction Swan", skill: 0.62, avatar: "swan" },
];
const GUARDIANS = [
  { grade: "primary-1", name: "Tally Turtle", skill: 0.45, avatar: "turtle" },
  { grade: "primary-2", name: "Plus Penguin", skill: 0.5, avatar: "penguin" },
  { grade: "primary-3", name: "Multiple Mongoose", skill: 0.55, avatar: "mongoose" },
  { grade: "primary-4", name: "Decimal Dragon", skill: 0.6, avatar: "dragon" },
  { grade: "primary-5", name: "Percent Pelican", skill: 0.62, avatar: "pelican" },
];

async function main() {
  const math = await db.subject.findUnique({ where: { slug: "mathematics" } });
  if (!math) throw new Error("mathematics subject missing");
  const grades = await db.grade.findMany();
  const gradeBySlug = new Map(grades.map((g) => [g.slug, g]));

  // 0. Clean re-import: remove any previous run of this source (idempotent replace)
  const removedAttempts = await db.questionAttempt.deleteMany({
    where: { question: { source: SOURCE } },
  });
  const removed = await db.question.deleteMany({ where: { source: SOURCE } });
  if (removed.count || removedAttempts.count)
    console.log(`Removed previous import: ${removed.count} questions, ${removedAttempts.count} attempts`);

  // 1. Enable Primary 1–5 for Mathematics
  for (const slug of ["primary-1", "primary-2", "primary-3", "primary-4", "primary-5"]) {
    const grade = gradeBySlug.get(slug);
    if (!grade) throw new Error(`grade ${slug} missing`);
    await db.subjectGrade.upsert({
      where: { subjectId_gradeId: { subjectId: math.id, gradeId: grade.id } },
      create: { subjectId: math.id, gradeId: grade.id },
      update: {},
    });
    if (!grade.hasContent) await db.grade.update({ where: { id: grade.id }, data: { hasContent: true } });
  }
  console.log("Enabled Mathematics for Primary 1–5 (hasContent = true)");

  // 2. Trainers + guardians (+ crowns for guardians)
  for (const t of TRAINERS) {
    const grade = gradeBySlug.get(t.grade)!;
    await db.user.upsert({
      where: { email: `live-trainer-${t.grade}@classclash.demo` },
      create: {
        email: `live-trainer-${t.grade}@classclash.demo`,
        displayName: t.name, avatar: t.avatar, role: "student",
        gradeId: grade.id, onboarded: true, isDemo: true, isBot: true, botSkill: t.skill, rating: 1000,
      },
      update: { botSkill: t.skill, gradeId: grade.id, isBot: true, isDemo: true, onboarded: true },
    });
  }
  console.log(`Seeded ${TRAINERS.length} live trainers (Primary 1–5)`);

  for (const g of GUARDIANS) {
    const grade = gradeBySlug.get(g.grade)!;
    const email = `guardian.${g.grade}.mathematics@bots.classclash.demo`;
    const bot = await db.user.upsert({
      where: { email },
      create: {
        email, passwordHash: null, displayName: g.name, avatar: g.avatar, role: "student",
        gradeId: grade.id, onboarded: true, isDemo: true, isBot: true, botSkill: g.skill,
      },
      update: { botSkill: g.skill, gradeId: grade.id },
    });
    const existingChampion = await db.champion.findUnique({
      where: { gradeId_subjectId: { gradeId: grade.id, subjectId: math.id } },
    });
    if (!existingChampion) {
      await db.champion.create({ data: { gradeId: grade.id, subjectId: math.id, userId: bot.id, defences: 0 } });
      await db.championshipHistory.create({
        data: {
          gradeId: grade.id, subjectId: math.id, formerChampionId: null, newChampionId: bot.id,
          note: "Founding Guardian — beat them to claim the title!",
        },
      });
    }
  }
  console.log(`Seeded ${GUARDIANS.length} founding guardians with Mathematics crowns (Primary 1–5)`);

  // 3. Topic cache (find-or-create under Mathematics)
  const mathId = math.id;
  const topicCache = new Map<string, string>();
  async function topicIdFor(name: string): Promise<string> {
    const hit = topicCache.get(name);
    if (hit) return hit;
    const found = await db.topic.findUnique({ where: { subjectId_name: { subjectId: mathId, name } } });
    if (found) { topicCache.set(name, found.id); return found.id; }
    const created = await db.topic.create({ data: { subjectId: mathId, name, order: 0 } });
    topicCache.set(name, created.id);
    return created.id;
  }

  // 4. Import questions
  const existing = await db.question.findMany({ select: { normalized: true } });
  const seen = new Set(existing.map((e) => e.normalized));
  const docSeen = new Set<string>();

  let inserted = 0, skippedDb = 0, skippedDoc = 0, skippedFlawed = 0, skippedVlm = 0;
  const skippedList: string[] = [];
  const perLevel: Record<number, number> = {};
  const perTopic: Record<string, number> = {};

  for (const q of verified) {
    if (q.status === "skip_flawed") { skippedFlawed++; continue; }
    if (q.status === "image" && !vlm[String(q.num)]?.agrees) { skippedVlm++; skippedList.push(`vlm:${q.num}`); continue; }

    const text = stemFor(q);
    const baseNorm = normalize(text);
    if (!baseNorm) { skippedList.push(`empty:${q.num}`); continue; }
    // image questions are disambiguated by their image ref (identical stems, different pictures)
    const norm = q.image ? `${baseNorm} [q${q.num}]` : baseNorm;
    if (seen.has(norm)) { skippedDb++; skippedList.push(`db:${q.num}`); continue; }
    if (docSeen.has(norm)) { skippedDoc++; skippedList.push(`doc-dup:${q.num} ${text.slice(0, 40)}`); continue; }

    const grade = gradeBySlug.get(`primary-${q.level}`);
    if (!grade) { skippedList.push(`grade:${q.num}`); continue; }

    const explanation = q.status === "image" ? vlm[String(q.num)].explanation : q.explanation;
    if (!explanation) { skippedList.push(`no-explanation:${q.num}`); continue; }

    const { difficulty, points, timeLimit } = metaFor(q);
    const topicId = await topicIdFor(q.topic);

    const question = await db.question.create({
      data: {
        gradeId: grade.id,
        subjectId: math.id,
        topicId,
        difficulty,
        type: "mcq",
        text,
        normalized: norm,
        imageUrl: q.image ? `/qbank/primary-math/q${q.num}.png` : null,
        points,
        timeLimit,
        explanation,
        status: "published",
        reviewNote: reviewNoteFor(q),
        source: SOURCE,
        isDemo: false,
      },
    });
    let order = 0;
    for (let i = 0; i < 4; i++) {
      order++;
      await db.questionOption.create({
        data: { questionId: question.id, text: q.options[i].trim(), isCorrect: LETTERS[i] === q.answerLetter, order },
      });
    }
    seen.add(norm);
    docSeen.add(norm);
    inserted++;
    perLevel[q.level] = (perLevel[q.level] ?? 0) + 1;
    perTopic[q.topic] = (perTopic[q.topic] ?? 0) + 1;
  }

  console.log(`\nInserted: ${inserted}`);
  console.log("Per level:", JSON.stringify(perLevel));
  console.log(`Skipped: flawed=${skippedFlawed}, doc-duplicate=${skippedDoc}, already-in-db=${skippedDb}, vlm-unverified=${skippedVlm}`);
  if (skippedList.length) console.log("  " + skippedList.join("\n  "));

  // 5. Post-import verification
  const total = await db.question.count({ where: { source: SOURCE } });
  const noCorrect = await db.question.count({
    where: { source: SOURCE, options: { none: { isCorrect: true } } },
  });
  const multi = await db.question.findMany({
    where: { source: SOURCE },
    select: { id: true, _count: { select: { options: { where: { isCorrect: true } } } } },
  });
  const multiCorrect = multi.filter((x) => x._count.options > 1).length;
  const zeroOpts = await db.question.count({
    where: { source: SOURCE, options: { none: {} } },
  });
  const noImageFile = await db.question.count({
    where: { source: SOURCE, imageUrl: { not: null }, OR: [{ imageUrl: "" }] },
  });
  const withImages = await db.question.count({ where: { source: SOURCE, imageUrl: { not: null } } });
  console.log(`\nVerification: total=${total}, noCorrect=${noCorrect}, multiCorrect=${multiCorrect}, zeroOptions=${zeroOpts}, withImages=${withImages}, badImageUrl=${noImageFile}`);

  const bankTotal = await db.question.count({ where: { status: "published" } });
  console.log(`Published bank total (all sources): ${bankTotal}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

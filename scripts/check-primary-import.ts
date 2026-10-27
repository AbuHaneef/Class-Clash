// Post-import DB integrity spot checks for the Primary Maths bank.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const SOURCE = "Primary Maths Question Bank";

async function main() {
  // 1. counts per grade + difficulty
  const byGrade = await db.question.groupBy({
    by: ["gradeId", "difficulty"],
    where: { source: SOURCE },
    _count: true,
  });
  const grades = await db.grade.findMany();
  const gname = new Map(grades.map((g) => [g.id, g.name]));
  const agg: Record<string, Record<string, number>> = {};
  for (const row of byGrade) {
    const n = gname.get(row.gradeId)!;
    agg[n] = agg[n] ?? {};
    agg[n][row.difficulty] = row._count;
  }
  console.log("Per grade x difficulty:", JSON.stringify(agg, null, 1));

  // 2. sample image question (clock) — check payload shape
  const clock = await db.question.findFirst({
    where: { source: SOURCE, imageUrl: { contains: "q298" } },
    include: { options: true, topic: true, grade: true },
  });
  console.log("\nClock q298:", {
    text: clock?.text, imageUrl: clock?.imageUrl, grade: clock?.grade.name,
    topic: clock?.topic.name, diff: clock?.difficulty, points: clock?.points,
    timeLimit: clock?.timeLimit,
    correct: clock?.options.find((o) => o.isCorrect)?.text,
    explanation: clock?.explanation,
  });

  // 3. rewritten stems present
  const rewritten = await db.question.count({
    where: { source: SOURCE, text: { startsWith: "Which statement about the numbers" } },
  });
  const evenOdd = await db.question.count({
    where: { source: SOURCE, OR: [{ text: { startsWith: "Which of these numbers is EVEN" } }, { text: { startsWith: "Which of these numbers is ODD" } }] },
  });
  console.log(`\nRewritten TRUE-statement stems: ${rewritten} (expect 10), EVEN/ODD stems: ${evenOdd} (expect 16)`);

  // 4. corrections landed
  const q440 = await db.question.findFirst({ where: { source: SOURCE, text: "Round 224 to the nearest 10." } });
  const q995 = await db.question.findFirst({ where: { source: SOURCE, text: { contains: "92 pupils" } } });
  console.log("Correction #440 present:", Boolean(q440), "| Correction #995 present:", Boolean(q995));

  // 5. negative-number questions that previously collided are present
  for (const t of ["5 - 2 = ?", "6 - 3 = ?", "8 - 1 = ?", "6 - 4 = ?", "-12 + 3 = ?", "-4 x 2 = ?", "10 - 14 = ?", "-4 x 6 = ?", "-10 + 14 = ?"]) {
    const found = await db.question.findFirst({ where: { source: SOURCE, text: t }, include: { options: true } });
    console.log(`  '${t}' -> ${found ? `ok, correct=${found.options.find((o) => o.isCorrect)?.text}` : "MISSING!"}`);
  }

  // 6. P1 subjects availability + champions + trainers
  const p1 = grades.find((g) => g.slug === "primary-1")!;
  const p1Subjects = await db.subjectGrade.count({ where: { gradeId: p1.id } });
  const p1Champion = await db.champion.findFirst({ where: { gradeId: p1.id }, include: { user: true, subject: true } });
  const p1Trainer = await db.user.findFirst({ where: { email: "live-trainer-primary-1@classclash.demo" } });
  console.log(`\nP1: subjects=${p1Subjects}, champion=${p1Champion?.user.displayName} (${p1Champion?.subject.name}), trainer=${p1Trainer?.displayName}`);

  // 7. explanation present for every question (explanation is non-nullable; check non-empty)
  const noExp = await db.question.count({ where: { source: SOURCE, explanation: "" } });
  console.log(`Questions without explanation: ${noExp}`);

  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

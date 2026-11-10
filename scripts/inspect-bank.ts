import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const subjects = await db.subject.findMany({
  select: { id: true, name: true, slug: true, color: true, icon: true },
  orderBy: { name: "asc" },
});
console.log("=== SUBJECTS ===");
for (const s of subjects) console.log(`${s.slug} | ${s.name} | color=${s.color} icon=${s.icon}`);

const grades = await db.grade.findMany({
  where: { hasContent: true },
  select: { id: true, name: true, slug: true, order: true },
  orderBy: { order: "asc" },
});
console.log("\n=== GRADES WITH CONTENT ===");
for (const g of grades) console.log(`${g.slug} | ${g.name} | order=${g.order}`);

const topics = await db.topic.findMany({
  select: { subjectId: true, name: true, _count: { select: { questions: true } } },
  orderBy: [{ subjectId: "asc" }, { order: "asc" }],
});
console.log("\n=== TOPICS (by subject) ===");
let last = "";
for (const t of topics) {
  if (t.subjectId !== last) { last = t.subjectId; console.log(`\n-- subject ${last}`); }
  console.log(`  ${t.name} (${t._count.questions})`);
}

const counts = await db.question.groupBy({ by: ["subjectId", "gradeId", "status"], _count: true });
console.log("\n=== QUESTION COUNTS ===");
for (const c of counts) console.log(`${c.subjectId} ${c.gradeId} ${c.status}: ${c._count}`);

await db.$disconnect();

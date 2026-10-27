// Quick DB recon: grade slugs, math topics, guardians, trainers, subjectGrades.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const grades = await db.grade.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true, hasContent: true } });
  console.log("GRADES:", JSON.stringify(grades));

  const math = await db.subject.findUnique({ where: { slug: "mathematics" } });
  const topics = await db.topic.findMany({ where: { subjectId: math!.id }, select: { name: true } });
  console.log("\nMATH TOPICS:", topics.map((t) => t.name).join(" | "));

  const sg = await db.subjectGrade.findMany({ where: { subjectId: math!.id }, include: { grade: { select: { slug: true } } } });
  console.log("\nMATH available in grades:", sg.map((s) => s.grade.slug).join(", "));

  const guardians = await db.user.findMany({ where: { email: { startsWith: "guardian." } }, select: { email: true, displayName: true } });
  console.log("\nGUARDIANS:", guardians.map((g) => `${g.displayName} <${g.email}>`).join("\n  "));

  const trainers = await db.user.findMany({ where: { email: { startsWith: "live-trainer-" } }, select: { email: true, displayName: true } });
  console.log("\nTRAINERS:", trainers.map((t) => `${t.displayName} <${t.email}>`).join("\n  "));

  const qCount = await db.question.count({ where: { status: "published" } });
  console.log(`\nPublished questions total: ${qCount}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

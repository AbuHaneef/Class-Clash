// Audit: dump all questions from live DB, sanity-check answer integrity,
// and flag anything not from the reviewed seed files.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const total = await db.question.count();
  const published = await db.question.count({ where: { status: "published" } });
  const byStatus = await db.question.groupBy({ by: ["status"], _count: true });
  console.log(`Total questions: ${total} (published: ${published})`);
  console.log("By status:", byStatus.map((s) => `${s.status}=${s._count}`).join(", "));

  const questions = await db.question.findMany({
    include: { options: true, topic: true, subject: true, grade: true },
  });

  const problems: string[] = [];
  const nonSeed: string[] = [];

  for (const q of questions) {
    const opts = q.options;
    // sanity checks
    if (opts.length < 2) problems.push(`Q${q.id} "${q.text.slice(0, 50)}" has ${opts.length} options`);
    const correct = opts.filter((o) => o.isCorrect);
    if (correct.length !== 1) problems.push(`Q${q.id} "${q.text.slice(0, 50)}" has ${correct.length} correct options`);
    if (new Set(opts.map((o) => o.text.toLowerCase().trim())).size !== opts.length)
      problems.push(`Q${q.id} "${q.text.slice(0, 50)}" has duplicate option texts`);
    if (!q.explanation) problems.push(`Q${q.id} "${q.text.slice(0, 50)}" has no explanation`);
    if (q.status !== "published") problems.push(`Q${q.id} "${q.text.slice(0, 50)}" status=${q.status}`);
    if (q.source !== "ClassClash Demo Bank") {
      nonSeed.push(`Q${q.id} [${q.grade.slug}/${q.subject.slug}] "${q.text.slice(0, 60)}" source=${q.source} status=${q.status} correct="${correct[0]?.text ?? "???"}"`);
    }
  }

  console.log(`\nSanity problems: ${problems.length}`);
  problems.forEach((p) => console.log("  ⚠ " + p));

  console.log(`\nNon-seed-source questions: ${nonSeed.length}`);
  nonSeed.forEach((n) => console.log("  • " + n));

  // List all users with admin/reviewer roles
  const staff = await db.user.findMany({
    where: { role: { in: ["admin", "reviewer"] } },
    select: { id: true, email: true, displayName: true, role: true, isDemo: true },
  });
  console.log(`\nStaff accounts (${staff.length}):`);
  staff.forEach((s) => console.log(`  ${s.role.toUpperCase()} ${s.email} "${s.displayName}" isDemo=${s.isDemo}`));

  const users = await db.user.count();
  const bots = await db.user.count({ where: { isBot: true } });
  const demoUsers = await db.user.count({ where: { isDemo: true } });
  console.log(`\nUsers: ${users} total, ${bots} bots, ${demoUsers} flagged demo`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

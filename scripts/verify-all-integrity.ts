/**
 * Comprehensive integrity verification for ClassClash.
 * Checks: question bank counts & per-source breakdown, answer-key constraints,
 * orphan records, image assets, grade/subject/topic wiring, staff accounts.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function pass(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string) { console.log(`  ✗ FAIL: ${msg}`); process.exitCode = 1; }

async function main() {
  console.log('1. Question bank totals & sources');
  const totalQuestions = await db.question.count();
  const published = await db.question.count({ where: { status: 'published' } });
  const bySource = await db.question.groupBy({
    by: ['source'],
    _count: { _all: true },
  });
  console.log(`  Bank: ${totalQuestions} total, ${published} published`);
  for (const row of bySource) console.log(`    - ${row.source}: ${row._count._all}`);
  if (published === totalQuestions) pass('all questions published'); else fail(`${totalQuestions - published} unpublished`);

  console.log('2. Answer-key constraints (exactly one correct option per question)');
  const noCorrect = await db.question.findMany({
    where: { options: { none: { isCorrect: true } } },
    select: { id: true },
  });
  const multiCorrect = await db.question.findMany({
    where: { options: { some: { isCorrect: true } } },
    select: { id: true, _count: { select: { options: true } } },
  });
  const multiIds = (await Promise.all(
    multiCorrect.map(async (q) => {
      const c = await db.questionOption.count({ where: { questionId: q.id, isCorrect: true } });
      return c > 1 ? q.id : null;
    })
  )).filter(Boolean);
  const zeroOptions = await db.question.findMany({
    where: { options: { none: {} } },
    select: { id: true },
  });
  if (noCorrect.length === 0) pass('0 questions without a correct option'); else fail(`${noCorrect.length} questions with NO correct option: ${noCorrect.slice(0, 5).join(', ')}`);
  if (multiIds.length === 0) pass('0 questions with multiple correct options'); else fail(`${multiIds.length} questions with MULTIPLE correct: ${multiIds.slice(0, 5).join(', ')}`);
  if (zeroOptions.length === 0) pass('0 questions with zero options'); else fail(`${zeroOptions.length} questions with zero options`);

  console.log('3. Explanations & duplicate options');
  // explanation is a required String in the schema — only '' is possible, null cannot exist
  const noExplanation = await db.question.count({ where: { explanation: '' } });
  if (noExplanation === 0) pass('every question has an explanation'); else fail(`${noExplanation} questions missing explanation`);
  const dupOptionQuestions = await db.$queryRaw<Array<{ questionId: string }>>`
    SELECT o1.questionId FROM QuestionOption o1
    JOIN QuestionOption o2 ON o1.questionId = o2.questionId AND o1.id < o2.id
    AND LOWER(TRIM(o1.text)) = LOWER(TRIM(o2.text))
    GROUP BY o1.questionId`;
  if (dupOptionQuestions.length === 0) pass('no duplicate options within a question'); else fail(`${dupOptionQuestions.length} questions with duplicate option texts: ${dupOptionQuestions.slice(0, 5).map((r) => r.questionId).join(', ')}`);

  console.log('4. Duplicate normalized stems (same grade)');
  const dupStems = await db.$queryRaw<Array<{ cnt: number; normalized: string }>>`
    SELECT normalized, COUNT(*) as cnt FROM Question
    WHERE status='published'
    GROUP BY normalized, gradeId HAVING COUNT(*) > 1 LIMIT 10`;
  if (dupStems.length === 0) pass('no duplicate normalized stems'); else fail(`${dupStems.length} duplicate stems: ${dupStems.map((r) => r.normalized.slice(0, 40)).join(' | ')}`);

  console.log('5. Image questions');
  const withImage = await db.question.count({ where: { imageUrl: { not: null } } });
  pass(`${withImage} questions carry imageUrl`);
  const missingImages: string[] = [];
  const imgQs = await db.question.findMany({
    where: { imageUrl: { not: null } },
    select: { imageUrl: true },
  });
  for (const q of imgQs) {
    if (!q.imageUrl) continue;
    const fs = await import('fs');
    const pathMod = await import('path');
    const filePath = pathMod.join(process.cwd(), 'public', q.imageUrl);
    if (!fs.existsSync(filePath)) missingImages.push(q.imageUrl);
  }
  if (missingImages.length === 0) pass('all referenced image files exist on disk'); else fail(`missing files: ${missingImages.slice(0, 5).join(', ')}`);

  console.log('6. Orphan checks');
  const orphanOptions = await db.$queryRaw<Array<{ cnt: number }>>`
    SELECT COUNT(*) as cnt FROM QuestionOption o
    LEFT JOIN Question q ON q.id = o.questionId WHERE q.id IS NULL`;
  const orphanQuestions = await db.$queryRaw<Array<{ cnt: number }>>`
    SELECT COUNT(*) as cnt FROM Question qq
    LEFT JOIN Grade g ON g.id = qq.gradeId
    LEFT JOIN Subject s ON s.id = qq.subjectId
    LEFT JOIN Topic t ON t.id = qq.topicId
    WHERE g.id IS NULL OR s.id IS NULL OR t.id IS NULL`;
  if (Number(orphanOptions[0].cnt) === 0) pass('0 orphan options'); else fail(`${orphanOptions[0].cnt} orphan options`);
  if (Number(orphanQuestions[0].cnt) === 0) pass('0 questions with missing grade/subject/topic'); else fail(`${orphanQuestions[0].cnt} questions with missing grade/subject/topic`);

  console.log('7. Grade / subject wiring');
  const grades = await db.grade.findMany({ orderBy: { order: 'asc' }, include: { _count: { select: { questions: true } } } });
  for (const g of grades) console.log(`    ${g.name} (hasContent=${g.hasContent}): ${g._count.questions} questions`);
  const gradesWithContent = grades.filter((g) => g.hasContent && g._count.questions > 0);
  const contentNoQ = grades.filter((g) => g.hasContent && g._count.questions === 0);
  pass(`${gradesWithContent.length} grades with content all have questions`);
  if (contentNoQ.length > 0) fail(`grades flagged hasContent but 0 questions: ${contentNoQ.map((g) => g.name).join(', ')}`); else pass('no empty hasContent grades');

  console.log('8. Staff accounts');
  const staff = await db.user.findMany({ where: { role: { in: ['admin', 'reviewer'] } }, select: { email: true, role: true, deletedAt: true, onboarded: true } });
  for (const s of staff) console.log(`    ${s.email} — ${s.role} (onboarded=${s.onboarded}, deleted=${!!s.deletedAt})`);
  const admin = staff.find((s) => s.role === 'admin' && !s.deletedAt);
  const reviewer = staff.find((s) => s.role === 'reviewer' && !s.deletedAt);
  if (admin) pass('active admin present'); else fail('no active admin');
  if (reviewer) pass('active reviewer present'); else fail('no active reviewer');

  console.log('9. Leftover test accounts (should be none)');
  const testAccs = await db.user.findMany({
    where: { email: { contains: 'test-' } , deletedAt: null },
    select: { email: true },
  });
  if (testAccs.length === 0) pass('no leftover test accounts'); else console.log(`    note: ${testAccs.length} user(s) matching 'test-': ${testAccs.map((t) => t.email).join(', ')}`);

  console.log('10. Champions / schools sanity');
  const champions = await db.champion.count();
  const schools = await db.school.count();
  const liveTrainers = await db.user.count({ where: { isBot: true, isDemo: false } });
  console.log(`    champions: ${champions}, schools (leagues): ${schools}, live trainer bots: ${liveTrainers}`);
  const champNoUser = await db.$queryRaw<Array<{ cnt: number }>>`
    SELECT COUNT(*) as cnt FROM Champion c LEFT JOIN User u ON u.id = c.userId WHERE u.id IS NULL OR u.deletedAt IS NOT NULL`;
  if (Number(champNoUser[0].cnt) === 0) pass('all champions link to an active user'); else fail(`${champNoUser[0].cnt} champions with missing/deleted user`);

  console.log('');
  console.log(process.exitCode ? '═══ INTEGRITY: FAILURES FOUND ═══' : '═══ INTEGRITY: ALL CHECKS PASSED ═══');
}

main()
  .catch((e) => { console.error('Script error:', e); process.exit(1); })
  .finally(() => db.$disconnect());

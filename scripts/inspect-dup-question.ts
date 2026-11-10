/** Inspect the question flagged for duplicate option texts. */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const q = await db.question.findUnique({
    where: { id: 'cmvqnxv0j02o8ohb850a9ogsw' },
    include: { options: true, grade: true, subject: true, topic: true },
  });
  if (!q) { console.log('Question not found (may have been deleted)'); return; }
  console.log('ID:', q.id);
  console.log('Grade:', q.grade.name, '| Subject:', q.subject.name, '| Topic:', q.topic.name);
  console.log('Difficulty:', q.difficulty, '| Status:', q.status, '| Source:', q.source);
  console.log('Text:', q.text);
  console.log('Explanation:', q.explanation);
  console.log('ReviewNote:', q.reviewNote);
  console.log('ImageUrl:', q.imageUrl);
  console.log('Options:');
  for (const o of q.options) console.log(`  [${o.order}] "${o.text}" correct=${o.isCorrect}`);
}

main().catch(console.error).finally(() => db.$disconnect());

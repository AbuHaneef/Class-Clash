/** List all stress-pattern style questions in Oral English & Phonetics. */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const topic = await db.topic.findFirst({ where: { name: 'Oral English & Phonetics' } });
  if (!topic) { console.log('topic not found'); return; }
  const qs = await db.question.findMany({
    where: { topicId: topic.id },
    include: { options: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Total questions in Oral English & Phonetics: ${qs.length}\n`);
  for (const q of qs) {
    if (!/stress|syllable/i.test(q.text)) continue;
    console.log(`Q: ${q.text}`);
    for (const o of q.options) console.log(`   ${o.isCorrect ? '→' : ' '} "${o.text}"`);
    console.log('');
  }
}

main().catch(console.error).finally(() => db.$disconnect());

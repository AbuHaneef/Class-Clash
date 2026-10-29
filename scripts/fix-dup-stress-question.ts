/**
 * Fix the one question with case-insensitively duplicate options:
 * stress-pattern options ("E-du-ca-tion" vs "e-DU-ca-tion") collide when case is ignored.
 * Rewrite to ordinal syllable options, which match the stem's phrasing exactly.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const QID = 'cmvqnxv0j02o8ohb850a9ogsw';

async function main() {
  const q = await db.question.findUnique({ where: { id: QID }, include: { options: true } });
  if (!q) throw new Error('question not found');

  const newTexts: Record<number, string> = {
    1: 'First syllable',
    2: 'Second syllable',
    3: 'Third syllable',
    4: 'Fourth syllable',
  };

  for (const o of q.options) {
    const next = newTexts[o.order];
    if (!next) throw new Error(`unexpected option order ${o.order}`);
    await db.questionOption.update({ where: { id: o.id }, data: { text: next } });
  }

  // explanation stays valid: e-du-CA-tion = third syllable
  await db.question.update({
    where: { id: QID },
    data: {
      explanation: "The word 'education' has four syllables (e-du-ca-tion) and the primary stress falls on the third: e-du-CA-tion.",
      reviewNote: 'Imported from Master Competition Questions; answer verified. Options rewritten to ordinal syllable form (original syllabification options were case-insensitively ambiguous).',
    },
  });

  const after = await db.question.findUnique({ where: { id: QID }, include: { options: true } });
  console.log('Updated question:', after?.text);
  for (const o of after?.options ?? []) console.log(`  [${o.order}] "${o.text}" correct=${o.isCorrect}`);
}

main().catch(console.error).finally(() => db.$disconnect());

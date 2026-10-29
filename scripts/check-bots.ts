/** Check bot/live-trainer user records. */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const bots = await db.user.findMany({
    where: { isBot: true },
    select: { displayName: true, email: true, isDemo: true, botSkill: true, gradeId: true, deletedAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Bot users (isBot=true): ${bots.length}`);
  for (const b of bots) console.log(`  ${b.displayName} | demo=${b.isDemo} | skill=${b.botSkill} | deleted=${!!b.deletedAt}`);
}

main().catch(console.error).finally(() => db.$disconnect());

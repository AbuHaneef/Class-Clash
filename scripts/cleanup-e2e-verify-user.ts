/** Clean up the E2E browser test user (E2ECheck Fox) and all their data. */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    where: { OR: [{ email: { startsWith: 'e2e-check-' } }, { displayName: { startsWith: 'E2ECheck' } }] },
  });
  console.log(`found ${users.length} E2E user(s)`);
  for (const u of users) {
    // challenges they created or joined
    const chs = await db.challenge.findMany({
      where: { OR: [{ creatorId: u.id }, { opponentId: u.id }] },
      select: { id: true },
    });
    for (const c of chs) {
      await db.challengeResult.deleteMany({ where: { challengeId: c.id } });
      await db.championshipHistory.deleteMany({ where: { challengeId: c.id } });
      await db.challenge.deleteMany({ where: { id: c.id } });
    }
    // QuestionAttempt cascades with QuizSession deletion (relation quizSession)
    await db.quizSession.deleteMany({ where: { userId: u.id } });
    await db.matchRecord.deleteMany({ where: { OR: [{ userId: u.id }, { opponentId: u.id }] } });
    await db.xPTransaction.deleteMany({ where: { userId: u.id } });
    await db.userMission.deleteMany({ where: { userId: u.id } });
    await db.userBadge.deleteMany({ where: { userId: u.id } });
    await db.dailyEntry.deleteMany({ where: { userId: u.id } });
    await db.notification.deleteMany({ where: { userId: u.id } });
    await db.report.deleteMany({ where: { reporterId: u.id } });
    await db.rivalry.deleteMany({ where: { OR: [{ userId: u.id }, { rivalId: u.id }] } });
    await db.authSession.deleteMany({ where: { userId: u.id } });
    await db.shareLink.deleteMany({ where: { userId: u.id } });
    await db.champion.deleteMany({ where: { userId: u.id } });
    await db.tournamentParticipant.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
    console.log('deleted', u.email);
  }
  // sanity: confirm nothing left
  const left = await db.user.count({ where: { email: { startsWith: 'e2e-check-' } } });
  console.log(`remaining e2e users: ${left}`);
}

main().catch(console.error).finally(() => db.$disconnect());

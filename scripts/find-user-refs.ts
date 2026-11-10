/** Find remaining references to the E2E user before deletion. */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const u = await db.user.findFirst({ where: { email: { startsWith: 'e2e-check-' } } });
  if (!u) { console.log('user already gone'); return; }
  console.log('user:', u.id, u.email);

  const checks: [string, number][] = [
    ['MatchRecord user', await db.matchRecord.count({ where: { userId: u.id } })],
    ['MatchRecord opponent', await db.matchRecord.count({ where: { opponentId: u.id } })],
    ['TournamentMatch p1', await db.tournamentMatch.count({ where: { player1Id: u.id } })],
    ['TournamentMatch p2', await db.tournamentMatch.count({ where: { player2Id: u.id } })],
    ['School creator', await db.school.count({ where: { creatorId: u.id } })],
    ['Challenge creator', await db.challenge.count({ where: { creatorId: u.id } })],
    ['Challenge opponent', await db.challenge.count({ where: { opponentId: u.id } })],
    ['ChallengeResult', await db.challengeResult.count({ where: { userId: u.id } })],
    ['ChampionshipHistory newChamp', await db.championshipHistory.count({ where: { newChampionId: u.id } })],
    ['ChampionshipHistory formerChamp', await db.championshipHistory.count({ where: { formerChampionId: u.id } })],
    ['QuizSession', await db.quizSession.count({ where: { userId: u.id } })],
    ['XPTransaction', await db.xPTransaction.count({ where: { userId: u.id } })],
    ['UserMission', await db.userMission.count({ where: { userId: u.id } })],
    ['UserBadge', await db.userBadge.count({ where: { userId: u.id } })],
    ['DailyEntry', await db.dailyEntry.count({ where: { userId: u.id } })],
    ['Notification', await db.notification.count({ where: { userId: u.id } })],
    ['Report reporter', await db.report.count({ where: { reporterId: u.id } })],
    ['Rivalry user', await db.rivalry.count({ where: { userId: u.id } })],
    ['Rivalry rival', await db.rivalry.count({ where: { rivalId: u.id } })],
    ['AuthSession', await db.authSession.count({ where: { userId: u.id } })],
    ['ShareLink', await db.shareLink.count({ where: { userId: u.id } })],
    ['Champion', await db.champion.count({ where: { userId: u.id } })],
    ['TournamentParticipant', await db.tournamentParticipant.count({ where: { userId: u.id } })],
  ];
  for (const [label, n] of checks) if (n > 0) console.log(`  STILL REFERENCED: ${label}: ${n}`);
  console.log('scan done');
}

main().catch(console.error).finally(() => db.$disconnect());

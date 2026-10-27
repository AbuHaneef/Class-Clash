import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const u = await db.user.findFirst({ where: { email: { contains: "@test.cc" } } });
if (!u) {
  console.log("No test account found");
} else {
  const uid = u.id;
  // delete children in dependency order
  await db.questionAttempt.deleteMany({ where: { quizSession: { userId: uid } } });
  await db.quizSession.deleteMany({ where: { userId: uid } });
  await db.challengeResult.deleteMany({ where: { userId: uid } });
  await db.challengeResult.deleteMany({ where: { challenge: { OR: [{ creatorId: uid }, { opponentId: uid }] } } });
  await db.challenge.deleteMany({ where: { OR: [{ creatorId: uid }, { opponentId: uid }] } });
  await db.dailyEntry.deleteMany({ where: { userId: uid } });
  await db.userMission.deleteMany({ where: { userId: uid } });
  await db.userBadge.deleteMany({ where: { userId: uid } });
  await db.notification.deleteMany({ where: { userId: uid } });
  await db.xPTransaction.deleteMany({ where: { userId: uid } });
  await db.user.delete({ where: { id: uid } });
  console.log("Deleted test account:", u.email);
}
await db.$disconnect();

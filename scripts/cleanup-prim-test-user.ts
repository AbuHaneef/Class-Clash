import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const u = await db.user.findFirst({ where: { email: "prim1@test.classclash.com" } });
if (!u) {
  console.log("No prim test account found");
} else {
  const uid = u.id;
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
  await db.matchRecord.deleteMany({ where: { OR: [{ userId: uid }, { opponentId: uid }] } });
  await db.rivalry.deleteMany({ where: { OR: [{ userId: uid }, { rivalId: uid }] } });
  await db.authSession.deleteMany({ where: { userId: uid } });
  await db.report.deleteMany({ where: { reporterId: uid } });
  await db.user.delete({ where: { id: uid } });
  console.log("Deleted prim test account:", u.email);
}
await db.$disconnect();

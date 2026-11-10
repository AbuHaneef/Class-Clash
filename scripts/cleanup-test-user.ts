import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // 1. Ensure all grades with content have a live trainer bot
  const grades = await db.grade.findMany({ where: { hasContent: true }, orderBy: { order: "asc" } });
  const names = [
    ["Swift Owl", "owl"],
    ["Clever Fox", "fox"],
    ["Bold Lion", "lion"],
    ["Star Eagle", "eagle"],
    ["Bright Dolphin", "dolphin"],
    ["Quick Cheetah", "cheetah"],
    ["Sharp Falcon", "falcon"],
    ["Wise Panda", "panda"],
    ["Iron Tiger", "tiger"],
    ["Royal Phoenix", "phoenix"],
  ];
  for (let i = 0; i < grades.length; i++) {
    const g = grades[i];
    const [displayName, avatar] = names[i % names.length];
    const email = `live-trainer-${g.slug}@classclash.demo`;
    await db.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: "BOT",
        displayName,
        avatar,
        role: "student",
        gradeId: g.id,
        onboarded: true,
        isBot: true,
        isDemo: true,
        botSkill: 0.72,
        rating: 1000,
      },
      update: {
        gradeId: g.id,
        isBot: true,
        isDemo: true,
        deletedAt: null,
      },
    });
  }

  // 2. Clean up temporary test users
  const users = await db.user.findMany({
    where: {
      isBot: false,
      OR: [
        { email: { contains: "@test." } },
        { email: { startsWith: "live-" } },
      ],
    },
  });
  for (const u of users) {
    const uid = u.id;
    const heldCrowns = await db.champion.findMany({ where: { userId: uid } });
    for (const crown of heldCrowns) {
      const bot = await db.user.findFirst({ where: { isBot: true, gradeId: crown.gradeId } });
      if (bot) {
        await db.champion.update({ where: { id: crown.id }, data: { userId: bot.id, defences: 0 } });
      } else {
        await db.champion.delete({ where: { id: crown.id } });
      }
    }
    await db.championshipHistory.deleteMany({
      where: { OR: [{ formerChampionId: uid }, { newChampionId: uid }] },
    });
    const chs = await db.challenge.findMany({
      where: { OR: [{ creatorId: uid }, { opponentId: uid }] },
      select: { id: true },
    });
    for (const c of chs) {
      await db.challengeResult.deleteMany({ where: { challengeId: c.id } });
      await db.championshipHistory.deleteMany({ where: { challengeId: c.id } });
      await db.matchRecord.deleteMany({ where: { challengeId: c.id } });
      await db.challenge.deleteMany({ where: { id: c.id } });
    }
    await db.questionAttempt.deleteMany({ where: { quizSession: { userId: uid } } });
    await db.quizSession.deleteMany({ where: { userId: uid } });
    await db.matchRecord.deleteMany({ where: { OR: [{ userId: uid }, { opponentId: uid }] } });
    await db.dailyEntry.deleteMany({ where: { userId: uid } });
    await db.userMission.deleteMany({ where: { userId: uid } });
    await db.userBadge.deleteMany({ where: { userId: uid } });
    await db.notification.deleteMany({ where: { userId: uid } });
    await db.xPTransaction.deleteMany({ where: { userId: uid } });
    await db.authSession.deleteMany({ where: { userId: uid } });
    await db.report.deleteMany({ where: { reporterId: uid } });
    await db.rivalry.deleteMany({ where: { OR: [{ userId: uid }, { rivalId: uid }] } });
    await db.shareLink.deleteMany({ where: { userId: uid } });
    await db.auditLog.deleteMany({ where: { actorId: uid } });
    await db.tournamentMatch.deleteMany({ where: { OR: [{ player1Id: uid }, { player2Id: uid }, { winnerId: uid }] } });
    await db.tournamentParticipant.deleteMany({ where: { userId: uid } });
    const mySchools = await db.school.findMany({ where: { creatorId: uid }, select: { id: true } });
    for (const s of mySchools) {
      await db.user.updateMany({ where: { schoolId: s.id }, data: { schoolId: null } });
      await db.school.delete({ where: { id: s.id } });
    }
    await db.user.update({ where: { id: uid }, data: { schoolId: null } });
    await db.user.delete({ where: { id: uid } });
    console.log("Deleted test account:", u.email);
  }
  await db.school.deleteMany({ where: { name: { startsWith: "Apex Academy " } } });
  await db.$disconnect();
}

main();
export {};

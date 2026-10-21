import { db } from "@/lib/db";
import { levelFromXp, levelTitle, XP_RULES } from "../game";
import { isValidDateStr } from "./api";

// ─────────────────────────────────────────────────────────────
// XP — server-authoritative, with daily caps for farmable modes
// ─────────────────────────────────────────────────────────────

const DAILY_CAP_REASONS: Record<string, number> = {
  practice: XP_RULES.practiceDailyCap,
};

export async function awardXp(
  userId: string,
  amount: number,
  reason: string
): Promise<{ awarded: number; levelUp: boolean; newLevel: number }> {
  if (amount <= 0) return { awarded: 0, levelUp: false, newLevel: 0 };
  const cap = DAILY_CAP_REASONS[reason];
  if (cap !== undefined) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const spentToday = await db.xPTransaction.aggregate({
      where: { userId, reason, createdAt: { gte: startOfDay } },
      _sum: { amount: true },
    });
    const already = Math.max(0, spentToday._sum.amount ?? 0);
    if (already >= cap) return { awarded: 0, levelUp: false, newLevel: 0 };
    amount = Math.min(amount, cap - already);
  }

  const user = await db.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
  });
  await db.xPTransaction.create({
    data: { userId, amount, reason },
  });

  const beforeLevel = levelFromXp(user.xp - amount);
  const afterLevel = levelFromXp(user.xp);
  const levelUp = afterLevel > beforeLevel;
  if (levelUp) {
    await notify(userId, "level", `Level ${afterLevel} — ${levelTitle(afterLevel)}!`, `You reached level ${afterLevel}. Keep clashing!`, "/#/profile");
    await checkLevelBadges(userId, afterLevel);
  }
  return { awarded: amount, levelUp, newLevel: afterLevel };
}

// ─────────────────────────────────────────────────────────────
// Streaks — local-calendar-day policy supplied by the client
// ─────────────────────────────────────────────────────────────

export async function updateStreak(
  userId: string,
  localDate: string
): Promise<{ count: number; isNew: boolean; isNewRecord: boolean }> {
  if (!isValidDateStr(localDate)) localDate = new Date().toISOString().slice(0, 10);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { streakCount: true, longestStreak: true, lastStreakDate: true },
  });
  if (!user) return { count: 0, isNew: false, isNewRecord: false };
  if (user.lastStreakDate === localDate)
    return { count: user.streakCount, isNew: false, isNewRecord: false };

  const yesterday = new Date(localDate + "T12:00:00Z");
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const streak = user.lastStreakDate === yesterdayStr ? user.streakCount + 1 : 1;
  const isNewRecord = streak > user.longestStreak;
  await db.user.update({
    where: { id: userId },
    data: {
      streakCount: streak,
      longestStreak: Math.max(streak, user.longestStreak),
      lastStreakDate: localDate,
    },
  });
  await checkStreakBadges(userId, streak);
  return { count: streak, isNew: true, isNewRecord };
}

// ─────────────────────────────────────────────────────────────
// Badges — awarded by verified server-side events only
// ─────────────────────────────────────────────────────────────

export async function awardBadge(
  userId: string,
  code: string
): Promise<{ code: string; name: string; icon: string; color: string } | null> {
  const badge = await db.badge.findUnique({ where: { code } });
  if (!badge) return null;
  const existing = await db.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (existing) return null;
  await db.userBadge.create({ data: { userId, badgeId: badge.id } });
  await db.notification.create({
    data: {
      userId,
      type: "badge",
      title: `Badge unlocked: ${badge.name}`,
      body: badge.description,
      link: "/#/achievements",
    },
  });
  if (badge.xpReward > 0) {
    await db.user.update({ where: { id: userId }, data: { xp: { increment: badge.xpReward } } });
    await db.xPTransaction.create({
      data: { userId, amount: badge.xpReward, reason: "badge" },
    });
  }
  return { code: badge.code, name: badge.name, icon: badge.icon, color: badge.color };
}

async function checkLevelBadges(userId: string, level: number) {
  if (level >= 10) await awardBadge(userId, "level_10");
}

async function checkStreakBadges(userId: string, streak: number) {
  if (streak >= 5) await awardBadge(userId, "streak_5");
  if (streak >= 10) await awardBadge(userId, "streak_10");
}

export type QuizEventStats = {
  mode: string;
  subjectId: string;
  correctCount: number;
  totalCount: number;
  previousBestScore: number | null;
  isPersonalBest: boolean;
};

export async function checkQuizBadges(userId: string, stats: QuizEventStats) {
  const unlocked: { code: string; name: string; icon: string; color: string }[] = [];
  const push = async (code: string) => {
    const b = await awardBadge(userId, code);
    if (b) unlocked.push(b);
  };

  const anyCompleted = await db.quizSession.count({
    where: { userId, status: "completed" },
  });
  if (anyCompleted >= 1) await push("first_quiz");
  if (stats.totalCount > 0 && stats.correctCount === stats.totalCount) await push("perfect_score");
  if (stats.isPersonalBest && stats.previousBestScore !== null) await push("personal_best");

  // Subject explorer badges: 25+ answered in a subject family
  const answered = await db.questionAttempt.count({
    where: { quizSession: { userId }, question: { subjectId: stats.subjectId } },
  });
  if (answered >= 25) {
    const subject = await db.subject.findUnique({ where: { id: stats.subjectId } });
    if (subject) {
      const family = subject.slug;
      if (family === "mathematics") await push("explorer_math");
      if (family === "english-language") await push("explorer_english");
      if (["chemistry", "physics", "biology", "basic-science"].includes(family))
        await push("explorer_science");
    }
  }
  if (stats.mode === "quick_arena") {
    const arenas = await db.quizSession.count({
      where: { userId, mode: "quick_arena", status: "completed" },
    });
    if (arenas >= 10) await push("arena_10");
  }
  return unlocked;
}

export async function checkDuelBadges(
  userId: string,
  ctx: { won: boolean; firstDuel: boolean; winStreakAfterLoss: boolean; dailyCount: number }
) {
  const unlocked: { code: string; name: string; icon: string; color: string }[] = [];
  const push = async (code: string) => {
    const b = await awardBadge(userId, code);
    if (b) unlocked.push(b);
  };
  if (ctx.firstDuel) await push("duel_first");
  if (ctx.won) {
    const wins = await db.matchRecord.count({
      where: { userId, type: { in: ["duel", "champion"] }, result: "win" },
    });
    if (wins >= 5) await push("duel_win_5");
  }
  if (ctx.winStreakAfterLoss) await push("comeback");
  if (ctx.dailyCount >= 7) await push("daily_7");
}

// ─────────────────────────────────────────────────────────────
// Daily missions
// ─────────────────────────────────────────────────────────────

export type MissionMetric =
  | "practice_complete"
  | "questions_answered"
  | "arena_play"
  | "duel_play"
  | "daily_play";

export async function progressMissions(
  userId: string,
  localDate: string,
  metric: MissionMetric,
  amount: number
) {
  if (!isValidDateStr(localDate)) localDate = new Date().toISOString().slice(0, 10);
  const missions = await db.mission.findMany({
    where: { active: true, metric },
  });
  const completed: { code: string; name: string; xpReward: number }[] = [];
  for (const m of missions) {
    const row = await db.userMission.upsert({
      where: { userId_missionCode_date: { userId, missionCode: m.code, date: localDate } },
      create: { userId, missionCode: m.code, date: localDate, progress: 0 },
      update: {},
    });
    if (row.completed) continue;
    const progress = Math.min(m.target, row.progress + amount);
    const done = progress >= m.target;
    await db.userMission.update({
      where: { id: row.id },
      data: { progress, completed: done },
    });
    if (done) {
      completed.push({ code: m.code, name: m.name, xpReward: m.xpReward });
      await db.notification.create({
        data: {
          userId,
          type: "mission",
          title: `Mission complete: ${m.name}`,
          body: `Claim +${m.xpReward} XP in Today's Missions!`,
          link: "/#/",
        },
      });
    }
  }
  return completed;
}

/** Claim a completed mission's XP reward (once). */
export async function claimMission(userId: string, missionCode: string, localDate: string) {
  const mission = await db.mission.findUnique({ where: { code: missionCode } });
  if (!mission) return { awarded: 0 };
  const row = await db.userMission.findUnique({
    where: { userId_missionCode_date: { userId, missionCode, date: localDate } },
  });
  if (!row || !row.completed || row.claimed) return { awarded: 0 };
  await db.userMission.update({ where: { id: row.id }, data: { claimed: true } });
  return awardXp(userId, mission.xpReward, "mission");
}

// ─────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────

export async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string
) {
  await db.notification.create({
    data: { userId, type, title, body, link: link ?? null },
  });
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, todayStr, parseJson } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { levelProgress, CHALLENGE_STATUS_LABEL } from "@/lib/clash/game";
import { expireStaleChallenges } from "@/lib/clash/server/challenge";

// Aggregated student dashboard — one call, everything the home screen needs.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await expireStaleChallenges();
    const today = todayStr();

    const [full, unread] = await Promise.all([
      db.user.findUnique({ where: { id: user.id }, include: { grade: true } }),
      db.notification.count({ where: { userId: user.id, read: false } }),
    ]);
    if (!full) return Response.json({ ok: false, error: "Not found." }, { status: 404 });
    const level = levelProgress(user.xp);

    // ── Daily missions ──
    const missions = await db.mission.findMany({ where: { active: true } });
    const myMissions = await db.userMission.findMany({
      where: { userId: user.id, date: today },
    });
    const missionMap = new Map(myMissions.map((m) => [m.missionCode, m]));

    // ── Daily challenge status ──
    let daily: {
      subjectName: string;
      subjectColor: string;
      subjectIcon: string;
      questionCount: number;
      played: boolean;
      myScore: number | null;
    } | null = null;
    if (user.gradeId) {
      const row = await db.dailyChallenge.findUnique({
        where: { date_gradeId: { date: today, gradeId: user.gradeId } },
        include: { subject: true },
      });
      if (row) {
        const entry = await db.dailyEntry.findFirst({
          where: { dailyChallengeId: row.id, userId: user.id },
        });
        daily = {
          subjectName: row.subject.name,
          subjectColor: row.subject.color,
          subjectIcon: row.subject.icon,
          questionCount: parseJson<string[]>(row.questionIds, []).length,
          played: Boolean(entry),
          myScore: entry?.score ?? null,
        };
      }
    }

    // ── Champions for my grade (the showcase) ──
    const gradeChampions = user.gradeId
      ? await db.champion.findMany({
          where: { gradeId: user.gradeId },
          include: { user: true, subject: true, grade: true },
        })
      : [];
    const myTitles = gradeChampions.filter((c) => c.userId === user.id).length;

    // ── Recent activity: last practice sessions ──
    const recentSessions = await db.quizSession.findMany({
      where: { userId: user.id, status: "completed" },
      include: { subject: true },
      orderBy: { completedAt: "desc" },
      take: 4,
    });

    // ── Active challenges ──
    const activeChallenges = await db.challenge.findMany({
      where: {
        OR: [{ creatorId: user.id }, { opponentId: user.id }],
        status: { in: ["pending", "accepted", "in_progress"] },
      },
      include: { creator: true, opponent: true, subject: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // ── Weak topic recommendation (from real attempt data) ──
    const weakAttempts = await db.questionAttempt.findMany({
      where: { quizSession: { userId: user.id } },
      include: { question: { include: { topic: true, subject: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const topicAgg = new Map<
      string,
      { name: string; subject: string; subjectId: string; correct: number; total: number }
    >();
    for (const a of weakAttempts) {
      const key = a.question.topicId;
      const cur = topicAgg.get(key) ?? {
        name: a.question.topic.name,
        subject: a.question.subject.name,
        subjectId: a.question.subjectId,
        correct: 0,
        total: 0,
      };
      cur.total++;
      if (a.isCorrect) cur.correct++;
      topicAgg.set(key, cur);
    }
    const weakTopics = [...topicAgg.values()]
      .filter((t) => t.total >= 4)
      .map((t) => ({ ...t, accuracy: Math.round((t.correct / t.total) * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);

    const motivational = [
      "Every champion was once a beginner. Keep going!",
      "Small steps every day — that's how crowns are won.",
      "Your future self is cheering for you. One more quiz!",
      "Learn. Challenge. Climb. The crown awaits.",
      "Consistency beats talent when talent doesn't show up.",
    ];
    const dayIndex = Math.floor(Date.now() / 86_400_000);

    return ok({
      me: {
        displayName: full.displayName,
        avatar: full.avatar,
        gradeName: full.grade?.name ?? null,
        streakCount: full.streakCount,
        xp: full.xp,
        level,
        rating: full.rating,
        seasonPoints: full.seasonPoints,
        unread,
        myTitles,
        totalTitles: gradeChampions.length,
      },
      missions: missions.map((m) => {
        const um = missionMap.get(m.code);
        return {
          code: m.code,
          name: m.name,
          description: m.description,
          icon: m.icon,
          target: m.target,
          xpReward: m.xpReward,
          progress: um?.progress ?? 0,
          completed: um?.completed ?? false,
          claimed: um?.claimed ?? false,
        };
      }),
      daily,
      champions: gradeChampions.map((c) => ({
        subjectId: c.subjectId,
        gradeId: c.gradeId,
        subjectName: c.subject.name,
        subjectColor: c.subject.color,
        subjectIcon: c.subject.icon,
        championName: c.user.displayName,
        championAvatar: c.user.avatar,
        isBot: c.user.isBot,
        isMe: c.userId === user.id,
        defences: c.defences,
      })),
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        subjectId: s.subjectId,
        subjectName: s.subject.name,
        subjectColor: s.subject.color,
        subjectIcon: s.subject.icon,
        score: s.score,
        correctCount: s.correctCount,
        totalCount: s.totalCount,
        mode: s.mode,
        completedAt: s.completedAt,
      })),
      activeChallenges: activeChallenges.map((c) => ({
        id: c.id,
        type: c.type,
        status: c.status,
        statusLabel: CHALLENGE_STATUS_LABEL[c.status] ?? c.status,
        subjectName: c.subject.name,
        subjectColor: c.subject.color,
        opponentName: (c.creatorId === user.id ? c.opponent : c.creator)?.displayName ?? "Open invite",
        opponentAvatar: (c.creatorId === user.id ? c.opponent : c.creator)?.avatar ?? "fox",
        iAmCreator: c.creatorId === user.id,
        isChampion: c.type === "champion",
      })),
      weakTopics,
      motivational: motivational[dayIndex % motivational.length],
    });
  } catch (e) {
    return fail(e);
  }
}

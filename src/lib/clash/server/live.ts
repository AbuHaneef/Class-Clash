import { db } from "@/lib/db";
import { ApiError } from "./api";
import { shortCode } from "./auth";
import { getConfig } from "./config";
import { pickQuestionIds, fetchQuestionsWithMeta } from "./quiz";
import { sanitizeQuestion } from "./sanitize";
import { resolveChallengeIfReady } from "./challenge";
import { progressMissions, updateStreak } from "./gamification";

// ─────────────────────────────────────────────────────────────
// Live duels — server-side engine used by the socket.io mini
// service through internal HTTP endpoints. The service owns the
// real-time state machine; this module owns persistence, scoring
// authority and anti-cheat rules.
// ─────────────────────────────────────────────────────────────

export const LIVE_INTERNAL_KEY = process.env.LIVE_INTERNAL_KEY ?? "cc-live-internal-key-2026";

export function assertInternalKey(req: Request): void {
  const key = req.headers.get("x-internal-key");
  if (!key || key !== LIVE_INTERNAL_KEY) throw new ApiError(403, "Forbidden.");
}

function isId(v: unknown): v is string {
  return typeof v === "string" && /^[a-zA-Z0-9_-]{5,40}$/.test(v);
}

// ── auth: socket handshake validation ────────────────────────

export async function liveAuth(token: unknown) {
  if (typeof token !== "string" || token.length < 20 || token.length > 128)
    return { user: null };
  const session = await db.authSession.findUnique({
    where: { token },
    include: { user: { include: { grade: true } } },
  });
  if (!session || session.expiresAt < new Date()) return { user: null };
  const u = session.user;
  if (u.deletedAt) return { user: null };
  if (u.suspendedUntil && u.suspendedUntil > new Date()) return { user: null };
  return {
    user: {
      id: u.id,
      displayName: u.displayName,
      avatar: u.avatar,
      rating: u.rating,
      gradeId: u.gradeId,
      gradeName: u.grade?.name ?? null,
      onboarded: u.onboarded,
      isBot: u.isBot,
      seasonPoints: u.seasonPoints,
    },
  };
}

// ── start: create the challenge + hand out questions ─────────

export type LiveStartResult = {
  challengeId: string;
  code: string;
  subjectName: string;
  gradeName: string;
  questionCount: number;
  timePerQuestionSec: number;
  questions: ReturnType<typeof sanitizeQuestion>[];
  answerKey: { questionId: string; correctOptionId: string; basePoints: number }[];
  players: { userId: string; displayName: string; avatar: string; rating: number; isBot: boolean; botSkill: number }[];
};

export async function liveStart(body: {
  p1Id: unknown;
  p2Id: unknown; // real opponent userId, or "trainer" for a live trainer bot
  subjectId: unknown;
}): Promise<LiveStartResult> {
  if (!isId(body.p1Id)) throw new ApiError(400, "Bad request.");
  const wantsTrainer = body.p2Id === "trainer";

  const p1 = await db.user.findUnique({ where: { id: body.p1Id }, include: { grade: true } });
  if (!p1 || p1.deletedAt) throw new ApiError(404, "Player not found.");
  if (!p1.onboarded || !p1.gradeId) throw new ApiError(400, "Finish setting up your profile first.");

  let p2: typeof p1 | null;
  if (wantsTrainer) {
    let trainer = await db.user.findFirst({
      where: { isBot: true, gradeId: p1.gradeId, email: { startsWith: "live-trainer-" } },
      include: { grade: true },
    });
    if (!trainer && p1.grade) {
      trainer = await db.user.create({
        data: {
          email: `live-trainer-${p1.grade.slug}@classclash.demo`,
          passwordHash: "BOT",
          displayName: "Swift Owl",
          avatar: "owl",
          role: "student",
          gradeId: p1.gradeId,
          onboarded: true,
          isBot: true,
          isDemo: true,
          botSkill: 0.72,
          rating: 1000,
        },
        include: { grade: true },
      });
    }
    if (!trainer) throw new ApiError(404, "No live trainer available for your class yet.");
    p2 = trainer;
  } else {
    if (!isId(body.p2Id)) throw new ApiError(400, "Bad request.");
    p2 = await db.user.findUnique({ where: { id: body.p2Id }, include: { grade: true } });
    if (!p2 || p2.deletedAt) throw new ApiError(404, "Opponent not found.");
    if (!p2.onboarded || !p2.gradeId) throw new ApiError(400, "Opponent isn't ready.");
    if (p2.suspendedUntil && p2.suspendedUntil > new Date())
      throw new ApiError(400, "Opponent is temporarily restricted.");
  }
  if (p1.id === p2.id) throw new ApiError(400, "You can't duel yourself.");
  if (p1.gradeId !== p2.gradeId) throw new ApiError(400, "Live duels are same-class only.");
  if (!isId(body.subjectId)) throw new ApiError(400, "Bad request.");

  const subject = await db.subject.findUnique({ where: { id: body.subjectId } });
  if (!subject) throw new ApiError(404, "Subject not found.");
  const availability = await db.subjectGrade.findUnique({
    where: { subjectId_gradeId: { subjectId: subject.id, gradeId: p1.gradeId } },
  });
  if (!availability) throw new ApiError(400, `${subject.name} isn't available for your class.`);

  const count = await getConfig("liveDuelQuestions");
  const pool = await db.question.count({
    where: { gradeId: p1.gradeId, subjectId: subject.id, status: "published" },
  });
  if (pool < 5) throw new ApiError(400, `Not enough ${subject.name} questions for your class yet.`);

  const questionIds = await pickQuestionIds(p1.gradeId, subject.id, { count });
  const questions = await fetchQuestionsWithMeta(questionIds);
  if (questions.length < 5) throw new ApiError(400, "Not enough questions for a live duel yet.");

  const timePerQuestionSec = await getConfig("liveTimePerQuestion");

  const challenge = await db.challenge.create({
    data: {
      code: shortCode(6),
      type: "duel",
      status: "in_progress",
      isLive: true,
      subjectId: subject.id,
      gradeId: p1.gradeId,
      creatorId: p1.id,
      opponentId: p2.id,
      questionIds: JSON.stringify(questions.map((q) => q.id)),
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  // Answer key never leaves the server boundary: it goes to the live
  // service's memory only (never to a browser).
  const answerKey = questions.map((q) => {
    const correct = [...q.options].sort((a, b) => a.order - b.order).find((o) => o.isCorrect);
    return {
      questionId: q.id,
      correctOptionId: correct?.id ?? "",
      basePoints: q.points,
    };
  });

  return {
    challengeId: challenge.id,
    code: challenge.code,
    subjectName: subject.name,
    gradeName: p1.grade?.name ?? "",
    questionCount: questions.length,
    timePerQuestionSec,
    questions: questions.map((q) => sanitizeQuestion(q, { shuffle: false })),
    answerKey,
    players: [p1, p2].map((p) => ({
      userId: p.id,
      displayName: p.displayName,
      avatar: p.avatar,
      rating: p.rating,
      isBot: p.isBot,
      botSkill: p.botSkill ?? 0.72,
    })),
  };
}

// ── finish: persist attempts, resolve, return outcome ─────────

export type LiveFinishPlayer = {
  userId: string;
  score: number;
  correctCount: number;
  totalTimeMs: number;
  detail: { questionId: string; chosenOptionId: string | null; correct: boolean; timeSpentMs: number; points: number }[];
};

export type LiveFinishResult = {
  challengeId: string;
  winnerId: string | null;
  draw: boolean;
  summary: string;
  forfeit: boolean;
  byForfeit: boolean;
  players: {
    userId: string;
    displayName: string;
    score: number;
    correctCount: number;
    totalCount: number;
    ratingBefore: number | null;
    ratingAfter: number | null;
    ratingDelta: number | null;
    xpEarned: number;
  }[];
};

export async function liveFinish(body: {
  challengeId: unknown;
  forfeitWinnerId?: unknown;
  players?: unknown;
}): Promise<LiveFinishResult> {
  if (!isId(body.challengeId) || !Array.isArray(body.players) || body.players.length !== 2)
    throw new ApiError(400, "Bad request.");
  const forfeitWinnerId =
    typeof body.forfeitWinnerId === "string" && isId(body.forfeitWinnerId) ? body.forfeitWinnerId : null;

  const challenge = await db.challenge.findUnique({
    where: { id: body.challengeId },
    include: { creator: true, opponent: true, subject: true, grade: true, results: true },
  });
  if (!challenge || !challenge.isLive) throw new ApiError(404, "Live duel not found.");
  const participantIds = [challenge.creatorId, challenge.opponentId!];
  if (forfeitWinnerId && !participantIds.includes(forfeitWinnerId))
    throw new ApiError(400, "Bad forfeit winner.");

  const qIds: string[] = JSON.parse(challenge.questionIds);
  const questions = await fetchQuestionsWithMeta(qIds);
  const optionIndexById = new Map<string, Map<string, number>>();
  for (const q of questions) {
    const m = new Map<string, number>();
    [...q.options].sort((a, b) => a.order - b.order).forEach((o, i) => m.set(o.id, i));
    optionIndexById.set(q.id, m);
  }

  const players: LiveFinishPlayer[] = (body.players as LiveFinishPlayer[]).map((p) => ({
    userId: p.userId,
    score: Math.max(0, Math.min(100000, Math.round(Number(p.score) || 0))),
    correctCount: Math.max(0, Math.min(200, Math.round(Number(p.correctCount) || 0))),
    totalTimeMs: Math.max(0, Math.min(30 * 60 * 1000, Math.round(Number(p.totalTimeMs) || 0))),
    detail: Array.isArray(p.detail)
      ? p.detail
          .filter((d) => qIds.includes(d.questionId))
          .map((d) => ({
            questionId: d.questionId,
            chosenOptionId: typeof d.chosenOptionId === "string" ? d.chosenOptionId : null,
            correct: Boolean(d.correct),
            timeSpentMs: Math.max(0, Math.min(120000, Math.round(Number(d.timeSpentMs) || 0))),
            points: Math.max(0, Math.min(1000, Math.round(Number(d.points) || 0))),
          }))
      : [],
  }));
  for (const p of players) {
    if (!participantIds.includes(p.userId)) throw new ApiError(403, "Player not in this duel.");
  }
  if (players[0].userId === players[1].userId) throw new ApiError(400, "Duplicate player.");

  const alreadyCompleted = challenge.status === "completed";
  const localDate = new Date().toISOString().slice(0, 10);
  const t0 = new Date();

  if (!alreadyCompleted) {
    // 1. ChallengeResults (idempotent upserts)
    for (const p of players) {
      await db.challengeResult.upsert({
        where: { challengeId_userId: { challengeId: challenge.id, userId: p.userId } },
        create: {
          challengeId: challenge.id,
          userId: p.userId,
          score: p.score,
          correctCount: p.correctCount,
          totalCount: questions.length,
          totalTimeMs: p.totalTimeMs,
          detail: JSON.stringify(
            p.detail.map((d) => ({
              questionId: d.questionId,
              chosen: d.chosenOptionId ? optionIndexById.get(d.questionId)?.get(d.chosenOptionId) ?? -1 : -1,
              correct: d.correct,
            }))
          ),
        },
        update: {},
      });
    }

    // 2. QuizSessions + attempts for humans (feeds analytics & history)
    for (const p of players) {
      const user = p.userId === challenge.creatorId ? challenge.creator : challenge.opponent!;
      if (user.isBot) continue;
      const mine = challenge.creatorSessionId && p.userId === challenge.creatorId
        ? challenge.creatorSessionId
        : challenge.opponentSessionId && p.userId === challenge.opponentId
          ? challenge.opponentSessionId
          : null;
      if (mine) continue; // already persisted (retry safety)
      const session = await db.quizSession.create({
        data: {
          userId: p.userId,
          mode: "duel",
          gradeId: challenge.gradeId,
          subjectId: challenge.subjectId,
          topicId: null,
          status: "completed",
          questionIds: JSON.stringify(qIds),
          currentIndex: qIds.length,
          score: p.score,
          correctCount: p.correctCount,
          totalCount: questions.length,
          timeLimitPer: await getConfig("liveTimePerQuestion"),
          startedAt: challenge.createdAt,
          completedAt: new Date(),
        },
      });
      for (const d of p.detail) {
        await db.questionAttempt.create({
          data: {
            quizSessionId: session.id,
            questionId: d.questionId,
            selectedIndex: d.chosenOptionId
              ? optionIndexById.get(d.questionId)?.get(d.chosenOptionId) ?? -1
              : -1,
            isCorrect: d.correct,
            timeSpentMs: d.timeSpentMs,
            points: d.points,
          },
        });
      }
      await db.challenge.update({
        where: { id: challenge.id },
        data:
          p.userId === challenge.creatorId
            ? { creatorSessionId: session.id }
            : { opponentSessionId: session.id },
      });
      // Missions + streak for live duels (same as async duels)
      await progressMissions(p.userId, localDate, "duel_play", 1);
      await progressMissions(p.userId, localDate, "questions_answered", questions.length);
      await updateStreak(p.userId, localDate);
    }

    // 3. Resolve (ratings, season points, XP, badges, notifications)
    await resolveChallengeIfReady(challenge.id, {
      forcedWinnerId: forfeitWinnerId ?? undefined,
    });
  }

  // 4. Build the outcome payload (works for retries too)
  const fresh = await db.challenge.findUnique({
    where: { id: challenge.id },
    include: { creator: true, opponent: true },
  });
  if (!fresh) throw new ApiError(404, "Live duel vanished.");
  const winnerId = fresh.winnerId;
  const draw = fresh.draw;
  const nameOf = (id: string) =>
    id === fresh.creatorId ? fresh.creator.displayName : fresh.opponent!.displayName;

  const playerPayload: LiveFinishResult["players"] = [];
  for (const p of players) {
    const user = p.userId === fresh.creatorId ? fresh.creator : fresh.opponent!;
    const match = await db.matchRecord.findFirst({
      where: { userId: p.userId, challengeId: fresh.id },
      orderBy: { createdAt: "desc" },
    });
    const xpRow = await db.xPTransaction.findFirst({
      where: { userId: p.userId, reason: "duel", createdAt: { gte: t0 } },
      orderBy: { createdAt: "desc" },
    });
    playerPayload.push({
      userId: p.userId,
      displayName: user.displayName,
      score: p.score,
      correctCount: p.correctCount,
      totalCount: questions.length,
      ratingBefore: match?.ratingBefore ?? user.rating,
      ratingAfter: match?.ratingAfter ?? user.rating,
      ratingDelta: match ? match.ratingAfter - match.ratingBefore : null,
      xpEarned: xpRow?.amount ?? 0,
    });
  }

  const forfeitLabel = forfeitWinnerId ? " by forfeit" : "";
  const summary = draw
    ? `Draw ${players[0].score}–${players[1].score}`
    : `${nameOf(winnerId ?? players[0].userId)} won ${Math.max(players[0].score, players[1].score)}–${Math.min(
        players[0].score,
        players[1].score
      )}${forfeitLabel}`;

  return {
    challengeId: fresh.id,
    winnerId,
    draw,
    summary,
    forfeit: Boolean(forfeitWinnerId),
    byForfeit: Boolean(forfeitWinnerId),
    players: playerPayload,
  };
}

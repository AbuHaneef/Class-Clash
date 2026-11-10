import { db } from "@/lib/db";
import { ApiError, parseJson } from "./api";
import { questionPoints, speedBonus } from "../game";
import { sanitizeQuestion, sanitizeQuestionReview } from "./sanitize";
import { getConfig } from "./config";
import {
  awardXp,
  updateStreak,
  progressMissions,
  checkQuizBadges,
  claimMission,
} from "./gamification";
import { resolveChallengeIfReady, ChallengeOutcome } from "./challenge";

// Helper exists so the element type can be derived without a circular
// type alias (fetchQuestionsWithMeta itself returns QuestionWithMeta[]).
async function queryQuestionsWithMeta(ids: string[]) {
  return db.question.findMany({
    where: { id: { in: ids }, status: "published" },
    include: { options: true, topic: true, subject: true },
  });
}
type QuestionWithMeta = Awaited<ReturnType<typeof queryQuestionsWithMeta>>[number];

export async function fetchQuestionsWithMeta(ids: string[]) {
  const qs = await queryQuestionsWithMeta(ids);
  const map = new Map(qs.map((q) => [q.id, q]));
  return ids.map((id) => map.get(id)).filter(Boolean) as QuestionWithMeta[];
}

export async function pickQuestionIds(
  gradeId: string,
  subjectId: string,
  opts: { topicId?: string; difficulty?: string; count: number; excludeIds?: string[] }
): Promise<string[]> {
  const where: Record<string, unknown> = {
    gradeId,
    subjectId,
    status: "published",
  };
  if (opts.topicId) where.topicId = opts.topicId;
  if (opts.difficulty && ["easy", "medium", "hard"].includes(opts.difficulty))
    where.difficulty = opts.difficulty;
  if (opts.excludeIds?.length) where.id = { notIn: opts.excludeIds };
  const rows = await db.question.findMany({
    where,
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  // Fisher-Yates shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, opts.count);
}

// ─────────────────────────────────────────────────────────────
// Start a quiz session
// ─────────────────────────────────────────────────────────────

export async function startQuizSession(
  user: { id: string; gradeId: string | null; onboarded: boolean },
  params: {
    mode: string;
    subjectId?: string;
    topicId?: string;
    difficulty?: string;
    count?: number;
    challengeId?: string;
  }
) {
  if (!user.onboarded || !user.gradeId)
    throw new ApiError(400, "Finish setting up your profile first.");
  const gradeId = user.gradeId;
  const sessionExpiryHours = await getConfig("sessionExpiryHours");
  const maxQuestions = await getConfig("maxQuizQuestions");
  const expireOld = new Date(Date.now() - sessionExpiryHours * 3600 * 1000);

  // Expire stale sessions of this user (cheap, keeps state clean)
  await db.quizSession.updateMany({
    where: { userId: user.id, status: "in_progress", startedAt: { lt: expireOld } },
    data: { status: "expired" },
  });

  let questionIds: string[] = [];
  let timeLimitPer = 0;
  let subjectId = params.subjectId ?? "";
  let topicId = params.topicId ?? null;
  let challengeId: string | null = null;

  if (params.mode === "duel" || params.mode === "champion") {
    // ── Challenge-linked session ──
    if (!params.challengeId) throw new ApiError(400, "Missing challenge.");
    const challenge = await db.challenge.findUnique({
      where: { id: params.challengeId },
    });
    if (!challenge) throw new ApiError(404, "Challenge not found.");
    const isCreator = challenge.creatorId === user.id;
    const isOpponent = challenge.opponentId === user.id;
    if (!isCreator && !isOpponent) throw new ApiError(403, "This isn't your challenge.");
    if (!["accepted", "in_progress"].includes(challenge.status))
      throw new ApiError(400, "This challenge isn't active right now.");
    if (challenge.expiresAt < new Date()) {
      await db.challenge.updateMany({
        where: { id: challenge.id, status: { in: ["accepted", "in_progress"] } },
        data: { status: "expired" },
      });
      throw new ApiError(400, "This challenge has expired.");
    }
    // One session per participant per challenge
    const existing = await db.quizSession.findFirst({
      where: {
        status: "in_progress",
        id: isCreator ? challenge.creatorSessionId ?? "" : challenge.opponentSessionId ?? "",
      },
    });
    if (existing) return existing; // resume
    const done = isCreator ? challenge.creatorSessionId : challenge.opponentSessionId;
    if (done) throw new ApiError(400, "You already played this challenge.");

    questionIds = parseJson<string[]>(challenge.questionIds, []);
    if (questionIds.length === 0) throw new ApiError(400, "Challenge has no questions.");
    timeLimitPer = await getConfig("challengeTimePerQuestion");
    subjectId = challenge.subjectId;
    topicId = null;
    challengeId = challenge.id;
    await db.challenge.updateMany({
      where: { id: challenge.id, status: "accepted" },
      data: { status: "in_progress" },
    });
  } else if (params.mode === "daily") {
    // ── Daily challenge ──
    const date = new Date().toISOString().slice(0, 10);
    let daily = await db.dailyChallenge.findUnique({
      where: { date_gradeId: { date, gradeId } },
    });
    if (!daily) {
      const count = await getConfig("dailyQuestions");
      // Daily is subject-agnostic: rotate subjects deterministically by date
      const subjectRows = await db.subjectGrade.findMany({
        where: { gradeId },
        include: { subject: { select: { id: true, order: true } } },
      });
      const eligible = subjectRows.filter((s) => s.subject.id);
      if (eligible.length === 0) throw new ApiError(400, "No subjects available for your class yet.");
      const subjectOrder = eligible.sort(
        (a, b) => a.subject.order - b.subject.order
      );
      const dayNum = Math.floor(new Date(date + "T12:00:00Z").getTime() / 86400000);
      const subject = subjectOrder[dayNum % subjectOrder.length].subject;
      const ids = await pickQuestionIds(gradeId, subject.id, { count });
      if (ids.length === 0)
        throw new ApiError(400, "Daily challenge isn't ready for your class yet.");
      daily = await db.dailyChallenge.create({
        data: {
          date,
          gradeId,
          subjectId: subject.id,
          questionIds: JSON.stringify(ids),
        },
      });
    }
    // one entry per day
    const entry = await db.dailyEntry.findFirst({
      where: { dailyChallengeId: daily.id, userId: user.id },
      include: { quizSession: true },
    });
    if (entry) {
      if (entry.quizSession.status === "in_progress") return entry.quizSession;
      throw new ApiError(400, "You already played today's challenge. Come back tomorrow!");
    }
    questionIds = parseJson<string[]>(daily.questionIds, []);
    timeLimitPer = await getConfig("dailyTimePerQuestion");
    subjectId = daily.subjectId;
  } else {
    // ── practice | quick_arena | exam ──
    if (!params.subjectId) throw new ApiError(400, "Pick a subject.");
    const available = await db.subjectGrade.findUnique({
      where: { subjectId_gradeId: { subjectId: params.subjectId, gradeId } },
    });
    if (!available)
      throw new ApiError(400, "That subject isn't available for your class.");

    if (params.mode === "quick_arena") {
      questionIds = await pickQuestionIds(gradeId, params.subjectId, {
        count: await getConfig("arenaQuestions"),
      });
      timeLimitPer = await getConfig("arenaTimePerQuestion");
    } else {
      const defaultCount = params.mode === "exam" ? 15 : 10;
      const count = Math.min(
        maxQuestions,
        Math.max(3, params.count ?? defaultCount)
      );
      questionIds = await pickQuestionIds(gradeId, params.subjectId, {
        topicId: params.topicId ?? undefined,
        difficulty: params.difficulty,
        count,
      });
      timeLimitPer = params.mode === "exam" ? 0 : 0;
    }
    if (questionIds.length < 3)
      throw new ApiError(
        400,
        "Not enough questions in this topic yet. Try a different topic or subject."
      );
    topicId = params.topicId ?? null;
  }

  const questions = await fetchQuestionsWithMeta(questionIds);
  const session = await db.quizSession.create({
    data: {
      userId: user.id,
      mode: params.mode,
      gradeId,
      subjectId,
      topicId,
      status: "in_progress",
      questionIds: JSON.stringify(questions.map((q) => q.id)),
      totalCount: questions.length,
      timeLimitPer,
    },
  });

  // link to challenge
  if (challengeId) {
    const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
    if (challenge) {
      if (challenge.creatorId === user.id && !challenge.creatorSessionId) {
        await db.challenge.update({
          where: { id: challengeId },
          data: { creatorSessionId: session.id },
        });
      } else if (challenge.opponentId === user.id && !challenge.opponentSessionId) {
        await db.challenge.update({
          where: { id: challengeId },
          data: { opponentSessionId: session.id },
        });
      }
    }
  }

  return session;
}

// ─────────────────────────────────────────────────────────────
// Answer a question (server-side validation & scoring)
// ─────────────────────────────────────────────────────────────

export async function answerQuestion(
  userId: string,
  sessionId: string,
  body: { questionId: string; optionId: string | null; timeSpentMs: number }
) {
  const session = await db.quizSession.findUnique({
    where: { id: sessionId },
    include: { attempts: true },
  });
  if (!session || session.userId !== userId)
    throw new ApiError(404, "Quiz session not found.");
  if (session.status !== "in_progress")
    throw new ApiError(400, "This session is no longer active.");

  const expiryHours = await getConfig("sessionExpiryHours");
  if (session.startedAt < new Date(Date.now() - expiryHours * 3600 * 1000)) {
    await db.quizSession.update({ where: { id: session.id }, data: { status: "expired" } });
    throw new ApiError(400, "This session expired. Start a new one.");
  }

  const qIds = parseJson<string[]>(session.questionIds, []);
  if (!qIds.includes(body.questionId))
    throw new ApiError(400, "That question isn't part of this session.");
  if (session.attempts.some((a) => a.questionId === body.questionId))
    throw new ApiError(400, "You already answered this question.");

  const question = await db.question.findUnique({
    where: { id: body.questionId },
    include: { options: true },
  });
  if (!question) throw new ApiError(404, "Question not found.");
  const options = [...question.options].sort((a, b) => a.order - b.order);
  const chosenIndex = body.optionId
    ? options.findIndex((o) => o.id === body.optionId)
    : -1;
  if (body.optionId && chosenIndex === -1)
    throw new ApiError(400, "Invalid answer.");

  const isCorrect = chosenIndex >= 0 && options[chosenIndex]?.isCorrect === true;

  const competitive = ["quick_arena", "duel", "champion", "daily"].includes(session.mode);
  let points = 0;
  if (isCorrect) {
    points = questionPoints(question.difficulty);
    if (competitive && session.timeLimitPer > 0) {
      const late =
        body.timeSpentMs > session.timeLimitPer * 1000 + 3000; // 3s grace
      if (!late) points += speedBonus(body.timeSpentMs, session.timeLimitPer);
      else points = questionPoints(question.difficulty); // no speed bonus if late
    }
  }

  // Anti-abuse signal: impossibly fast answers get flagged for review
  const suspicious = body.timeSpentMs > 0 && body.timeSpentMs < 350;
  if (suspicious) {
    await db.quizSession.update({
      where: { id: session.id },
      data: { suspicionScore: { increment: 1 } },
    });
  }

  await db.questionAttempt.create({
    data: {
      quizSessionId: session.id,
      questionId: question.id,
      selectedIndex: chosenIndex,
      isCorrect,
      timeSpentMs: Math.max(0, Math.round(body.timeSpentMs)),
      points,
    },
  });
  const idx = qIds.indexOf(question.id);
  await db.quizSession.update({
    where: { id: session.id },
    data: {
      score: { increment: points },
      correctCount: { increment: isCorrect ? 1 : 0 },
      currentIndex: Math.max(session.currentIndex, idx + 1),
    },
  });

  if (session.mode === "practice" || session.mode === "guest") {
    const correctIndex = options.findIndex((o) => o.isCorrect);
    return {
      correct: isCorrect,
      correctIndex,
      correctOptionId: options[correctIndex]?.id ?? null,
      explanation: question.explanation,
      points,
    };
  }
  return { recorded: true };
}

// ─────────────────────────────────────────────────────────────
// Complete a session — scoring, XP, streaks, missions, badges
// ─────────────────────────────────────────────────────────────

export type CompleteResult = {
  sessionId: string;
  mode: string;
  score: number;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  xpEarned: number;
  levelUp: boolean;
  newLevel: number;
  newBadges: { code: string; name: string; icon: string; color: string }[];
  missionsCompleted: { code: string; name: string; xpReward: number }[];
  isPersonalBest: boolean;
  previousBest: number | null;
  streak: { count: number; isNew: boolean; isNewRecord: boolean };
  review: ReturnType<typeof sanitizeQuestionReview>[];
  totalTimeMs: number;
  challenge?: (ChallengeOutcome & { challengeId: string }) | null;
};

export async function completeQuizSession(
  userId: string,
  sessionId: string,
  localDate: string
): Promise<CompleteResult> {
  const session = await db.quizSession.findUnique({
    where: { id: sessionId },
    include: { attempts: true, subject: true },
  });
  if (!session || session.userId !== userId)
    throw new ApiError(404, "Quiz session not found.");

  if (session.status === "completed") {
    // idempotent: rebuild the read-only summary (including challenge outcome)
    const link = await db.challenge.findFirst({
      where: { OR: [{ creatorSessionId: session.id }, { opponentSessionId: session.id }] },
      include: { results: true, creator: true, opponent: true },
    });
    let priorChallenge: (ChallengeOutcome & { challengeId: string }) | null = null;
    if (link && link.status === "completed") {
      const my = link.results.find((r) => r.userId === userId);
      const their = link.results.find((r) => r.userId !== userId);
      const history = await db.championshipHistory.findFirst({ where: { challengeId: link.id } });
      const hi = Math.max(my?.score ?? 0, their?.score ?? 0);
      const lo = Math.min(my?.score ?? 0, their?.score ?? 0);
      const verdict = link.draw ? "Draw" : link.winnerId === userId ? "You won" : "You lost";
      priorChallenge = {
        challengeId: link.id,
        status: link.status,
        type: link.type,
        myResultUserId: userId,
        winnerId: link.winnerId,
        draw: link.draw,
        titleChanged: Boolean(history && history.newChampionId === userId),
        summary: `${verdict} ${hi}–${lo}${history && history.newChampionId === userId ? " — new champion crowned!" : ""}`,
      };
    }
    return buildCompletedResult(session, 0, false, 0, [], [], null, null, false, priorChallenge);
  }
  if (session.status !== "in_progress")
    throw new ApiError(400, "This session can't be completed.");

  const qIds = parseJson<string[]>(session.questionIds, []);
  const questions = await fetchQuestionsWithMeta(qIds);

  // Fill in skipped questions (unanswered = wrong, 0 points)
  const answered = new Map(session.attempts.map((a) => [a.questionId, a]));
  for (const q of questions) {
    if (!answered.has(q.id)) {
      await db.questionAttempt.create({
        data: {
          quizSessionId: session.id,
          questionId: q.id,
          selectedIndex: -1,
          isCorrect: false,
          timeSpentMs: 0,
          points: 0,
        },
      });
    }
  }

  const fresh = await db.quizSession.update({
    where: { id: session.id },
    data: { status: "completed", completedAt: new Date() },
    include: { attempts: true, subject: true },
  });

  // Personal best check (same mode + subject)
  const bestBefore = await db.quizSession.findFirst({
    where: {
      userId,
      subjectId: session.subjectId,
      mode: session.mode,
      status: "completed",
      id: { not: session.id },
    },
    orderBy: { score: "desc" },
    select: { score: true },
  });
  const previousBest = bestBefore?.score ?? null;
  const isPersonalBest = previousBest !== null && session.score > previousBest;

  // Streak (local calendar day supplied by client)
  const streak = await updateStreak(userId, localDate);

  // XP by mode
  let xpEarned = 0;
  let levelUp = false;
  let newLevel = 0;
  const missionsCompleted: { code: string; name: string; xpReward: number }[] = [];

  if (session.mode === "practice" || session.mode === "exam") {
    const r = await awardXp(
      userId,
      10 + 2 * session.correctCount,
      "practice"
    );
    xpEarned += r.awarded;
    levelUp = levelUp || r.levelUp;
    newLevel = Math.max(newLevel, r.newLevel);
    missionsCompleted.push(
      ...(await progressMissions(userId, localDate, "practice_complete", 1))
    );
  } else if (session.mode === "quick_arena") {
    const r = await awardXp(userId, 15 + 3 * session.correctCount, "arena");
    xpEarned += r.awarded;
    levelUp = levelUp || r.levelUp;
    newLevel = Math.max(newLevel, r.newLevel);
    missionsCompleted.push(...(await progressMissions(userId, localDate, "arena_play", 1)));
  } else if (session.mode === "daily") {
    const r = await awardXp(userId, 20 + 2 * session.correctCount, "daily");
    xpEarned += r.awarded;
    levelUp = levelUp || r.levelUp;
    newLevel = Math.max(newLevel, r.newLevel);
    missionsCompleted.push(...(await progressMissions(userId, localDate, "daily_play", 1)));
    // record the official daily entry
    const daily = await db.dailyChallenge.findFirst({
      where: {
        date: new Date().toISOString().slice(0, 10),
        gradeId: session.gradeId,
      },
    });
    if (daily) {
      const totalTimeMs = fresh.attempts.reduce((s, a) => s + a.timeSpentMs, 0);
      try {
        await db.dailyEntry.create({
          data: {
            dailyChallengeId: daily.id,
            userId,
            quizSessionId: session.id,
            score: session.score,
            correctCount: session.correctCount,
            totalTimeMs,
          },
        });
      } catch {
        // unique violation → already entered today; ignore
      }
    }
  }
  missionsCompleted.push(
    ...(await progressMissions(userId, localDate, "questions_answered", session.totalCount))
  );
  if (session.mode === "duel" || session.mode === "champion") {
    missionsCompleted.push(...(await progressMissions(userId, localDate, "duel_play", 1)));
  }

  // Badges
  const newBadges = await checkQuizBadges(userId, {
    mode: session.mode,
    subjectId: session.subjectId,
    correctCount: session.correctCount,
    totalCount: session.totalCount,
    previousBestScore: previousBest,
    isPersonalBest,
  });

  // Challenge-linked → record result & try to resolve
  let challenge: (ChallengeOutcome & { challengeId: string }) | null = null;
  if (session.mode === "duel" || session.mode === "champion") {
    const link = await db.challenge.findFirst({
      where: {
        OR: [{ creatorSessionId: session.id }, { opponentSessionId: session.id }],
      },
    });
    if (link) {
      const already = await db.challengeResult.findUnique({
        where: { challengeId_userId: { challengeId: link.id, userId } },
      });
      if (!already) {
        const totalTimeMs = fresh.attempts.reduce((s, a) => s + a.timeSpentMs, 0);
        const detail = fresh.attempts
          .sort(
            (a, b) =>
              qIds.indexOf(a.questionId) - qIds.indexOf(b.questionId)
          )
          .map((a) => ({
            questionId: a.questionId,
            chosen: a.selectedIndex,
            correct: a.isCorrect,
          }));
        await db.challengeResult.create({
          data: {
            challengeId: link.id,
            userId,
            score: session.score,
            correctCount: session.correctCount,
            totalCount: session.totalCount,
            totalTimeMs,
            detail: JSON.stringify(detail),
          },
        });
      }
      const outcome = await resolveChallengeIfReady(link.id);
      challenge = outcome ? { ...outcome, challengeId: link.id } : null;
    }
  }

  return buildCompletedResult(
    fresh,
    xpEarned,
    levelUp,
    newLevel,
    newBadges,
    missionsCompleted,
    previousBest,
    streak,
    isPersonalBest,
    challenge
  );
}

async function buildCompletedResult(
  session: {
    id: string;
    mode: string;
    score: number;
    correctCount: number;
    totalCount: number;
    subjectId: string;
    attempts: { questionId: string; selectedIndex: number }[];
  },
  xpEarned: number,
  levelUp: boolean,
  newLevel: number,
  newBadges: { code: string; name: string; icon: string; color: string }[],
  missionsCompleted: { code: string; name: string; xpReward: number }[],
  previousBest: number | null,
  streak: { count: number; isNew: boolean; isNewRecord: boolean } | null,
  isPersonalBest = false,
  challenge?: (ChallengeOutcome & { challengeId: string }) | null
): Promise<CompleteResult> {
  const qIds = parseJson<string[]>(session.id ? (await db.quizSession.findUnique({ where: { id: session.id } }))?.questionIds ?? "[]" : "[]", []);
  const questions = await fetchQuestionsWithMeta(qIds);
  const attemptMap = new Map(session.attempts.map((a) => [a.questionId, a]));
  const review = questions.map((q) =>
    sanitizeQuestionReview(q, attemptMap.get(q.id)?.selectedIndex ?? -1)
  );
  const totalTimeMs = (await db.questionAttempt.aggregate({
    where: { quizSessionId: session.id },
    _sum: { timeSpentMs: true },
  }))._sum.timeSpentMs ?? 0;

  return {
    sessionId: session.id,
    mode: session.mode,
    score: session.score,
    correctCount: session.correctCount,
    totalCount: session.totalCount,
    accuracy:
      session.totalCount > 0
        ? Math.round((session.correctCount / session.totalCount) * 100)
        : 0,
    xpEarned,
    levelUp,
    newLevel,
    newBadges,
    missionsCompleted,
    isPersonalBest,
    previousBest,
    streak: streak ?? { count: 0, isNew: false, isNewRecord: false },
    review,
    totalTimeMs,
    challenge: challenge ?? null,
  };
}

export { claimMission };

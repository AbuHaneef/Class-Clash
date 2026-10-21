import { db } from "@/lib/db";
import { ApiError, parseJson } from "./api";
import { shortCode } from "./auth";
import { getConfig } from "./config";
import { questionPoints, speedBonus, ratingDelta, XP_RULES } from "../game";
import {
  awardXp,
  awardBadge,
  notify,
  checkDuelBadges,
} from "./gamification";

// ─────────────────────────────────────────────────────────────
// Create a challenge (duel or champion challenge)
// ─────────────────────────────────────────────────────────────

export async function createChallenge(
  user: { id: string; gradeId: string | null; onboarded: boolean; displayName: string },
  params: { type: "duel" | "champion"; subjectId: string; opponentId?: string }
) {
  if (!user.onboarded || !user.gradeId)
    throw new ApiError(400, "Finish setting up your profile first.");
  const gradeId = user.gradeId;

  const subject = await db.subject.findUnique({ where: { id: params.subjectId } });
  if (!subject) throw new ApiError(404, "Subject not found.");
  const availability = await db.subjectGrade.findUnique({
    where: { subjectId_gradeId: { subjectId: params.subjectId, gradeId } },
  });
  if (!availability)
    throw new ApiError(400, `${subject.name} isn't available for your class.`);

  const questionCount = await getConfig("challengeQuestions");
  const pool = await db.question.count({
    where: { gradeId, subjectId: params.subjectId, status: "published" },
  });
  if (pool < 5)
    throw new ApiError(400, `Not enough ${subject.name} questions for your class yet.`);

  let opponentId: string | null;
  if (params.type === "duel") {
    if (params.opponentId) {
      if (params.opponentId === user.id) throw new ApiError(400, "You can't duel yourself.");
      const opponent = await db.user.findUnique({ where: { id: params.opponentId } });
      if (!opponent) throw new ApiError(404, "Opponent not found.");
      if (opponent.isBot) throw new ApiError(400, "Bots only accept Champion Challenges.");
      if (opponent.deletedAt) throw new ApiError(404, "Opponent not found.");
      if (opponent.gradeId !== gradeId)
        throw new ApiError(400, "You can only duel classmates (same class).");
      opponentId = opponent.id;
    } else {
      // Open invite — any eligible classmate can claim it via the link/code
      opponentId = null;
    }
  } else {
    // Champion challenge: opponent is the current title holder
    const champion = await db.champion.findUnique({
      where: { gradeId_subjectId: { gradeId, subjectId: params.subjectId } },
      include: { user: true },
    });
    if (!champion)
      throw new ApiError(400, "There's no champion for this subject yet — win a duel first!");
    if (champion.userId === user.id)
      throw new ApiError(400, "You already hold this title. Wait for challengers!");
    // Anti-farming: max pending challenges per champion
    const maxPending = await getConfig("maxPendingChallengesPerChampion");
    const pending = await db.challenge.count({
      where: {
        type: "champion",
        opponentId: champion.userId,
        status: { in: ["pending", "accepted", "in_progress"] },
      },
    });
    if (pending >= maxPending)
      throw new ApiError(
        400,
        `${champion.user.displayName} already has ${maxPending} challenges waiting. Try again later.`
      );
    // Cooldown between champion challenges by the same student
    const cooldownHours = await getConfig("championChallengeCooldownHours");
    const recent = await db.challenge.findFirst({
      where: {
        type: "champion",
        creatorId: user.id,
        opponentId: champion.userId,
        subjectId: params.subjectId,
        createdAt: { gte: new Date(Date.now() - cooldownHours * 3600 * 1000) },
      },
    });
    if (recent)
      throw new ApiError(
        400,
        `You challenged this champion recently. Cooldown is ${cooldownHours}h — keep practising!`
      );
    opponentId = champion.userId;
  }

  // Pick the shared question set (same for both players)
  const ids = await db.question.findMany({
    where: { gradeId, subjectId: params.subjectId, status: "published" },
    select: { id: true },
  });
  const shuffled = ids.map((r) => r.id);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const questionIds = shuffled.slice(0, questionCount);
  if (questionIds.length < 5)
    throw new ApiError(400, "Not enough questions for a challenge yet.");

  const expiryHours = await getConfig("challengeExpiryHours");

  const challenge = await db.challenge.create({
    data: {
      code: shortCode(6),
      type: params.type,
      status: "pending",
      subjectId: params.subjectId,
      gradeId,
      creatorId: user.id,
      opponentId,
      questionIds: JSON.stringify(questionIds),
      expiresAt: new Date(Date.now() + expiryHours * 3600 * 1000),
    },
    include: { creator: true, opponent: true, subject: true, grade: true },
  });

  if (opponentId && (await db.user.findUnique({ where: { id: opponentId } }))?.isBot) {
    // Demo guardians accept instantly and play their attempt right away
    await generateBotResult(challenge.id);
    await db.challenge.update({ where: { id: challenge.id }, data: { status: "accepted" } });
  } else if (opponentId) {
    const expiryH = expiryHours;
    await notify(
      opponentId,
      "challenge",
      params.type === "champion"
        ? `${user.displayName} wants your crown!`
        : `${user.displayName} challenged you to a duel`,
      `${subject.name} • ${challenge.grade.name}. You have ${expiryH}h to respond.`,
      `#/duel/${challenge.id}`
    );
  }

  // ── return fresh state (bot auto-accept may have changed status) ──
  return (await db.challenge.findUnique({ where: { id: challenge.id } })) ?? challenge;
}

// ─────────────────────────────────────────────────────────────
// Accept / decline / cancel
// ─────────────────────────────────────────────────────────────

export async function acceptChallenge(userId: string, challengeId: string) {
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new ApiError(404, "Challenge not found.");
  const accepter = await db.user.findUnique({ where: { id: userId } });
  if (!accepter) throw new ApiError(404, "Player not found.");

  const isDesignatedOpponent = challenge.opponentId === userId;
  const isOpenInvite = challenge.opponentId === "";
  if (!isDesignatedOpponent && !isOpenInvite)
    throw new ApiError(403, "Only the challenged player can accept.");
  if (isOpenInvite) {
    if (!accepter.onboarded || !accepter.gradeId)
      throw new ApiError(400, "Finish setting up your profile first.");
    if (accepter.gradeId !== challenge.gradeId)
      throw new ApiError(400, "This duel is for a different class.");
    if (accepter.id === challenge.creatorId)
      throw new ApiError(400, "You can't accept your own challenge.");
    // claim the open slot
    await db.challenge.update({
      where: { id: challengeId },
      data: { opponentId: userId },
    });
  }
  if (challenge.status !== "pending") throw new ApiError(400, "This challenge isn't pending.");
  if (challenge.expiresAt < new Date()) {
    await db.challenge.update({ where: { id: challengeId }, data: { status: "expired" } });
    throw new ApiError(400, "This challenge expired.");
  }
  await db.challenge.update({ where: { id: challengeId }, data: { status: "accepted" } });
  await notify(
    challenge.creatorId,
    "challenge",
    "Challenge accepted!",
    `${accepter.displayName} accepted your ${challenge.type === "champion" ? "Champion Challenge" : "duel"}.`,
    `#/duel/${challengeId}`
  );
}

export async function declineChallenge(userId: string, challengeId: string) {
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new ApiError(404, "Challenge not found.");
  if (challenge.opponentId !== userId)
    throw new ApiError(403, "Only the challenged player can decline.");
  if (challenge.status !== "pending") throw new ApiError(400, "This challenge isn't pending.");
  await db.challenge.update({ where: { id: challengeId }, data: { status: "declined" } });
  await notify(
    challenge.creatorId,
    "challenge",
    "Challenge declined",
    "Your opponent declined this challenge. Try another rival!",
    `#/duels`
  );
}

export async function cancelChallenge(userId: string, challengeId: string) {
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new ApiError(404, "Challenge not found.");
  if (challenge.creatorId !== userId)
    throw new ApiError(403, "Only the creator can cancel.");
  if (!["pending", "accepted"].includes(challenge.status))
    throw new ApiError(400, "This challenge can no longer be cancelled.");
  await db.challenge.update({ where: { id: challengeId }, data: { status: "cancelled" } });
  if (challenge.opponentId) {
    await notify(
      challenge.opponentId,
      "challenge",
      "Challenge cancelled",
      "Your opponent cancelled this challenge.",
      `#/duels`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Bot (demo guardian) attempt generation — happens at accept time
// so the bot's result is fixed before the human plays.
// ─────────────────────────────────────────────────────────────

export async function generateBotResult(challengeId: string) {
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || !challenge.opponentId) return;
  const bot = await db.user.findUnique({ where: { id: challenge.opponentId } });
  if (!bot?.isBot) return;

  const qIds = parseJson<string[]>(challenge.questionIds, []);
  const questions = await db.question.findMany({
    where: { id: { in: qIds }, status: "published" },
    include: { options: true },
  });
  const skill = bot.botSkill ?? 0.7;
  let score = 0;
  let correctCount = 0;
  let totalTimeMs = 0;
  const detail: { questionId: string; chosen: number; correct: boolean }[] = [];

  for (const q of questions) {
    const options = [...q.options].sort((a, b) => a.order - b.order);
    const correctIndex = options.findIndex((o) => o.isCorrect);
    const isCorrect = Math.random() < skill;
    const chosen = isCorrect
      ? correctIndex
      : options.findIndex((o) => !o.isCorrect && Math.random() < 0.5) >= 0
        ? options.findIndex((o) => !o.isCorrect) // first wrong option fallback
        : (correctIndex + 1) % options.length;
    const time = 6000 + Math.floor(Math.random() * 14000);
    totalTimeMs += time;
    if (isCorrect) {
      correctCount++;
      score += questionPoints(q.difficulty) + speedBonus(time, 25);
    }
    detail.push({
      questionId: q.id,
      chosen: chosen >= 0 ? chosen : 0,
      correct: isCorrect,
    });
  }

  await db.challengeResult.upsert({
    where: { challengeId_userId: { challengeId, userId: bot.id } },
    create: {
      challengeId,
      userId: bot.id,
      score,
      correctCount,
      totalCount: questions.length,
      totalTimeMs,
      detail: JSON.stringify(detail),
    },
    update: {},
  });
}

// ─────────────────────────────────────────────────────────────
// Resolution — transaction-safe, idempotent, tie-broken
// ─────────────────────────────────────────────────────────────

export type ChallengeOutcome = {
  status: string;
  type: string;
  myResultUserId: string; // filled by caller context
  winnerId: string | null;
  draw: boolean;
  titleChanged: boolean;
  summary: string;
};

/**
 * Resolves a challenge when both participants have completed attempts.
 * Exactly-once guarantee: the status transition is claimed with a
 * conditional updateMany, so concurrent completions cannot double-award.
 * `forcedWinnerId` (live duels: opponent left mid-match) overrides the
 * score tie-break and must be one of the two participants.
 */
export async function resolveChallengeIfReady(
  challengeId: string,
  opts: { forcedWinnerId?: string } = {}
): Promise<ChallengeOutcome | null> {
  const challenge = await db.challenge.findUnique({
    where: { id: challengeId },
    include: { results: true, creator: true, opponent: true, subject: true, grade: true },
  });
  if (!challenge) return null;
  if (!["accepted", "in_progress"].includes(challenge.status)) return null;
  if (challenge.results.length < 2 || !challenge.opponentId) return null;

  // Claim the resolution — atomic guard against double resolution
  const claimed = await db.challenge.updateMany({
    where: { id: challengeId, status: { in: ["accepted", "in_progress"] } },
    data: { status: "completed", completedAt: new Date() },
  });
  if (claimed.count === 0) return null; // someone else resolved first

  const creatorResult = challenge.results.find((r) => r.userId === challenge.creatorId)!;
  const opponentResult = challenge.results.find((r) => r.userId === challenge.opponentId)!;
  const opponent = challenge.opponent;
  if (!opponent) return null;

  // Published tie-break order: score → correct → total time → rating → draw
  // (live-duel forfeits override this entirely)
  let winnerId: string | null = null;
  if (opts.forcedWinnerId && [challenge.creatorId, challenge.opponentId].includes(opts.forcedWinnerId)) {
    winnerId = opts.forcedWinnerId;
  } else if (creatorResult.score !== opponentResult.score) {
    winnerId =
      creatorResult.score > opponentResult.score ? challenge.creatorId : challenge.opponentId;
  } else if (creatorResult.correctCount !== opponentResult.correctCount) {
    winnerId =
      creatorResult.correctCount > opponentResult.correctCount
        ? challenge.creatorId
        : challenge.opponentId;
  } else if (creatorResult.totalTimeMs !== opponentResult.totalTimeMs) {
    winnerId =
      creatorResult.totalTimeMs < opponentResult.totalTimeMs
        ? challenge.creatorId
        : challenge.opponentId;
  } else if (!challenge.creator.isBot && !challenge.opponent.isBot) {
    winnerId =
      challenge.creator.rating >= challenge.opponent.rating
        ? challenge.creatorId
        : challenge.opponentId;
  }
  const draw = winnerId === null;

  await db.challenge.update({
    where: { id: challengeId },
    data: { winnerId, draw },
  });

  const creator = challenge.creator;
  const creatorWon = winnerId === creator.id;
  const opponentWon = winnerId === opponent.id;

  // ── Ratings & season points (real players only) ──
  if (!creator.isBot && !opponent.isBot) {
    const cScore: 0 | 0.5 | 1 = draw ? 0.5 : creatorWon ? 1 : 0;
    const cDelta = ratingDelta(creator.rating, opponent.rating, cScore);
    const oDelta = -cDelta;
    await db.user.update({
      where: { id: creator.id },
      data: {
        rating: Math.max(100, creator.rating + cDelta),
        seasonPoints: { increment: draw ? 2 : creatorWon ? 3 : 1 },
      },
    });
    await db.user.update({
      where: { id: opponent.id },
      data: {
        rating: Math.max(100, opponent.rating + oDelta),
        seasonPoints: { increment: draw ? 2 : opponentWon ? 3 : 1 },
      },
    });
    await db.matchRecord.create({
      data: {
        userId: creator.id,
        opponentId: opponent.id,
        challengeId,
        type: challenge.type,
        result: draw ? "draw" : creatorWon ? "win" : "loss",
        ratingBefore: creator.rating,
        ratingAfter: creator.rating + cDelta,
        score: creatorResult.score,
        opponentScore: opponentResult.score,
      },
    });
    await db.matchRecord.create({
      data: {
        userId: opponent.id,
        opponentId: creator.id,
        challengeId,
        type: challenge.type,
        result: draw ? "draw" : opponentWon ? "win" : "loss",
        ratingBefore: opponent.rating,
        ratingAfter: opponent.rating + oDelta,
        score: opponentResult.score,
        opponentScore: creatorResult.score,
      },
    });
  } else {
    // vs bot: season points only (rating stays fair — bots are static)
    const human = creator.isBot ? opponent : creator;
    const humanWon = creator.isBot ? opponentWon : creatorWon;
    await db.user.update({
      where: { id: human.id },
      data: { seasonPoints: { increment: draw ? 2 : humanWon ? 3 : 1 } },
    });
    await db.matchRecord.create({
      data: {
        userId: human.id,
        opponentId: creator.isBot ? creator.id : opponent.id,
        challengeId,
        type: challenge.type,
        result: draw ? "draw" : humanWon ? "win" : "loss",
        ratingBefore: human.rating,
        ratingAfter: human.rating,
        score: creator.isBot ? opponentResult.score : creatorResult.score,
        opponentScore: creator.isBot ? creatorResult.score : opponentResult.score,
      },
    });
  }

  // ── Championship transfer ──
  let titleChanged = false;
  if (challenge.type === "champion") {
    const currentChampion = await db.champion.findUnique({
      where: { gradeId_subjectId: { gradeId: challenge.gradeId, subjectId: challenge.subjectId } },
    });
    // Only transfer if the opponent is STILL the current champion
    // (protects against two simultaneous challengers)
    if (currentChampion?.userId === opponent.id && creatorWon) {
      await db.champion.update({
        where: { gradeId_subjectId: { gradeId: challenge.gradeId, subjectId: challenge.subjectId } },
        data: { userId: creator.id, wonAt: new Date(), defences: 0 },
      });
      await db.championshipHistory.create({
        data: {
          gradeId: challenge.gradeId,
          subjectId: challenge.subjectId,
          formerChampionId: opponent.id,
          newChampionId: creator.id,
          challengeId,
          note: `Won Champion Challenge vs ${opponent.displayName}`,
        },
      });
      titleChanged = true;
      if (!creator.isBot) {
        await awardBadge(creator.id, "champion");
        await awardXp(creator.id, XP_RULES.championWin, "champion_win");
        await notify(
          creator.id,
          "champion",
          `You are the new ${challenge.subject.name} Champion!`,
          `You took the ${challenge.subject.name} • ${challenge.grade.name} crown. Share it!`,
          `#/champions`
        );
      }
      if (!opponent.isBot) {
        await awardXp(opponent.id, XP_RULES.championLoss, "champion_loss");
        await notify(
          opponent.id,
          "champion",
          `You lost the ${challenge.subject.name} crown`,
          `${creator.displayName} defeated you in a Champion Challenge. You can challenge them back after the cooldown.`,
          `#/champions`
        );
      }
    } else if (currentChampion?.userId === opponent.id && opponentWon) {
      await db.champion.update({
        where: { gradeId_subjectId: { gradeId: challenge.gradeId, subjectId: challenge.subjectId } },
        data: { defences: { increment: 1 } },
      });
      if (!opponent.isBot) {
        await awardBadge(opponent.id, "defender");
        await awardXp(opponent.id, XP_RULES.championDefence, "champion_defence");
        await notify(
          opponent.id,
          "champion",
          `Title defended!`,
          `You defended your ${challenge.subject.name} • ${challenge.grade.name} crown.`,
          `#/champions`
        );
      }
      if (!creator.isBot) {
        await awardXp(creator.id, XP_RULES.championLoss, "champion_loss");
        await notify(
          creator.id,
          "champion",
          `Challenge lost — the champion holds`,
          `${opponent.displayName} defended the title. Train up and try again!`,
          `#/champions`
        );
      }
    } else if (currentChampion?.userId === opponent.id && draw) {
      // draw → champion retains
      if (!creator.isBot)
        await notify(
          creator.id,
          "champion",
          `It's a draw — the champion holds`,
          `Dead even! The title stays with ${opponent.displayName}. Try again after the cooldown.`,
          `#/champions`
        );
      if (!opponent.isBot)
        await notify(
          opponent.id,
          "champion",
          `You held your title with a draw`,
          `Nobody blinked. You keep the ${challenge.subject.name} crown.`,
          `#/champions`
        );
    } else {
      // Title changed hands while this challenge was in flight
      if (!creator.isBot)
        await notify(
          creator.id,
          "champion",
          `Title changed hands mid-challenge`,
          `The crown moved while you were playing. Challenge the new champion to claim it!`,
          `#/champions`
        );
    }
  } else {
    // Regular duel XP + notifications
    for (const [u, won] of [
      [creator, creatorWon],
      [opponent, opponentWon],
    ] as const) {
      if (u.isBot) continue;
      await awardXp(u.id, won ? XP_RULES.duelWin : draw ? 20 : XP_RULES.duelLoss, "duel");
      await notify(
        u.id,
        "challenge",
        won ? "Victory!" : draw ? "It's a draw!" : "So close!",
        `${challenge.subject.name} duel vs ${
          (u.id === creator.id ? opponent : creator).displayName
        }: ${u.id === creator.id ? creatorResult.score : opponentResult.score} – ${
          u.id === creator.id ? opponentResult.score : creatorResult.score
        }`,
        `#/duel/${challengeId}`
      );
    }
  }

  // Comeback badge: won after losing the previous match
  for (const u of [creator, opponent]) {
    if (u.isBot) continue;
    const won = u.id === creator.id ? creatorWon : opponentWon;
    if (won) {
      const previous = await db.matchRecord.findFirst({
        where: { userId: u.id, type: { in: ["duel", "champion"] } },
        orderBy: { createdAt: "desc" },
      });
      // previous here is pre-insertion state; the new record exists now, so check second
      const lastTwo = await db.matchRecord.findMany({
        where: { userId: u.id, type: { in: ["duel", "champion"] } },
        orderBy: { createdAt: "desc" },
        take: 2,
      });
      if (lastTwo.length === 2 && lastTwo[0].result === "win" && lastTwo[1].result === "loss") {
        await awardBadge(u.id, "comeback");
      }
      void previous;
    }
  }

  // Duel debut badges
  for (const u of [creator, opponent]) {
    if (u.isBot) continue;
    const count = await db.matchRecord.count({ where: { userId: u.id } });
    if (count === 1) await awardBadge(u.id, "duel_first");
    const wins = await db.matchRecord.count({
      where: { userId: u.id, type: { in: ["duel", "champion"] }, result: "win" },
    });
    if (wins >= 5) await awardBadge(u.id, "duel_win_5");
  }

  const winner = winnerId ? (winnerId === creator.id ? creator : opponent) : null;
  const summary = draw
    ? `Draw ${creatorResult.score}–${opponentResult.score}`
    : `${winner?.displayName} won ${Math.max(creatorResult.score, opponentResult.score)}–${Math.min(
        creatorResult.score,
        opponentResult.score
      )}${titleChanged ? " — new champion crowned!" : ""}`;

  return {
    status: "completed",
    type: challenge.type,
    myResultUserId: "",
    winnerId,
    draw,
    titleChanged,
    summary,
  };
}

/** Lazily expire stale challenges (called from list endpoints). */
export async function expireStaleChallenges() {
  await db.challenge.updateMany({
    where: {
      status: { in: ["pending", "accepted", "in_progress"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });
}

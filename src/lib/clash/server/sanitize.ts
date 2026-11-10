import type {
  Question,
  QuestionOption,
  User,
  Grade,
  Subject,
  Topic,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Sanitizers — the frontend must NEVER receive answer keys for
// questions it has not answered yet.
// ─────────────────────────────────────────────────────────────

export type SanitizedOption = { id: string; text: string };

export type SanitizedQuestion = {
  id: string;
  text: string;
  type: string;
  difficulty: string;
  points: number;
  timeLimit: number;
  imageUrl: string | null;
  options: SanitizedOption[];
  subjectName: string;
  topicName: string;
};

export function sanitizeQuestion(
  q: Question & {
    options: QuestionOption[];
    subject?: Subject | null;
    topic?: Topic | null;
  },
  opts?: { shuffle?: boolean }
): SanitizedQuestion {
  let options = [...q.options].sort((a, b) => a.order - b.order);
  if (opts?.shuffle !== false) {
    // deterministic Fisher-Yates so server & client agree across refetches
    let seed = hashStr(q.id);
    for (let i = options.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
  }
  return {
    id: q.id,
    text: q.text,
    type: q.type,
    difficulty: q.difficulty,
    points: q.points,
    timeLimit: q.timeLimit,
    imageUrl: q.imageUrl ?? null,
    options: options.map((o) => ({ id: o.id, text: o.text })),
    subjectName: q.subject?.name ?? "",
    topicName: q.topic?.name ?? "",
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h || 1;
}

/** Full review payload — only for completed sessions / after answering. */
export function sanitizeQuestionReview(
  q: Question & { options: QuestionOption[]; topic?: Topic | null },
  chosenIndex: number
) {
  const options = [...q.options].sort((a, b) => a.order - b.order);
  const correctIndex = options.findIndex((o) => o.isCorrect);
  return {
    id: q.id,
    text: q.text,
    imageUrl: q.imageUrl ?? null,
    difficulty: q.difficulty,
    explanation: q.explanation,
    options: options.map((o) => o.text),
    correctIndex,
    chosenIndex,
    topicName: q.topic?.name ?? "",
  };
}

// ── Users ────────────────────────────────────────────────────

export function publicUser(
  u: User & {
    grade?: Grade | null;
    champions?: { id: string; wonAt: Date; defences: number }[];
  }
) {
  const isBot = u.isBot;
  return {
    id: u.id,
    displayName: u.displayName,
    avatar: u.avatar,
    level: null, // computed by caller for bots to avoid XP queries
    xp: isBot ? null : u.xp,
    rating: isBot ? null : u.rating,
    gradeName: u.grade?.name ?? null,
    isBot,
    isDemo: u.isDemo,
    streakCount: isBot ? null : u.streakCount,
  };
}

export function meUser(u: User & { grade?: Grade | null; school?: { id: string; name: string } | null }) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatar: u.avatar,
    role: u.role,
    gradeId: u.gradeId,
    gradeName: u.grade?.name ?? null,
    schoolId: u.schoolId,
    schoolName: u.school?.name ?? null,
    onboarded: u.onboarded,
    xp: u.xp,
    rating: u.rating,
    seasonPoints: u.seasonPoints,
    streakCount: u.streakCount,
    longestStreak: u.longestStreak,
    lastStreakDate: u.lastStreakDate,
    soundEnabled: u.soundEnabled,
    suspendedUntil: u.suspendedUntil,
    createdAt: u.createdAt,
  };
}

export type MeUser = ReturnType<typeof meUser>;

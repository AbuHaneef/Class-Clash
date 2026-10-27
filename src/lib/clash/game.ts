// ─────────────────────────────────────────────────────────────
// ClassClash shared game logic (used on both server & client)
// ─────────────────────────────────────────────────────────────

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.5,
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/** Points for one answer. Base 100 × difficulty multiplier, rounded. */
export function questionPoints(difficulty: string): number {
  return Math.round(100 * (DIFFICULTY_MULTIPLIER[difficulty as Difficulty] ?? 1));
}

/** Speed bonus for competitive modes: up to +20 for fast (correct) answers. */
export function speedBonus(timeSpentMs: number, timeLimitSec: number): number {
  if (timeLimitSec <= 0) return 0;
  const frac = 1 - Math.min(1, timeSpentMs / (timeLimitSec * 1000));
  return Math.round(20 * frac);
}

// ── Levels ───────────────────────────────────────────────────
// Cumulative XP needed to REACH level L: 50 × (L-1) × L
// L1=0, L2=100, L3=300, L4=600, L5=1000, L6=1500, L7=2100 …

export function xpToReach(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * (l - 1) * l;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpToReach(level + 1) <= xp) level++;
  return level;
}

export function levelProgress(xp: number): {
  level: number;
  current: number;
  nextAt: number;
  intoLevel: number;
  needed: number;
  pct: number;
  title: string;
} {
  const level = levelFromXp(xp);
  const current = xpToReach(level);
  const nextAt = xpToReach(level + 1);
  const intoLevel = xp - current;
  const needed = nextAt - current;
  return {
    level,
    current,
    nextAt,
    intoLevel,
    needed,
    pct: Math.min(100, Math.round((intoLevel / needed) * 100)),
    title: levelTitle(level),
  };
}

export const LEVEL_TITLES = [
  "Rookie", // 1
  "Learner", // 2
  "Explorer", // 3
  "Scholar", // 4
  "Contender", // 5
  "Challenger", // 6
  "Elite", // 7
  "Specialist", // 8
  "Master", // 9
  "Grandmaster", // 10
  "Legend", // 11
  "Hall of Fame", // 12+
];

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length) - 1] ?? "Legend";
}

// ── XP award table (server-authoritative; published in How to Play) ──

export const XP_RULES = {
  practiceComplete: 10,
  practiceCorrect: 2,
  practiceDailyCap: 120, // max XP per day from practice mode
  arenaComplete: 15,
  arenaCorrect: 3,
  duelWin: 40,
  duelLoss: 12,
  championWin: 100,
  championDefence: 60,
  championLoss: 15,
  dailyComplete: 20,
  dailyCorrect: 2,
} as const;

// ── Elo-lite rating ──────────────────────────────────────────

export function ratingDelta(
  mine: number,
  opponent: number,
  score: 0 | 0.5 | 1,
  k = 32
): number {
  const expected = 1 / (1 + Math.pow(10, (opponent - mine) / 400));
  return Math.round(k * (score - expected));
}

// ── Modes & statuses ─────────────────────────────────────────

export type QuizMode =
  | "practice"
  | "quick_arena"
  | "exam"
  | "duel"
  | "champion"
  | "daily"
  | "guest";

export const MODE_LABEL: Record<string, string> = {
  practice: "Practice",
  quick_arena: "Quick Arena",
  exam: "Exam Prep",
  duel: "Duel",
  champion: "Champion Challenge",
  daily: "Daily Challenge",
  guest: "Guest Preview",
};

export const COMPETITIVE_MODES: QuizMode[] = [
  "quick_arena",
  "duel",
  "champion",
  "daily",
];

export const CHALLENGE_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for reply",
  accepted: "Accepted",
  in_progress: "In progress",
  completed: "Completed",
  expired: "Expired",
  declined: "Declined",
  cancelled: "Cancelled",
};

// ── Formatting helpers (client display) ──────────────────────

export function formatXp(xp: number): string {
  if (xp >= 10000) return `${(xp / 1000).toFixed(1)}k`;
  return String(xp);
}

export function timeAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function formatMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Safety: display name rules ───────────────────────────────

const BANNED_NAME_PATTERNS = [
  /\badmin\b/i,
  /\bmoderator\b/i,
  /\bclassclash\b/i,
  /\bfuck|\bshit\b|\bbitch\b|\bdick\b|\bass\b/i,
  /\bsexy\b/i,
  /\bnigg/i,
  /\d{6,}/, // long numbers (phone numbers)
  /@|\./, // emails / handles
];

export function validateDisplayName(
  name: string
): { ok: true } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 16)
    return { ok: false, error: "Display name must be 3–16 characters." };
  if (!/^[a-zA-Z0-9 _'-]+$/.test(trimmed))
    return {
      ok: false,
      error: "Use letters, numbers, spaces, - ' _ only (no emojis or symbols).",
    };
  for (const p of BANNED_NAME_PATTERNS)
    if (p.test(trimmed))
      return {
        ok: false,
        error: "That name isn't allowed. Pick something fun and safe!",
      };
  if (/(.)\1{3,}/.test(trimmed))
    return { ok: false, error: "Too many repeated characters." };
  return { ok: true };
}

import { db } from "@/lib/db";

// Platform-configurable values with sensible defaults.
// Admins can tune these from the admin panel (audit-logged).
export const CONFIG_DEFAULTS = {
  arenaQuestions: "7",
  arenaTimePerQuestion: "20",
  challengeQuestions: "8",
  challengeTimePerQuestion: "25",
  challengeExpiryHours: "48",
  maxPendingChallengesPerChampion: "2",
  championChallengeCooldownHours: "12",
  dailyQuestions: "5",
  dailyTimePerQuestion: "30",
  sessionExpiryHours: "2",
  maxQuizQuestions: "20",
} as const;

export type ConfigKey = keyof typeof CONFIG_DEFAULTS;

export async function getConfig(key: ConfigKey): Promise<number> {
  const row = await db.platformConfig.findUnique({ where: { key } });
  const raw = row?.value ?? CONFIG_DEFAULTS[key];
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number(CONFIG_DEFAULTS[key]);
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const rows = await db.platformConfig.findMany();
  const out: Record<string, string> = { ...CONFIG_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setConfig(key: string, value: string) {
  await db.platformConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

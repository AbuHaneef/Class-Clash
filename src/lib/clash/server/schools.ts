import { db } from "@/lib/db";
import { ApiError } from "./api";
import { shortCode } from "./auth";
import { levelProgress } from "../game";

// ─────────────────────────────────────────────────────────────
// School leagues — create/join/leave + league table aggregation
// League points = sum of members' season points (competitive
// points earned in duels, champion matches and live duels).
// ─────────────────────────────────────────────────────────────

export const SCHOOL_COLORS = [
  "#f5c518", // gold
  "#a855f7", // violet
  "#10b981", // emerald
  "#f43f5e", // rose
  "#f97316", // orange
  "#22d3ee", // cyan
] as const;

export function validateSchoolName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 4 || trimmed.length > 40)
    throw new ApiError(400, "School name must be 4–40 characters.");
  if (!/^[a-zA-Z0-9 .,'\-()&]+$/.test(trimmed))
    throw new ApiError(400, "Use letters, numbers and .,'-()& only.");
  return trimmed;
}

export function slugifySchool(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "school";
}

export async function createSchool(
  user: { id: string; onboarded: boolean; schoolId: string | null; displayName: string },
  params: { name: string; motto?: string; color?: string }
) {
  if (!user.onboarded) throw new ApiError(400, "Finish setting up your profile first.");
  if (user.schoolId) throw new ApiError(400, "Leave your current school before creating a new one.");
  const name = validateSchoolName(params.name);
  const motto =
    typeof params.motto === "string" && params.motto.trim()
      ? params.motto.trim().slice(0, 80)
      : null;
  const color = SCHOOL_COLORS.includes((params.color ?? "") as (typeof SCHOOL_COLORS)[number])
    ? (params.color as string)
    : SCHOOL_COLORS[0];

  const existing = await db.school.findFirst({ where: { name } });
  if (existing) throw new ApiError(400, "A school with this name already exists.");

  // unique slug (+ suffix on collision)
  let slug = slugifySchool(name);
  if (await db.school.findUnique({ where: { slug } })) {
    slug = `${slug}-${shortCode(3).toLowerCase()}`;
  }

  const school = await db.school.create({
    data: {
      name,
      slug,
      motto,
      color,
      joinCode: shortCode(6),
      creatorId: user.id,
    },
  });
  await db.user.update({ where: { id: user.id }, data: { schoolId: school.id } });
  return school;
}

export async function joinSchool(
  user: { id: string; onboarded: boolean; schoolId: string | null },
  code: string
) {
  if (!user.onboarded) throw new ApiError(400, "Finish setting up your profile first.");
  if (user.schoolId) throw new ApiError(400, "Leave your current school first.");
  const school = await db.school.findUnique({ where: { joinCode: code.trim().toUpperCase() } });
  if (!school) throw new ApiError(404, "No school with that code — check with your teacher or friends.");
  await db.user.update({ where: { id: user.id }, data: { schoolId: school.id } });
  return school;
}

export async function leaveSchool(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.schoolId) throw new ApiError(400, "You're not in a school yet.");
  await db.user.update({ where: { id: userId }, data: { schoolId: null } });
}

// ── league table ─────────────────────────────────────────────

export type LeagueRow = {
  id: string;
  rank: number;
  name: string;
  motto: string | null;
  color: string;
  joinCode: string | null; // only for my school
  memberCount: number;
  totalPoints: number;
  crowns: number;
  topContributor: { displayName: string; avatar: string; points: number } | null;
  isMySchool: boolean;
  demoSquad: boolean;
};

export async function leagueTable(viewerId: string | null) {
  const schools = await db.school.findMany({
    include: {
      members: {
        where: { deletedAt: null },
        select: {
          id: true,
          displayName: true,
          avatar: true,
          seasonPoints: true,
          isBot: true,
        },
      },
    },
  });

  const championRows = await db.champion.findMany({
    select: { userId: true },
  });
  const crownsByUser = new Map<string, number>();
  for (const c of championRows) {
    crownsByUser.set(c.userId, (crownsByUser.get(c.userId) ?? 0) + 1);
  }

  const rows: Omit<LeagueRow, "rank">[] = schools.map((s) => {
    const totalPoints = s.members.reduce((sum, m) => sum + m.seasonPoints, 0);
    const crowns = s.members.reduce((sum, m) => sum + (crownsByUser.get(m.id) ?? 0), 0);
    const humans = s.members.filter((m) => !m.isBot);
    const top = [...humans, ...s.members]
      .filter((m) => m.seasonPoints > 0)
      .sort((a, b) => b.seasonPoints - a.seasonPoints)[0];
    return {
      id: s.id,
      name: s.name,
      motto: s.motto,
      color: s.color,
      joinCode: viewerId && s.members.some((m) => m.id === viewerId) ? s.joinCode : null,
      memberCount: s.members.length,
      totalPoints,
      crowns,
      topContributor: top
        ? { displayName: top.displayName, avatar: top.avatar, points: top.seasonPoints }
        : null,
      isMySchool: Boolean(viewerId && s.members.some((m) => m.id === viewerId)),
      demoSquad: s.members.length > 0 && s.members.every((m) => m.isBot),
    };
  });

  rows.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.crowns - a.crowns ||
      b.memberCount - a.memberCount ||
      a.name.localeCompare(b.name)
  );

  return rows.map((r, i) => ({ ...r, rank: i + 1 })) as LeagueRow[];
}

// ── school detail ────────────────────────────────────────────

export async function schoolDetail(schoolId: string, viewerId: string | null) {
  const school = await db.school.findUnique({
    where: { id: schoolId },
    include: {
      members: {
        where: { deletedAt: null },
        include: { grade: { select: { name: true } } },
      },
    },
  });
  if (!school) throw new ApiError(404, "School not found.");

  const championCount = await db.champion.count({
    where: { userId: { in: school.members.map((m) => m.id) } },
  });

  const members = school.members
    .map((m) => ({
      id: m.id,
      displayName: m.displayName,
      avatar: m.avatar,
      isBot: m.isBot,
      gradeName: m.grade?.name ?? null,
      level: m.isBot ? null : levelProgress(m.xp).level,
      rating: m.rating,
      seasonPoints: m.seasonPoints,
      titles: 0,
    }))
    .sort((a, b) => b.seasonPoints - a.seasonPoints || b.rating - a.rating);

  // crowns per member
  const championRows = await db.champion.findMany({
    where: { userId: { in: school.members.map((m) => m.id) } },
    select: { userId: true },
  });
  const crownsByUser = new Map<string, number>();
  for (const c of championRows)
    crownsByUser.set(c.userId, (crownsByUser.get(c.userId) ?? 0) + 1);
  for (const m of members) m.titles = crownsByUser.get(m.id) ?? 0;

  const memberIds = new Set(school.members.map((m) => m.id));
  const recentMatches = await db.matchRecord.findMany({
    where: { userId: { in: [...memberIds] }, opponent: { deletedAt: null } },
    include: {
      user: { select: { displayName: true, avatar: true, schoolId: true } },
      opponent: { select: { displayName: true, avatar: true, schoolId: true } },
      challenge: { include: { subject: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const feed = recentMatches
    .filter((m) => m.challenge)
    .slice(0, 12)
    .map((m) => ({
      id: m.id,
      subjectName: m.challenge!.subject.name,
      isLive: m.challenge!.isLive,
      result: m.result,
      score: m.score,
      opponentScore: m.opponentScore,
      player: { displayName: m.user.displayName, avatar: m.user.avatar, isMember: true },
      opponent: {
        displayName: m.opponent.displayName,
        avatar: m.opponent.avatar,
        isMember: memberIds.has(m.opponentId),
      },
      at: m.createdAt,
    }));

  const totalPoints = members.reduce((s, m) => s + m.seasonPoints, 0);
  const table = await leagueTable(viewerId);
  const rank = table.find((r) => r.id === school.id)?.rank ?? null;

  return {
    school: {
      id: school.id,
      name: school.name,
      motto: school.motto,
      color: school.color,
      joinCode:
        viewerId && memberIds.has(viewerId) ? school.joinCode : null,
      memberCount: members.length,
      totalPoints,
      crowns: championCount,
      rank,
      demoSquad: members.length > 0 && members.every((m) => m.isBot),
    },
    members,
    feed,
  };
}

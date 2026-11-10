import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { getUserFromRequest } from "@/lib/clash/server/auth";
import { ensureDuelServer } from "@/lib/clash/server/duel-server";

// Public education structure + announcements. Cached in-process for 60s.
let cache: { at: number; data: unknown } | null = null;

export async function GET(req: NextRequest) {
  try {
    ensureDuelServer();
    const user = await getUserFromRequest(req);
    if (cache && Date.now() - cache.at < 60_000) {
      return ok({ structure: cache.data, user: user ? { id: user.id, gradeId: user.gradeId } : null });
    }
    const [levels, grades, subjects, subjectGrades, topics, announcements] = await Promise.all([
      db.educationLevel.findMany({ orderBy: { order: "asc" } }),
      db.grade.findMany({ orderBy: { order: "asc" }, include: { level: true } }),
      db.subject.findMany({ orderBy: { order: "asc" } }),
      db.subjectGrade.findMany(),
      db.topic.findMany({ orderBy: [{ subjectId: "asc" }, { order: "asc" }] }),
      db.announcement.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

    const data = {
      levels,
      grades: grades.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        levelName: g.level.name,
        levelSlug: g.level.slug,
        hasContent: g.hasContent,
      })),
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        icon: s.icon,
        color: s.color,
        description: s.description,
      })),
      subjectGrades: subjectGrades.map((sg) => ({ subjectId: sg.subjectId, gradeId: sg.gradeId })),
      topics: topics.map((t) => ({
        id: t.id,
        subjectId: t.subjectId,
        name: t.name,
        description: t.description,
      })),
      announcements,
    };
    cache = { at: Date.now(), data };
    return ok({ structure: data, user: user ? { id: user.id, gradeId: user.gradeId } : null });
  } catch (e) {
    return fail(e);
  }
}

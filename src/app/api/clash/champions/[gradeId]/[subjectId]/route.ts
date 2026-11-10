import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { getUserFromRequest } from "@/lib/clash/server/auth";
import { levelProgress } from "@/lib/clash/game";

// Champion profile for a grade+subject category, with history & eligibility.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gradeId: string; subjectId: string }> }
) {
  try {
    const { gradeId, subjectId } = await params;
    const me = await getUserFromRequest(req);
    const [champion, grade, subject] = await Promise.all([
      db.champion.findUnique({
        where: { gradeId_subjectId: { gradeId, subjectId } },
        include: { user: { include: { grade: true } } },
      }),
      db.grade.findUnique({ where: { id: gradeId } }),
      db.subject.findUnique({ where: { id: subjectId } }),
    ]);
    if (!grade || !subject)
      return Response.json({ ok: false, error: "Category not found." }, { status: 404 });

    const history = await db.championshipHistory.findMany({
      where: { gradeId, subjectId },
      orderBy: { wonAt: "desc" },
      take: 10,
    });
    const formerIds = history.map((h) => h.formerChampionId).filter(Boolean) as string[];
    const newIds = history.map((h) => h.newChampionId);
    const users = await db.user.findMany({
      where: { id: { in: [...formerIds, ...newIds] } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const questionCount = await db.question.count({
      where: { gradeId, subjectId, status: "published" },
    });

    // Recent title defences (champion-type matches in this category)
    const defences = await db.challenge.findMany({
      where: {
        type: "champion",
        gradeId,
        subjectId,
        status: "completed",
      },
      include: { creator: true, opponent: true },
      orderBy: { completedAt: "desc" },
      take: 5,
    });

    const iAmEligible = me ? me.gradeId === gradeId && me.onboarded : false;
    const iAmChampion = me ? champion?.userId === me.id : false;

    return ok({
      champion: champion
        ? {
            user: {
              id: champion.user.id,
              displayName: champion.user.displayName,
              avatar: champion.user.avatar,
              isBot: champion.user.isBot,
              botSkill: champion.user.botSkill,
              xp: champion.user.xp,
              rating: champion.user.rating,
              level: champion.user.isBot ? null : levelProgress(champion.user.xp).level,
              streak: champion.user.isBot ? null : champion.user.streakCount,
            },
            wonAt: champion.wonAt,
            defences: champion.defences,
          }
        : null,
      grade: { id: grade.id, name: grade.name },
      subject: { id: subject.id, name: subject.name, color: subject.color, icon: subject.icon },
      questionCount,
      history: history.map((h) => ({
        id: h.id,
        note: h.note,
        wonAt: h.wonAt,
        former: h.formerChampionId ? userMap.get(h.formerChampionId)?.displayName ?? "—" : null,
        newChampion: userMap.get(h.newChampionId)?.displayName ?? "—",
      })),
      recentMatches: defences.map((d) => ({
        id: d.id,
        challenger: d.creator?.displayName ?? "—",
        championName: d.opponent?.displayName ?? "—",
        winnerId: d.winnerId,
        draw: d.draw,
        challengerWon: d.winnerId === d.creatorId,
        completedAt: d.completedAt,
      })),
      eligibility: {
        iAmEligible,
        iAmChampion,
        reason: !me
          ? "Sign in to challenge the champion."
          : me.gradeId !== gradeId
            ? `This title is for ${grade.name} students only.`
            : iAmChampion
              ? "You already hold this crown."
              : "You can challenge for this title!",
      },
    });
  } catch (e) {
    return fail(e);
  }
}

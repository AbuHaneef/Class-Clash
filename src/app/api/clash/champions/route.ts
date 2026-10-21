import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { expireStaleChallenges } from "@/lib/clash/server/challenge";

export async function GET(req: NextRequest) {
  try {
    await expireStaleChallenges();
    const champions = await db.champion.findMany({
      include: {
        user: { include: { grade: true } },
        subject: true,
        grade: true,
      },
      orderBy: { wonAt: "asc" },
    });
    return ok({
      champions: champions.map((ch) => ({
        gradeId: ch.gradeId,
        subjectId: ch.subjectId,
        gradeName: ch.grade.name,
        subject: {
          id: ch.subject.id,
          name: ch.subject.name,
          color: ch.subject.color,
          icon: ch.subject.icon,
        },
        champion: {
          id: ch.user.id,
          displayName: ch.user.displayName,
          avatar: ch.user.avatar,
          isBot: ch.user.isBot,
        },
        wonAt: ch.wonAt,
        defences: ch.defences,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

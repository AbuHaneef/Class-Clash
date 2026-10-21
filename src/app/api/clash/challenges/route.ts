import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { createChallenge, expireStaleChallenges } from "@/lib/clash/server/challenge";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await expireStaleChallenges();
    const challenges = await db.challenge.findMany({
      where: { OR: [{ creatorId: user.id }, { opponentId: user.id }] },
      include: {
        creator: { include: { grade: true } },
        opponent: { include: { grade: true } },
        subject: true,
        grade: true,
        results: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({
      challenges: challenges.map((c) => {
        const mine = c.creatorId === user.id;
        const other = mine ? c.opponent : c.creator;
        const myResult = c.results.find((r) => r.userId === user.id);
        const theirResult = c.results.find((r) => r.userId !== user.id);
        const openInvite = !c.opponentId;
        return {
          id: c.id,
          code: c.code,
          type: c.type,
          status: c.status,
          isLive: c.isLive,
          subject: { id: c.subject.id, name: c.subject.name, color: c.subject.color, icon: c.subject.icon },
          gradeName: c.grade.name,
          opponent: openInvite
            ? null
            : {
                id: other.id,
                displayName: other.displayName,
                avatar: other.avatar,
                isBot: other.isBot,
              },
          openInvite,
          iAmCreator: mine,
          expiresAt: c.expiresAt,
          createdAt: c.createdAt,
          draw: c.draw,
          winnerId: c.winnerId,
          iWon: c.winnerId === user.id,
          myScore: myResult?.score ?? null,
          theirScore: theirResult?.score ?? null,
          iPlayed: Boolean(myResult),
          theyPlayed: Boolean(theirResult),
        };
      }),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    rateLimit(`challenge-create:${user.id}`, 6, 60_000);
    const body = await readBody(req);
    const type = body.type === "champion" ? "champion" : "duel";
    const challenge = await createChallenge(user, {
      type,
      subjectId: String(body.subjectId ?? ""),
      opponentId: body.opponentId ? String(body.opponentId) : undefined,
    });
    return ok({
      challenge: {
        id: challenge.id,
        code: challenge.code,
        type: challenge.type,
        status: challenge.status,
      },
    });
  } catch (e) {
    return fail(e);
  }
}

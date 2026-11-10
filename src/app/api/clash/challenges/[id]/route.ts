import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, parseJson } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { expireStaleChallenges } from "@/lib/clash/server/challenge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    await expireStaleChallenges();
    const c = await db.challenge.findUnique({
      where: { id },
      include: {
        creator: { include: { grade: true } },
        opponent: { include: { grade: true } },
        subject: true,
        grade: true,
        results: { orderBy: { completedAt: "asc" } },
        creatorSession: true,
        opponentSession: true,
      },
    });
    if (!c || (c.creatorId !== user.id && c.opponentId !== user.id))
      return Response.json({ ok: false, error: "Challenge not found." }, { status: 404 });

    const questions = await db.question.findMany({
      where: { id: { in: parseJson<string[]>(c.questionIds, []) } },
      include: { options: true, topic: true },
    });
    const qOrder = parseJson<string[]>(c.questionIds, []);
    const qMap = new Map(questions.map((q) => [q.id, q]));

    const buildResult = (userId: string) => {
      const r = c.results.find((x) => x.userId === userId);
      if (!r) return null;
      const detail = parseJson<
        { questionId: string; chosen: number; correct: boolean }[]
      >(r.detail, []);
      const correctIdx = (qid: string) => {
        const q = qMap.get(qid);
        if (!q) return -1;
        const opts = [...q.options].sort((a, b) => a.order - b.order);
        return opts.findIndex((o) => o.isCorrect);
      };
      return {
        score: r.score,
        correctCount: r.correctCount,
        totalCount: r.totalCount,
        totalTimeMs: r.totalTimeMs,
        detail: qOrder.map((qid) => {
          const d = detail.find((x) => x.questionId === qid);
          return {
            questionId: qid,
            chosen: d?.chosen ?? -1,
            correct: d?.correct ?? false,
            correctIndex: correctIdx(qid),
            text: qMap.get(qid)?.text ?? "",
            imageUrl: qMap.get(qid)?.imageUrl ?? null,
          };
        }),
      };
    };

    return ok({
      challenge: {
        id: c.id,
        code: c.code,
        type: c.type,
        status: c.status,
        isLive: c.isLive,
        subject: { id: c.subject.id, name: c.subject.name, color: c.subject.color, icon: c.subject.icon },
        gradeName: c.grade.name,
        creator: {
          id: c.creator.id,
          displayName: c.creator.displayName,
          avatar: c.creator.avatar,
          isBot: c.creator.isBot,
        },
        opponent: c.opponent
          ? {
              id: c.opponent.id,
              displayName: c.opponent.displayName,
              avatar: c.opponent.avatar,
              isBot: c.opponent.isBot,
            }
          : null,
        openInvite: !c.opponentId,
        iAmCreator: c.creatorId === user.id,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
        winnerId: c.winnerId,
        draw: c.draw,
        mySessionId:
          c.creatorId === user.id ? c.creatorSession?.id ?? null : c.opponentSession?.id ?? null,
        theirSessionDone: Boolean(
          c.creatorId === user.id ? c.opponentSession : c.creatorSession
        ),
        creatorResult: buildResult(c.creatorId),
        opponentResult: c.opponentId ? buildResult(c.opponentId) : null,
        questionCount: qOrder.length,
      },
    });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, requireString, rateLimit } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";

// Tournament directory (foundation feature — labelled Beta in the UI).
export async function GET(req: NextRequest) {
  try {
    const tournaments = await db.tournament.findMany({
      include: {
        subject: true,
        grade: true,
        participants: { include: { user: true } },
        matches: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return ok({
      tournaments: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        status: t.status,
        subjectName: t.subject?.name ?? "All subjects",
        gradeName: t.grade?.name ?? "All classes",
        maxParticipants: t.maxParticipants,
        participantCount: t.participants.length,
        startsAt: t.startsAt,
        endsAt: t.endsAt,
        participants: t.participants.map((p) => ({
          id: p.user.id,
          displayName: p.user.displayName,
          avatar: p.user.avatar,
          seed: p.seed,
        })),
        roundCount: t.matches.length > 0 ? Math.max(...t.matches.map((m) => m.round)) : 0,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    // register for a tournament
    const user = await requireUser(req);
    rateLimit(`tournament:${user.id}`, 10, 60_000);
    const body = await readBody(req);
    const tournamentId = requireString(body, "tournamentId");
    const t = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: true },
    });
    if (!t) return Response.json({ ok: false, error: "Tournament not found." }, { status: 404 });
    if (t.status !== "registration")
      return Response.json({ ok: false, error: "Registration is closed." }, { status: 400 });
    if (t.gradeId && user.gradeId !== t.gradeId)
      return Response.json({ ok: false, error: "This tournament is for another class." }, { status: 400 });
    if (t.participants.length >= t.maxParticipants)
      return Response.json({ ok: false, error: "Tournament is full." }, { status: 400 });
    if (t.participants.some((p) => p.userId === user.id))
      return Response.json({ ok: false, error: "You're already registered." }, { status: 400 });

    await db.tournamentParticipant.create({
      data: { tournamentId, userId: user.id, seed: t.participants.length + 1 },
    });
    return ok({ registered: true });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody } from "@/lib/clash/server/api";
import { requireAdmin, audit } from "@/lib/clash/server/auth";

// ── Admin: tournament management (foundation: create → registration →
// start (auto-bracket) → admin-resolved matches). Labelled Beta in UI. ──
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await readBody(req);
    const action = String(body.action ?? "create");

    if (action === "create") {
      const name = String(body.name ?? "").trim();
      const description = String(body.description ?? "").trim();
      if (name.length < 3) return ok({ error: "Tournament name is too short." });
      const maxParticipants = Math.min(32, Math.max(4, Number(body.maxParticipants ?? 8)));
      const tournament = await db.tournament.create({
        data: {
          name,
          description,
          subjectId: body.subjectId ? String(body.subjectId) : null,
          gradeId: body.gradeId ? String(body.gradeId) : null,
          status: "registration",
          maxParticipants,
          startsAt: body.startsAt ? new Date(String(body.startsAt)) : null,
          endsAt: body.endsAt ? new Date(String(body.endsAt)) : null,
        },
      });
      await audit(admin.id, "tournament.create", "tournament", tournament.id, name);
      return ok({ tournamentId: tournament.id });
    }

    if (action === "start") {
      const id = String(body.tournamentId ?? "");
      const t = await db.tournament.findUnique({
        where: { id },
        include: { participants: true },
      });
      if (!t) return Response.json({ ok: false, error: "Tournament not found." }, { status: 404 });
      if (t.participants.length < 2) return ok({ error: "Need at least 2 participants." });
      // Generate single-elimination bracket (pad to power of two with byes)
      const n = t.participants.length;
      let size = 2;
      while (size < n) size *= 2;
      const players = [...t.participants].sort((a, b) => a.seed - b.seed);
      while (players.length < size) players.push(null as never);
      await db.tournamentMatch.deleteMany({ where: { tournamentId: id } });
      const round1: { tournamentId: string; round: number; slot: number; player1Id: string | null; player2Id: string | null }[] = [];
      for (let i = 0; i < size / 2; i++) {
        const p1 = players[i];
        const p2 = players[size - 1 - i];
        round1.push({
          tournamentId: id,
          round: 1,
          slot: i,
          player1Id: p1?.userId ?? null,
          player2Id: p2?.userId ?? null,
        });
      }
      await db.tournamentMatch.createMany({ data: round1 });
      // create empty slots for subsequent rounds
      let r = 2, s = size / 4;
      while (s >= 1) {
        const rows = Array.from({ length: s }, (_, i) => ({
          tournamentId: id, round: r, slot: i, player1Id: null, player2Id: null,
        }));
        await db.tournamentMatch.createMany({ data: rows });
        r++; s = Math.floor(s / 2);
      }
      await db.tournament.update({ where: { id }, data: { status: "active" } });
      await audit(admin.id, "tournament.start", "tournament", id, `${n} players`);
      return ok({ started: true });
    }

    if (action === "resolve") {
      const matchId = String(body.matchId ?? "");
      const winnerId = String(body.winnerId ?? "");
      const match = await db.tournamentMatch.findUnique({ where: { id: matchId } });
      if (!match) return Response.json({ ok: false, error: "Match not found." }, { status: 404 });
      if (match.winnerId) return ok({ error: "Match already resolved." });
      if (![match.player1Id, match.player2Id].includes(winnerId))
        return ok({ error: "Winner must be one of the match players." });
      await db.tournamentMatch.update({
        where: { id: matchId },
        data: { winnerId, status: "completed" },
      });
      // advance winner to next round
      const next = await db.tournamentMatch.findFirst({
        where: { tournamentId: match.tournamentId, round: match.round + 1 },
        orderBy: { slot: "asc" },
      });
      if (next) {
        const slotInNext = Math.floor(match.slot / 2);
        const target = await db.tournamentMatch.findFirst({
          where: { tournamentId: match.tournamentId, round: match.round + 1, slot: slotInNext },
        });
        if (target) {
          const isEven = match.slot % 2 === 0;
          await db.tournamentMatch.update({
            where: { id: target.id },
            data: isEven ? { player1Id: winnerId } : { player2Id: winnerId },
          });
          void next;
        }
      }
      // if final match completed → tournament done
      const finalRound = await db.tournamentMatch.findFirst({
        where: { tournamentId: match.tournamentId },
        orderBy: { round: "desc" },
      });
      if (finalRound && finalRound.round === match.round && match.round > 1) {
        const roundMatches = await db.tournamentMatch.findMany({
          where: { tournamentId: match.tournamentId, round: match.round },
        });
        if (roundMatches.every((m) => m.status === "completed")) {
          await db.tournament.update({
            where: { id: match.tournamentId },
            data: { status: "completed", endsAt: new Date() },
          });
        }
      }
      await audit(admin.id, "tournament.resolve", "tournament", match.tournamentId, matchId);
      return ok({ resolved: true });
    }

    return ok({ error: "Unknown action." });
  } catch (e) {
    return fail(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const tournaments = await db.tournament.findMany({
      include: {
        subject: true,
        grade: true,
        participants: { include: { user: true } },
        matches: { orderBy: [{ round: "asc" }, { slot: "asc" }] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const users = await db.user.findMany({
      where: { isBot: false, deletedAt: null },
      select: { id: true, displayName: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return ok({
      tournaments: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        status: t.status,
        subjectName: t.subject?.name ?? "All subjects",
        gradeName: t.grade?.name ?? "All classes",
        maxParticipants: t.maxParticipants,
        participants: t.participants.map((p) => ({
          userId: p.userId,
          displayName: userMap.get(p.userId)?.displayName ?? "Unknown",
          seed: p.seed,
        })),
        matches: t.matches.map((m) => ({
          id: m.id,
          round: m.round,
          slot: m.slot,
          player1: m.player1Id ? userMap.get(m.player1Id)?.displayName ?? "?" : "—",
          player2: m.player2Id ? userMap.get(m.player2Id)?.displayName ?? "?" : "—",
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          winnerId: m.winnerId,
          status: m.status,
        })),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

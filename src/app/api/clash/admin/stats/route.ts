import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, rateLimit, readBody, requireString } from "@/lib/clash/server/api";
import { requireAdmin, audit } from "@/lib/clash/server/auth";

// ── Admin: platform statistics ──
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const [users, students, questions, published, pendingReview, sessions, challenges,
      champions, bots, reports, flagged] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "student", isBot: false, deletedAt: null } }),
      db.question.count(),
      db.question.count({ where: { status: "published" } }),
      db.question.count({ where: { status: "pending" } }),
      db.quizSession.count(),
      db.challenge.count(),
      db.champion.count(),
      db.user.count({ where: { isBot: true } }),
      db.report.count({ where: { status: "open" } }),
      db.quizSession.count({ where: { suspicionScore: { gte: 3 } } }),
    ]);

    const recentSignups = await db.user.findMany({
      where: { isBot: false, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { grade: true },
    });

    return ok({
      stats: {
        users, students, questions, published, pendingReview, sessions,
        challenges, champions, bots, reports, flagged,
      },
      recentSignups: recentSignups.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        gradeName: u.grade?.name ?? "—",
        createdAt: u.createdAt,
        role: u.role,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

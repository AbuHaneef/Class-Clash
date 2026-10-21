import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { expireStaleChallenges } from "@/lib/clash/server/challenge";

// Public invite preview — safe fields only, no auth required.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    await expireStaleChallenges();
    const c = await db.challenge.findUnique({
      where: { code: code.toUpperCase() },
      include: { creator: true, subject: true, grade: true },
    });
    if (!c)
      return Response.json({ ok: false, error: "This invite link is invalid." }, { status: 404 });
    const active = ["pending", "accepted", "in_progress"].includes(c.status);
    return ok({
      invite: {
        code: c.code,
        type: c.type,
        active,
        status: c.status,
        challengerName: c.creator.displayName,
        challengerAvatar: c.creator.avatar,
        subjectName: c.subject.name,
        subjectColor: c.subject.color,
        subjectIcon: c.subject.icon,
        gradeName: c.grade.name,
        questionCount: JSON.parse(c.questionIds).length,
        expiresAt: c.expiresAt,
        challengeId: c.id,
      },
    });
  } catch (e) {
    return fail(e);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireRole, audit } from "@/lib/clash/server/auth";

// ── Admin/Reviewer: moderation reports ──
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, "admin", "reviewer");
    const reports = await db.report.findMany({
      include: { reporter: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    });
    // Attach target summaries
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let target: string;
        if (r.targetType === "user") {
          const u = await db.user.findUnique({ where: { id: r.targetId } });
          target = u ? `${u.displayName} (${u.email})` : "deleted user";
        } else {
          const q = await db.question.findUnique({ where: { id: r.targetId } });
          target = q ? q.text.slice(0, 120) : "deleted question";
        }
        return {
          id: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
          target,
          reason: r.reason,
          details: r.details,
          status: r.status,
          reporter: r.reporter.displayName,
          createdAt: r.createdAt,
        };
      })
    );
    return ok({ reports: enriched });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireRole(req, "admin", "reviewer");
    rateLimit(`r-edit:${admin.id}`, 30, 60_000);
    const body = await readBody(req);
    const id = String(body.reportId ?? "");
    const status = ["open", "resolved", "dismissed"].includes(String(body.status))
      ? String(body.status)
      : null;
    if (!status) return ok({ error: "Invalid status." });
    await db.report.update({ where: { id }, data: { status } });
    await audit(admin.id, `report.${status}`, "report", id, String(body.note ?? ""));
    return ok({ done: true });
  } catch (e) {
    return fail(e);
  }
}

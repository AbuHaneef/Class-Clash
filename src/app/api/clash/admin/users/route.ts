import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireAdmin, audit } from "@/lib/clash/server/auth";

// ── Admin: user & role management ──
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const users = await db.user.findMany({
      where: q
        ? {
            OR: [
              { displayName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {},
      include: { grade: true, champions: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        avatar: u.avatar,
        role: u.role,
        gradeName: u.grade?.name ?? null,
        xp: u.xp,
        rating: u.rating,
        titles: u.champions.length,
        isBot: u.isBot,
        suspendedUntil: u.suspendedUntil,
        deletedAt: u.deletedAt,
        createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    rateLimit(`u-edit:${admin.id}`, 40, 60_000);
    const body = await readBody(req);
    const userId = String(body.userId ?? "");
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return Response.json({ ok: false, error: "User not found." }, { status: 404 });
    if (user.id === admin.id && (body.role || body.suspend))
      return ok({ error: "You can't change your own role or suspend yourself." });

    const data: Record<string, unknown> = {};
    let action = "";
    if (typeof body.role === "string" && ["student", "teacher", "school_admin", "reviewer", "admin"].includes(body.role)) {
      data.role = body.role;
      action = `role → ${body.role}`;
    }
    if (body.suspend === true) {
      data.suspendedUntil = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      action = "suspend 7d";
    }
    if (body.suspend === false) {
      data.suspendedUntil = null;
      action = "unsuspend";
    }
    if (body.delete === true) {
      data.deletedAt = new Date();
      action = "soft-delete";
    }
    if (body.restore === true) {
      data.deletedAt = null;
      action = "restore";
    }
    await db.user.update({ where: { id: userId }, data });
    await audit(admin.id, `user.${action}`, "user", userId, String(body.reason ?? ""));
    return ok({ done: true });
  } catch (e) {
    return fail(e);
  }
}

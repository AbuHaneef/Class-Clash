import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/clash/server/api";
import { requireAdmin } from "@/lib/clash/server/auth";
import { getAllConfig, setConfig } from "@/lib/clash/server/config";
import { audit } from "@/lib/clash/server/auth";

// ── Admin: audit log + platform config + announcements ──
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const what = url.searchParams.get("what") ?? "audit";
    if (what === "config") {
      return ok({ config: await getAllConfig() });
    }
    if (what === "announcements") {
      const announcements = await db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
      return ok({ announcements });
    }
    const logs = await db.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        details: l.details,
        actor: l.actor?.displayName ?? "system",
        createdAt: l.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await readBody2(req);
    if (body.announcement) {
      const a = body.announcement as { title?: string; body?: string; active?: boolean };
      if (!a.title?.trim() || !a.body?.trim()) return ok({ error: "Title and body required." });
      await db.announcement.create({
        data: { title: a.title.trim(), body: a.body.trim(), active: a.active ?? true },
      });
      await audit(admin.id, "announcement.create", "announcement", undefined, a.title);
      return ok({ done: true });
    }
    if (body.config && typeof body.config === "object") {
      for (const [key, value] of Object.entries(body.config as Record<string, string>)) {
        if (/^[a-zA-Z]+$/.test(key)) await setConfig(key, String(value));
      }
      await audit(admin.id, "config.update", "config", undefined, JSON.stringify(body.config));
      return ok({ done: true });
    }
    return ok({ error: "Nothing to update." });
  } catch (e) {
    return fail(e);
  }
}

async function readBody2(req: NextRequest) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({
      notifications,
      unread: notifications.filter((n) => !n.read).length,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await readBody(req);
    if (body.all) {
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    } else if (Array.isArray(body.ids)) {
      const ids = (body.ids as unknown[]).filter((x) => typeof x === "string");
      await db.notification.updateMany({
        where: { userId: user.id, id: { in: ids } },
        data: { read: true },
      });
    }
    return ok({ done: true });
  } catch (e) {
    return fail(e);
  }
}

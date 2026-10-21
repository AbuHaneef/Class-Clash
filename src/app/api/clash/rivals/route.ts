import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";

// Rivalry management: track rivals, request rematches (no open messaging).
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await readBody(req);
    const rivalId = String(body.rivalId ?? "");
    const action = String(body.action ?? "add");

    if (action === "add") {
      const target = await db.user.findUnique({ where: { id: rivalId } });
      if (!target || target.deletedAt || target.id === user.id)
        return ok({ error: "Rival not found." });
      if (target.isBot) return ok({ error: "Bots can't be rivals — challenge them instead!" });
      await db.rivalry.upsert({
        where: { userId_rivalId: { userId: user.id, rivalId } },
        create: { userId: user.id, rivalId },
        update: {},
      });
      return ok({ added: true });
    }
    if (action === "remove") {
      await db.rivalry.deleteMany({ where: { userId: user.id, rivalId } });
      return ok({ removed: true });
    }
    return ok({ error: "Unknown action." });
  } catch (e) {
    return fail(e);
  }
}

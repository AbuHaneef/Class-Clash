import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { validateDisplayName } from "@/lib/clash/game";
import { meUser } from "@/lib/clash/server/sanitize";

const AVATAR_KEYS = ["fox", "owl", "panda", "lion", "shark", "cat", "turtle", "penguin", "bee", "dragon", "robot", "alien"];

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    rateLimit(`settings:${user.id}`, 20, 60_000);
    const body = await readBody(req);

    const data: Record<string, unknown> = {};
    if (typeof body.displayName === "string" && body.displayName !== user.displayName) {
      const check = validateDisplayName(body.displayName);
      if (!check.ok) return ok({ error: check.error });
      const taken = await db.user.findUnique({ where: { displayName: body.displayName } });
      if (taken) return ok({ error: "That display name is taken." });
      data.displayName = body.displayName.trim();
    }
    if (typeof body.avatar === "string" && AVATAR_KEYS.includes(body.avatar))
      data.avatar = body.avatar;
    if (typeof body.soundEnabled === "boolean") data.soundEnabled = body.soundEnabled;
    if (typeof body.gradeId === "string" && body.gradeId !== user.gradeId) {
      const grade = await db.grade.findUnique({ where: { id: body.gradeId } });
      if (!grade) return ok({ error: "Class not found." });
      data.gradeId = grade.id;
    }
    if (typeof body.requestDeletion === "boolean" && body.requestDeletion) {
      // soft-delete: removes public presence; data purged by admin policy
      data.deletedAt = new Date();
      await db.notification.create({
        data: {
          userId: user.id,
          type: "system",
          title: "Account deletion scheduled",
          body: "Your account will be removed. Sorry to see you go!",
          link: null,
        },
      });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
      include: { grade: true },
    });
    return ok({ user: meUser(updated) });
  } catch (e) {
    return fail(e);
  }
}

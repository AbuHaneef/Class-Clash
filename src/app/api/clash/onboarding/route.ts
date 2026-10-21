import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, readBody, requireString } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { validateDisplayName } from "@/lib/clash/game";

const AVATAR_KEYS = ["fox", "owl", "panda", "lion", "shark", "cat", "turtle", "penguin", "bee", "dragon", "robot", "alien"];

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (user.onboarded) return ok({ done: true });
    const body = await readBody(req);

    const displayName = requireString(body, "displayName", { min: 3, max: 16 });
    const check = validateDisplayName(displayName);
    if (!check.ok) return ok({ error: check.error });
    const taken = await db.user.findFirst({
      where: { displayName, NOT: { id: user.id } },
    });
    if (taken) return ok({ error: "That display name is taken. Try another!" });

    const avatar =
      typeof body.avatar === "string" && AVATAR_KEYS.includes(body.avatar) ? body.avatar : "fox";
    const gradeId = requireString(body, "gradeId");
    const grade = await db.grade.findUnique({ where: { id: gradeId } });
    if (!grade) return ok({ error: "Pick your class to continue." });

    await db.user.update({
      where: { id: user.id },
      data: { displayName, avatar, gradeId, onboarded: true },
    });

    await db.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Welcome to ClassClash, " + displayName + "! 🎉",
        body: "Practise a subject, then challenge a Demo Guardian to win your first championship crown!",
        link: "/#/subjects",
      },
    });

    return ok({ done: true });
  } catch (e) {
    return fail(e);
  }
}

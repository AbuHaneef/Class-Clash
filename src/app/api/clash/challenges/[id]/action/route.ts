import { NextRequest } from "next/server";
import { ok, fail, readBody, rateLimit } from "@/lib/clash/server/api";
import { requireUser } from "@/lib/clash/server/auth";
import { acceptChallenge, declineChallenge, cancelChallenge } from "@/lib/clash/server/challenge";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser(req);
    rateLimit(`challenge-action:${user.id}`, 15, 60_000);
    const body = await readBody(req);
    const action = String(body.action ?? "");
    if (action === "accept") await acceptChallenge(user.id, id);
    else if (action === "decline") await declineChallenge(user.id, id);
    else if (action === "cancel") await cancelChallenge(user.id, id);
    else return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
    return ok({ done: true });
  } catch (e) {
    return fail(e);
  }
}

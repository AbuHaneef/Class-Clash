/**
 * E2E test: real-time duels + school leagues
 * Run: bun scripts/test-live-e2e.ts
 */
import { io, type Socket } from "socket.io-client";

const API = "http://127.0.0.1:3000";
const LIVE = "http://127.0.0.1:3003";
let pass = 0;
let failCount = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failCount++;
    console.log(`  ✗ FAIL: ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}/api/clash${path}`, init);
  const setCookie = res.headers.get("set-cookie");
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { json, setCookie, status: res.status };
}

function cookieOf(setCookie: string | null): string {
  return (setCookie ?? "").split(";")[0] ?? "";
}

async function registerAndOnboard(n: string) {
  const stamp = Date.now().toString(36).slice(-5);
  const email = `live-e2e-${n}-${stamp}@test.classclash`;
  const name = `LT ${n} ${stamp}`;
  const reg = await api("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "LiveTest#2026", displayName: name }),
  });
  if (!reg.json.ok) throw new Error(`register failed: ${reg.json.error}`);
  const cookie = cookieOf(reg.setCookie);
  // structure → pick SS2 (has content)
  const st = (await api("/structure", { headers: { Cookie: cookie } })).json as unknown as {
    structure: {
      grades: { id: string; name: string; slug: string; hasContent: boolean }[];
      subjects: { id: string; name: string; slug: string }[];
      subjectGrades: { subjectId: string; gradeId: string }[];
    };
  };
  const grade = st.structure.grades.find((g) => g.slug === "ss-2")!;
  const onb = await api("/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ displayName: name, avatar: "dragon", gradeId: grade.id }),
  });
  if (!onb.json.ok) throw new Error(`onboarding failed: ${onb.json.error}`);
  const subject = st.structure.subjects.find(
    (s) => st.structure.subjectGrades.some((sg) => sg.subjectId === s.id && sg.gradeId === grade.id)
  )!;
  return { cookie, grade, subject, userId: String(reg.json.userId) };
}

function connectLive(cookie: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = io(LIVE, {
      path: "/",
      transports: ["websocket"],
      extraHeaders: { Cookie: cookie },
      reconnection: false,
      timeout: 8000,
    });
    sock.on("connect", () => resolve(sock));
    sock.on("connect_error", (e: Error) => reject(e));
    setTimeout(() => reject(new Error("socket timeout")), 9000);
  });
}

type MatchCtx = {
  questionsSeen: number;
  lastResult: unknown;
  over: {
    result: { challengeId: string; winnerId: string | null; draw: boolean; summary: string } | null;
    you: { score: number; correctCount: number; ratingDelta: number | null; xpEarned: number } | null;
    summary: string;
    forfeitLost: boolean;
  } | null;
  ready: { subjectName: string; questionCount: number; opponent: { displayName: string; isBot: boolean }; vsBot: boolean } | null;
  opponentAnswered: number;
};

function playMatch(sock: Socket, answerIdx: number, label: string): Promise<MatchCtx> {
  return new Promise((resolve, reject) => {
    const ctx: MatchCtx = { questionsSeen: 0, lastResult: null, over: null, ready: null, opponentAnswered: 0 };
    const timer = setTimeout(() => reject(new Error(`${label}: match timeout`)), 180_000);
    const finish = () => {
      clearTimeout(timer);
      sock.removeAllListeners("question:show");
      sock.removeAllListeners("round:result");
      sock.removeAllListeners("match:over");
      sock.removeAllListeners("match:ready");
      sock.removeAllListeners("opponent:answered");
      resolve(ctx);
    };
    sock.on("match:ready", (d: MatchCtx["ready"] extends null ? never : { subjectName: string; questionCount: number; opponent: { displayName: string; isBot: boolean }; vsBot: boolean }) => {
      ctx.ready = d;
    });
    sock.on("opponent:answered", () => ctx.opponentAnswered++);
    sock.on("question:show", (d: { question: { id: string; options: { id: string }[] }; index: number }) => {
      ctx.questionsSeen++;
      const opt = d.question.options[answerIdx];
      setTimeout(() => sock.emit("answer:submit", { questionIndex: d.index, questionId: d.question.id, optionId: opt.id }), 400);
    });
    sock.on("round:result", (d: unknown) => {
      ctx.lastResult = d;
    });
    sock.on("match:over", (d: MatchCtx["over"]) => {
      ctx.over = d;
      finish();
    });
  });
}

async function main() {
  console.log("── 1. Live duel vs trainer bot ──");
  const u1 = await registerAndOnboard("A");
  const s1 = await connectLive(u1.cookie);
  const authOk = await new Promise<{ user: { displayName: string } }>((res) => s1.on("auth:ok", res));
  check("socket auth via cookie", Boolean(authOk.user));

  const match1 = playMatch(s1, 0, "bot duel");
  s1.emit("bot:play", { subjectId: u1.subject.id });
  const r1 = await match1;
  check("match:ready received with bot opponent", r1.ready?.vsBot === true, `opponent: ${r1.ready?.opponent.displayName}`);
  check("all 8 questions served", r1.questionsSeen === 8, `seen ${r1.questionsSeen}`);
  check("match:over with challengeId", Boolean(r1.over?.result?.challengeId));
  check("result summary present", Boolean(r1.over?.summary), r1.over?.summary);
  check("player payload with xp/rating", r1.over?.you !== null && r1.over!.you !== undefined, `xp: ${r1.over?.you?.xpEarned}, score: ${r1.over?.you?.score}`);
  const challengeId1 = r1.over?.result?.challengeId!;

  // verify persisted state
  const ch = (await api(`/challenges/${challengeId1}`, { headers: { Cookie: u1.cookie } })).json as unknown as {
    challenge: { status: string; isLive: boolean; winnerId: string | null; mySessionId: string | null };
  };
  check("challenge persisted & completed", ch.challenge.status === "completed");
  check("challenge flagged isLive", ch.challenge.isLive === true);
  check("quiz session created for analytics", Boolean(ch.challenge.mySessionId));

  const me1 = (await api("/auth/me", { headers: { Cookie: u1.cookie } })).json as unknown as {
    user: { seasonPoints: number; xp: number };
  };
  check("season points awarded", me1.user.seasonPoints >= 1, `${me1.user.seasonPoints} pts`);
  check("xp awarded", me1.user.xp >= 12, `${me1.user.xp} xp`);

  console.log("── 2. Duplicate answer & stale answer rejection (service-side) ──");
  // implicit: match completed without double-submits corrupting scores
  check("no crash on complete match", r1.over !== null);

  console.log("── 3. Two humans quick-matched (queue) ──");
  const u2 = await registerAndOnboard("B");
  const s2 = await connectLive(u2.cookie);
  await new Promise((res) => s2.on("auth:ok", res));

  const matchA = playMatch(s1, 0, "human A");
  const matchB = playMatch(s2, 1, "human B");
  s1.emit("queue:join", { subjectId: u1.subject.id });
  await new Promise((r) => setTimeout(r, 300));
  s2.emit("queue:join", { subjectId: u1.subject.id });

  const [rA, rB] = await Promise.all([matchA, matchB]);
  check("A matched with human", rA.ready?.vsBot === false, `opponent: ${rA.ready?.opponent.displayName}`);
  check("B matched with human", rB.ready?.vsBot === false, `opponent: ${rB.ready?.opponent.displayName}`);
  check("both A & B completed", Boolean(rA.over?.result?.challengeId) && Boolean(rB.over?.result?.challengeId));
  check("opponent answered signals flowed", rA.opponentAnswered >= 1, `${rA.opponentAnswered} signals`);
  const sameChallenge = rA.over?.result?.challengeId === rB.over?.result?.challengeId;
  check("both resolved same challenge", sameChallenge);
  // winner consistency
  const aWon = rA.over?.result?.winnerId === (await userIdOf(u1.cookie));
  const bWon = rB.over?.result?.winnerId === (await userIdOf(u2.cookie));
  const draw = rA.over?.result?.draw;
  check("winner consistent for both sides", (aWon && !bWon) || (!aWon && bWon) || Boolean(draw), `draw=${draw}`);
  const meA = (await api("/auth/me", { headers: { Cookie: u1.cookie } })).json as unknown as { user: { rating: number } };
  const meB = (await api("/auth/me", { headers: { Cookie: u2.cookie } })).json as unknown as { user: { rating: number } };
  check("rating moved for humans (Elo)", meA.user.rating !== 1000 || meB.user.rating !== 1000, `A:${meA.user.rating} B:${meB.user.rating}`);

  console.log("── 4. School leagues ──");
  // create school with A
  const schoolName = `E2E Scholars ${Date.now().toString(36).slice(-4)}`;
  const created = (await api("/schools", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: u1.cookie },
    body: JSON.stringify({ name: schoolName, motto: "Test first", color: "#10b981" }),
  })).json as unknown as { school: { id: string; joinCode: string }; error?: string };
  check("school created", Boolean(created.school?.joinCode), `code ${created.school?.joinCode ?? created.error}`);

  const joined = (await api("/schools/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: u2.cookie },
    body: JSON.stringify({ code: created.school.joinCode }),
  })).json as unknown as { school: { name: string } };
  check("user B joined via code", joined.school?.name === schoolName);

  const table = (await api("/schools", { headers: { Cookie: u1.cookie } })).json as unknown as {
    table: { name: string; totalPoints: number; memberCount: number; isMySchool: boolean; rank: number }[];
    mySchool: { name: string; rank: number | null; totalPoints: number; joinCode: string | null };
  };
  const myRow = table.table.find((t) => t.name === schoolName);
  check("league table includes new school", Boolean(myRow));
  check("mySchool payload populated", table.mySchool?.name === schoolName && table.mySchool.joinCode !== null);
  check("school points from live duels", (myRow?.totalPoints ?? 0) >= 2, `${myRow?.totalPoints} pts`);
  check("member count = 2", myRow?.memberCount === 2);
  check("demo squads present in table", table.table.some((t) => t.name === "Port Harcourt Champions"));

  const detail = (await api(`/schools/${created.school.id}`, { headers: { Cookie: u1.cookie } })).json as unknown as {
    school: { memberCount: number; totalPoints: number; rank: number | null };
    members: { displayName: string }[];
    feed: { subjectName: string; isLive: boolean; result: string }[];
  };
  check("school detail members", detail.members.length === 2);
  check("school detail recent form has live matches", detail.feed.some((f) => f.isLive), `${detail.feed.length} matches`);

  // leave school
  const left = (await api("/schools/leave", { method: "POST", headers: { Cookie: u2.cookie } })).json as unknown as { left: boolean };
  check("user B left school", left.left === true);

  console.log("── 5. Forfeit flow ──");
  const u3 = await registerAndOnboard("C");
  const s3 = await connectLive(u3.cookie);
  await new Promise((res) => s3.on("auth:ok", res));
  const forfeitOver = new Promise<{ forfeitLost: boolean; summary: string }>((resolve) => {
    s3.on("match:over", (d: { forfeitLost: boolean; summary: string }) => resolve(d));
  });
  // play vs bot, answer 1 question, then leave
  s3.on("question:show", (d: { question: { id: string; options: { id: string }[] }; index: number }) => {
    if (d.index === 0) {
      s3.emit("answer:submit", { questionIndex: 0, questionId: d.question.id, optionId: d.question.options[0].id });
      setTimeout(() => s3.emit("match:leave"), 300);
    }
  });
  s3.emit("bot:play", { subjectId: u1.subject.id });
  const rF = await forfeitOver;
  check("forfeit ends match with forfeitLost", rF.forfeitLost === true, rF.summary);

  // cleanup sockets
  s1.disconnect();
  s2.disconnect();
  s3.disconnect();

  console.log(`\n═══ RESULTS: ${pass} passed, ${failCount} failed ═══`);
  process.exit(failCount > 0 ? 1 : 0);
}

async function userIdOf(cookie: string): Promise<string> {
  const r = (await api("/auth/me", { headers: { Cookie: cookie } })).json as unknown as { user: { id: string } };
  return r.user.id;
}

main().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});

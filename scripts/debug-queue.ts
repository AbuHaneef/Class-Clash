/** Debug: two humans quick match — print all events */
import { io, type Socket } from "socket.io-client";

const API = "http://127.0.0.1:3000";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}/api/clash${path}`, init);
  const setCookie = res.headers.get("set-cookie");
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { json, setCookie };
}

async function setup(n: string) {
  const stamp = Date.now().toString(36).slice(-5);
  const email = `qdbg-${n}-${stamp}@test.classclash`;
  const reg = await api("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "LiveTest#2026", displayName: `QD ${n} ${stamp}` }),
  });
  const cookie = (reg.setCookie ?? "").split(";")[0];
  const st = (await api("/structure", { headers: { Cookie: cookie } })).json as unknown as {
    structure: { grades: { id: string; slug: string }[]; subjects: { id: string; name: string }[]; subjectGrades: { subjectId: string; gradeId: string }[] };
  };
  const grade = st.structure.grades.find((g) => g.slug === "ss-2")!;
  await api("/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ displayName: `QD ${n} ${stamp}`, avatar: "fox", gradeId: grade.id }),
  });
  const subject = st.structure.subjects.find((s) => st.structure.subjectGrades.some((sg) => sg.subjectId === s.id && sg.gradeId === grade.id))!;
  return { cookie, subject, name: `QD ${n} ${stamp}` };
}

function wire(sock: Socket, label: string) {
  for (const ev of ["auth:ok", "auth:failed", "queue:status", "match:ready", "match:countdown", "question:show", "opponent:answered", "round:result", "match:over", "match:error", "live:error", "match:cancelled", "match:rejoin", "match:opponent_left", "rematch:wait", "room:created", "room:joined"]) {
    sock.on(ev, (d: unknown) => console.log(`[${label}] ${ev}:`, JSON.stringify(d)?.slice(0, 220)));
  }
}

async function main() {
  const a = await setup("A");
  const b = await setup("B");
  const sa = io("http://127.0.0.1:3003", { path: "/", transports: ["websocket"], extraHeaders: { Cookie: a.cookie }, reconnection: false });
  const sb = io("http://127.0.0.1:3003", { path: "/", transports: ["websocket"], extraHeaders: { Cookie: b.cookie }, reconnection: false });
  wire(sa, "A");
  wire(sb, "B");
  await new Promise<void>((r) => sa.on("connect", () => r()));
  await new Promise<void>((r) => sb.on("connect", () => r()));
  console.log("--- both connected; joining queue ---");
  sa.emit("queue:join", { subjectId: a.subject.id });
  setTimeout(() => sb.emit("queue:join", { subjectId: a.subject.id }), 400);
  // answer questions automatically
  const answer = (sock: Socket) => {
    sock.on("question:show", (d: { question: { id: string; options: { id: string }[] }; index: number }) => {
      setTimeout(() => sock.emit("answer:submit", { questionIndex: d.index, questionId: d.question.id, optionId: d.question.options[1].id }), 300);
    });
  };
  answer(sa);
  answer(sb);
  setTimeout(() => {
    console.log("--- done (25s elapsed) ---");
    sa.disconnect();
    sb.disconnect();
    process.exit(0);
  }, 25000);
}

main().catch((e) => {
  console.error("crash:", e);
  process.exit(1);
});

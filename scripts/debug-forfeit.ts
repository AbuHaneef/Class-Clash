/** Debug: forfeit flow vs bot — print all events */
import { io } from "socket.io-client";

const API = "http://127.0.0.1:3000";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}/api/clash${path}`, init);
  const setCookie = res.headers.get("set-cookie");
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { json, setCookie };
}

async function main() {
  const stamp = Date.now().toString(36).slice(-5);
  const reg = await api("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `fdbg-${stamp}@test.classclash`, password: "LiveTest#2026", displayName: `FD ${stamp}` }),
  });
  const cookie = (reg.setCookie ?? "").split(";")[0];
  const st = (await api("/structure", { headers: { Cookie: cookie } })).json as unknown as {
    structure: { grades: { id: string; slug: string }[]; subjects: { id: string }[]; subjectGrades: { subjectId: string; gradeId: string }[] };
  };
  const grade = st.structure.grades.find((g) => g.slug === "ss-2")!;
  await api("/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ displayName: `FD ${stamp}`, avatar: "fox", gradeId: grade.id }),
  });
  const subject = st.structure.subjects.find((s) => st.structure.subjectGrades.some((sg) => sg.subjectId === s.id && sg.gradeId === grade.id))!;

  const sock = io("http://127.0.0.1:3003", { path: "/", transports: ["websocket"], extraHeaders: { Cookie: cookie }, reconnection: false });
  for (const ev of ["auth:ok", "auth:failed", "match:ready", "match:countdown", "question:show", "round:result", "match:over", "match:error", "live:error", "match:rejoin", "opponent:answered", "match:opponent_left"]) {
    sock.on(ev, (d: unknown) => console.log(`${ev}:`, JSON.stringify(d)?.slice(0, 300)));
  }
  await new Promise<void>((r) => sock.on("connect", () => r()));
  console.log("--- connected, starting bot:play ---");
  sock.emit("bot:play", { subjectId: subject.id });
  sock.on("question:show", (d: { question: { id: string; options: { id: string }[] }; index: number }) => {
    if (d.index === 0) {
      sock.emit("answer:submit", { questionIndex: 0, questionId: d.question.id, optionId: d.question.options[0].id });
      setTimeout(() => {
        console.log("--- emitting match:leave ---");
        sock.emit("match:leave");
      }, 400);
    }
  });
  setTimeout(() => {
    console.log("--- done (45s) ---");
    sock.disconnect();
    process.exit(0);
  }, 45000);
}

main().catch((e) => {
  console.error("crash:", e);
  process.exit(1);
});

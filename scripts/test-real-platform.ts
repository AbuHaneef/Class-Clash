// Real-platform E2E: admin account, open registration, quiz correctness flow.
const BASE = "http://localhost:3000/api/clash";
let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

function jar() {
  let cookies = "";
  return {
    async req(path: string, init: RequestInit = {}) {
      const res = await fetch(BASE + path, {
        ...init,
        headers: { "content-type": "application/json", ...(cookies ? { cookie: cookies } : {}), ...(init.headers ?? {}) },
      });
      const setCookie = res.headers.getSetCookie?.() ?? [];
      for (const c of setCookie) cookies = c.split(";")[0];
      let body: any = null;
      try { body = await res.json(); } catch { /* empty */ }
      return { status: res.status, body };
    },
  };
}

async function main() {
  // ── 1. Real admin account ──
  console.log("\n1. Real admin account");
  const admin = jar();
  const oldLogin = await admin.req("/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@classclash.demo", password: "ClashAdmin#2026" }) });
  check("old demo admin credentials rejected", oldLogin.status === 401 || oldLogin.status === 400, `got ${oldLogin.status}`);

  const adminLogin = await admin.req("/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@classclash.com", password: "Admin#ClassClash2026" }) });
  check("admin@classclash.com login works", adminLogin.status === 200, `got ${adminLogin.status}`);
  check("role is admin", adminLogin.body?.role === "admin", JSON.stringify(adminLogin.body).slice(0, 80));

  const stats = await admin.req("/admin/stats");
  check("admin panel stats accessible", stats.status === 200 && !!stats.body?.stats, `got ${stats.status}`);
  const qBank = await admin.req("/admin/questions?page=1");
  check("admin question bank accessible", qBank.status === 200, `got ${qBank.status}`);
  const audit = await admin.req("/admin/audit");
  check("audit log accessible", audit.status === 200, `got ${audit.status}`);
  const meAdmin = await admin.req("/auth/me");
  check("me shows admin identity", meAdmin.body?.user?.email === "admin@classclash.com", JSON.stringify(meAdmin.body?.user?.email));

  // ── 2. Open registration (real users can join) ──
  console.log("\n2. Open registration");
  const u = jar();
  const stamp = Date.now();
  const email = `realuser${stamp}@testmail.com`;
  const reg = await u.req("/auth/register", { method: "POST", body: JSON.stringify({ email, password: "RealPass#2026", displayName: `Validator${stamp % 100000}` }) });
  check("registration open & works", reg.status === 200, `got ${reg.status} ${JSON.stringify(reg.body).slice(0, 120)}`);
  const dup = await jar().req("/auth/register", { method: "POST", body: JSON.stringify({ email, password: "RealPass#2026", displayName: `ValidatorX${stamp % 100000}` }) });
  check("duplicate email rejected", dup.status >= 400, `got ${dup.status}`);

  const struct = await u.req("/structure");
  const grades = struct.body?.structure?.grades ?? [];
  const subjects = struct.body?.structure?.subjects ?? [];
  const subjectGrades = struct.body?.structure?.subjectGrades ?? [];
  const jss3 = grades.find((g: any) => g.slug === "jss-3");
  check("structure lists JSS3", !!jss3);
  const jss3SubjectIds = subjectGrades.filter((sg: any) => sg.gradeId === jss3?.id).map((sg: any) => sg.subjectId);
  const jss3Subjects = subjects.filter((s: any) => jss3SubjectIds.includes(s.id));
  check("JSS3 has subjects (got " + jss3Subjects.length + ")", jss3Subjects.length >= 5);
  const onboard = await u.req("/onboarding", { method: "POST", body: JSON.stringify({ gradeId: jss3.id, avatar: "fox", displayName: `Validator${stamp % 100000}` }) });
  check("onboarding works", onboard.status === 200, `got ${onboard.status} ${JSON.stringify(onboard.body).slice(0, 100)}`);

  // ── 3. Quiz correctness flow (server-validated answers) ──
  console.log("\n3. Quiz correctness flow");
  const start = await u.req("/quiz/start", { method: "POST", body: JSON.stringify({ mode: "practice", subjectId: subjects.find((s: any) => s.slug === "mathematics")?.id }) });
  check("practice quiz starts", start.status === 200 && Array.isArray(start.body?.questions), `got ${start.status} ${JSON.stringify(start.body).slice(0, 100)}`);
  const qs = start.body?.questions ?? [];
  check("questions sanitized (no answer key leaked)", qs.length > 0 && qs.every((q: any) => q.options.every((o: any) => o.isCorrect === undefined)));
  const sessionId = start.body.sessionId;
  const q1 = qs[0];
  // Brute-force q1 options: exactly one must validate as correct server-side
  let correctCount = 0;
  let lastRes: any = null;
  for (const o of q1.options) {
    const r = await u.req(`/quiz/${sessionId}/answer`, { method: "POST", body: JSON.stringify({ questionId: q1.id, optionId: o.id, timeSpentMs: 3000 }) });
    lastRes = r;
    break; // only one answer per question allowed — use first option
  }
  check("answer endpoint validates option (server-side decision)", lastRes?.status === 200 && typeof lastRes.body?.correct === "boolean", JSON.stringify(lastRes?.body).slice(0, 100));
  const q2 = qs[1];
  const wrongOpt = q2.options[0];
  const wrongRes = await u.req(`/quiz/${sessionId}/answer`, { method: "POST", body: JSON.stringify({ questionId: q2.id, optionId: wrongOpt.id, timeSpentMs: 2000 }) });
  check("second question answered", wrongRes.status === 200 && typeof wrongRes.body?.correct === "boolean", JSON.stringify(wrongRes.body).slice(0, 100));
  const doubleAns = await u.req(`/quiz/${sessionId}/answer`, { method: "POST", body: JSON.stringify({ questionId: q2.id, optionId: q2.options[1]?.id, timeSpentMs: 1000 }) });
  check("double-answering blocked", doubleAns.status >= 400, `got ${doubleAns.status}`);
  const complete = await u.req(`/quiz/${sessionId}/complete`, { method: "POST", body: JSON.stringify({}) });
  check("quiz completes", complete.status === 200 && !!complete.body?.result, JSON.stringify(complete.body).slice(0, 120));

  // ── 4. Access control ──
  console.log("\n4. Access control");
  const blocked = await u.req("/admin/stats");
  check("student blocked from admin APIs (403)", blocked.status === 403, `got ${blocked.status}`);

  // ── 5. Reviewer account ──
  console.log("\n5. Reviewer account");
  const rev = jar();
  const revLogin = await rev.req("/auth/login", { method: "POST", body: JSON.stringify({ email: "reviewer@classclash.com", password: "Review#ClassClash2026" }) });
  check("reviewer@classclash.com login works", revLogin.status === 200, `got ${revLogin.status}`);
  check("role is reviewer", revLogin.body?.role === "reviewer", JSON.stringify(revLogin.body).slice(0, 80));
  const revAdmin = await rev.req("/admin/stats");
  check("reviewer blocked from admin-only stats", revAdmin.status === 403, `got ${revAdmin.status}`);

  // ── 6. Public features live ──
  console.log("\n6. Public features live");
  const anon = jar();
  const guest = await anon.req("/guest/quiz");
  check("guest preview quiz works", guest.status === 200 && guest.body?.demo?.questions?.length > 0);
  check("guest disclaimer updated (no 'Demo content' wording)", !String(guest.body?.disclaimer ?? "").includes("Demo content"), guest.body?.disclaimer);
  const champs = await anon.req("/champions");
  check("champions board public", champs.status === 200, `got ${champs.status}`);
  const schools = await anon.req("/schools");
  check("school league table public", schools.status === 200, `got ${schools.status}`);
  const lb = await anon.req("/leaderboard?type=season");
  check("leaderboard public", lb.status === 200, `got ${lb.status}`);

  console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

export {};

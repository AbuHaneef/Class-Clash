// Verify an SS3 student sees the new subjects/topics and can start a quiz from the new bank.
const BASE = "http://localhost:3000/api/clash";
let cookie = "";
async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  return r.json();
}

const email = "bankcheck" + Date.now() + "@test.cc";
await api("POST", "/auth/register", { email, password: "Check#1234", displayName: "BC" + Math.random().toString(36).slice(2, 8) });

const st = await api("GET", "/structure");
const ss3 = st.structure.grades.find((g: { slug: string }) => g.slug === "ss-3");
const onb = await api("POST", "/onboarding", { displayName: "BC" + Math.random().toString(36).slice(2, 8), avatar: "owl", gradeId: ss3.id });
console.log("onboarding response:", JSON.stringify(onb).slice(0, 200));
console.log("onboarded:", !onb.error);

const me = await api("GET", "/auth/me");
console.log("grade:", me.user.gradeName);

// subject detail for general-knowledge: does the SS3 student have access + topics?
const gkSubject = st.structure.subjects?.find((s: { slug: string }) => s.slug === "general-knowledge");
console.log("GK subject in structure:", gkSubject ? gkSubject.name : "MISSING");

// find gk subject id from DB-side structure payload subjects list
const sd = await api("GET", "/subject/" + gkSubject.id);
console.log("GK subject detail ok:", !sd.error, "| topics:", sd.topics?.map((t: { name: string }) => t.name).join(", "));
console.log("GK question count for SS3:", sd.questionCount ?? sd.count ?? "(field?)", "| keys:", Object.keys(sd));

// start a practice quiz from GK
const start = await api("POST", "/quiz/start", { subjectId: gkSubject.id, gradeId: ss3.id, topicId: null, mode: "practice" });
if (start.error) {
  console.log("quiz start error:", start.error);
} else {
  console.log("quiz started:", start.session?.id ?? start.sessionId ?? Object.keys(start));
  const sessId = start.session?.id ?? start.sessionId;
  const qz = await api("GET", "/quiz/" + sessId);
  const firstQ = qz.questions?.[0] ?? qz.session?.questions?.[0];
  console.log("first question source/text:", firstQ ? firstQ.text.slice(0, 80) : Object.keys(qz));
  console.log("options sanitized (no isCorrect):", firstQ ? JSON.stringify(firstQ.options?.[0]) : "-");
}

// also check chemistry subject shows new topics
const chemSubject = st.structure.subjects?.find((s: { slug: string }) => s.slug === "chemistry");
const cd = await api("GET", "/subject/" + chemSubject.id);
console.log("\nChemistry topics:", cd.topics?.map((t: { name: string }) => t.name).join(", "));

export {};

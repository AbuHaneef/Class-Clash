"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { LoadingCard, ErrorState, Pill } from "@/components/clash/shared";
import { QuestionImage } from "@/components/clash/QuestionImage";
import { Avatar } from "@/lib/clash/avatars";
import { toast } from "sonner";
import {
  ShieldCheck, LayoutDashboard, BookOpen, Users, Flag, ScrollText, Settings2, Trophy, Plus, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "questions", label: "Question Bank", icon: BookOpen },
  { key: "users", label: "Users & Roles", icon: Users },
  { key: "reports", label: "Moderation", icon: Flag },
  { key: "tournaments", label: "Tournaments", icon: Trophy },
  { key: "audit", label: "Audit Log", icon: ScrollText },
  { key: "config", label: "Platform Config", icon: Settings2 },
];

export default function AdminView({ section }: { section: string }) {
  const me = useClash((s) => s.me);
  const allowed = me?.role === "admin" || me?.role === "reviewer";

  if (!me) return <LoadingCard />;
  if (!allowed)
    return (
      <ErrorState
        message="Admin area — requires admin or reviewer role. Students stay out here! 🛡️"
        onRetry={() => navigate("/")}
      />
    );

  const active = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck size={22} className="text-violet-400" aria-hidden />
        <h1 className="font-display text-2xl font-bold">Admin — {active.label}</h1>
        {me.role === "reviewer" && <Pill color="violet">Reviewer (limited)</Pill>}
      </div>

      <div className="cc-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={active.key === s.key}
            onClick={() => navigate(`/admin/${s.key}`)}
            className={cn(
              "cc-tap flex shrink-0 items-center gap-1.5 rounded-2xl border-2 px-3.5 py-2 text-sm font-bold",
              active.key === s.key ? "border-violet-500 bg-violet-500/12 text-violet-300" : "border-border/60 bg-card/60 text-muted-foreground"
            )}
          >
            <s.icon size={15} aria-hidden /> {s.label}
          </button>
        ))}
      </div>

      {active.key === "dashboard" && <DashboardSection />}
      {active.key === "questions" && <QuestionsSection canReview={me.role === "admin" || me.role === "reviewer"} />}
      {active.key === "users" && me.role === "admin" ? <UsersSection /> : active.key === "users" && <ErrorState message="Admin role required for user management." />}
      {active.key === "reports" && <ReportsSection />}
      {active.key === "tournaments" && me.role === "admin" ? <TournamentsSection /> : active.key === "tournaments" && <ErrorState message="Admin role required for tournaments." />}
      {active.key === "audit" && <AuditSection />}
      {active.key === "config" && me.role === "admin" ? <ConfigSection /> : active.key === "config" && <ErrorState message="Admin role required for configuration." />}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────

function DashboardSection() {
  const [data, setData] = useState<{
    stats: Record<string, number>;
    recentSignups: { id: string; displayName: string; email: string; gradeName: string; createdAt: string; role: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ stats: Record<string, number>; recentSignups: { id: string; displayName: string; email: string; gradeName: string; createdAt: string; role: string }[] }>("/admin/stats").then((r) => {
      if (r.ok) setData(r as never);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingCard />;
  if (!data) return <ErrorState message="Could not load stats." />;
  const s = data.stats;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Students" value={s.students} />
        <Stat label="Questions published" value={s.published} />
        <Stat label="Pending review" value={s.pendingReview} highlight={s.pendingReview > 0} />
        <Stat label="Quiz sessions" value={s.sessions} />
        <Stat label="Challenges" value={s.challenges} />
        <Stat label="Active crowns" value={s.champions} />
        <Stat label="Open reports" value={s.reports} highlight={s.reports > 0} />
        <Stat label="Flagged sessions" value={s.flagged} highlight={s.flagged > 0} />
      </div>
      {s.flagged > 0 && (
        <p className="rounded-2xl border border-yellow-500/30 bg-yellow-500/8 p-4 text-xs text-yellow-200">
          ⚠️ {s.flagged} sessions answered suspiciously fast — review before acting. Flags are signals, never proof.
        </p>
      )}
      <section>
        <h2 className="mb-2.5 font-display font-bold">Recent signups</h2>
        <div className="cc-scroll max-h-96 overflow-y-auto rounded-2xl border border-border/60">
          {data.recentSignups.map((u) => (
            <div key={u.id} className="flex items-center gap-3 border-b border-border/40 p-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{u.displayName} <span className="text-xs font-normal text-muted-foreground">{u.email}</span></p>
                <p className="text-xs text-muted-foreground">{u.gradeName} • {new Date(u.createdAt).toLocaleString()}</p>
              </div>
              <Pill color={u.role === "admin" ? "violet" : "default"}>{u.role}</Pill>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4 text-center", highlight ? "border-yellow-500/40 bg-yellow-500/8" : "border-border/60 bg-card/70")}>
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Question bank ────────────────────────────────────────────

type AdminQuestion = {
  id: string; text: string; difficulty: string; status: string; source: string; isDemo: boolean;
  reviewNote: string | null; gradeName: string; subjectName: string; topicName: string; imageUrl: string | null;
  options: { id: string; text: string; isCorrect: boolean }[]; explanation: string; createdAt: string;
};

function QuestionsSection({ canReview }: { canReview: boolean }) {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiGet<{ questions: AdminQuestion[]; total: number }>(
      `/admin/questions?page=${page}${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`
    );
    if (r.ok) {
      setQuestions((r as unknown as { questions: AdminQuestion[] }).questions);
      setTotal((r as unknown as { total: number }).total);
    }
    setLoading(false);
  }, [page, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatusOf = async (id: string, newStatus: string) => {
    const r = await apiSend("PATCH", `/admin/questions/${id}`, { status: newStatus });
    if (!r.ok) return toast.error(r.error);
    toast(`Question ${newStatus}.`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-44 flex-1 items-center rounded-xl border border-input bg-secondary/40 px-3">
          <Search size={15} className="text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="Search question text…" className="cc-tap w-full bg-transparent px-2.5 py-2 text-sm outline-none" />
        </div>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="cc-tap rounded-xl border border-input bg-secondary/40 px-3 text-sm" aria-label="Filter status">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
        <button onClick={() => setCreating(!creating)} className="cc-tap flex items-center gap-1.5 rounded-xl bg-violet-500/20 px-3.5 text-sm font-bold text-violet-300">
          <Plus size={15} aria-hidden /> <span className="my-2 inline-block">New question</span>
        </button>
        <button onClick={() => setImporting(!importing)} className="cc-tap rounded-xl bg-secondary px-3.5 text-sm font-bold">
          <span className="my-2 inline-block">CSV import</span>
        </button>
      </div>

      {creating && <CreateQuestionForm onDone={() => { setCreating(false); load(); }} />}

      {importing && (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <p className="text-sm font-bold">Bulk CSV import</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Columns: gradeSlug, subjectSlug, topicName, difficulty, question, correctAnswer, wrong1, wrong2, wrong3, explanation
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={5}
            placeholder={"gradeSlug,subjectSlug,topicName,difficulty,question,correctAnswer,wrong1,wrong2,wrong3,explanation\njss-2,mathematics,Algebra,easy,Solve x+2=5,3,5,7,2,Subtract 2 from both sides"}
            className="mt-2 w-full rounded-xl border border-input bg-background/60 p-3 font-mono text-xs outline-none"
          />
          <button
            onClick={async () => {
              const r = await apiSend<{ imported: number; errors: { line: number; error: string }[] }>("POST", "/admin/questions/import", { csv });
              if (!r.ok) return toast.error(r.error);
              const d = r as unknown as { imported: number; errors: { line: number; error: string }[] };
              toast(`${d.imported} imported${d.errors.length ? `, ${d.errors.length} errors` : ""}`);
              if (d.errors.length) console.warn("Import errors:", d.errors);
              setCsv("");
              load();
            }}
            className="cc-tap mt-2 w-full rounded-xl bg-violet-500/80 py-2.5 text-sm font-bold text-white"
          >
            Import
          </button>
        </div>
      )}

      {loading ? (
        <LoadingCard />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} questions</p>
          <div className="space-y-2.5">
            {questions.map((question) => (
              <div key={question.id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{question.text}</p>
                    {question.imageUrl && (
                      <div className="mt-2">
                        <QuestionImage src={question.imageUrl} alt="Question illustration" maxHeight={110} />
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {question.gradeName} • {question.subjectName} • {question.topicName} • {question.difficulty} • {question.source}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {question.options.map((o, i) => (
                        <span
                          key={o.id}
                          className={cn(
                            "rounded-lg px-2 py-0.5 text-xs",
                            o.isCorrect ? "bg-emerald-500/15 font-bold text-emerald-300" : "bg-secondary text-muted-foreground"
                          )}
                        >
                          {String.fromCharCode(65 + i)}. {o.text}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs italic text-muted-foreground">💡 {question.explanation}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Pill color={question.status === "published" ? "green" : question.status === "pending" ? "gold" : "red"}>
                      {question.status}
                    </Pill>
                    {canReview && question.status !== "published" && (
                      <button onClick={() => setStatusOf(question.id, "published")} className="cc-tap rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">Publish</button>
                    )}
                    {canReview && question.status === "published" && (
                      <button onClick={() => setStatusOf(question.id, "rejected")} className="cc-tap rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">Reject</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="cc-tap rounded-xl bg-secondary px-4 py-2 text-sm font-bold disabled:opacity-40">← Prev</button>
            <span className="self-center text-sm text-muted-foreground">Page {page} / {Math.max(1, Math.ceil(total / 20))}</span>
            <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)} className="cc-tap rounded-xl bg-secondary px-4 py-2 text-sm font-bold disabled:opacity-40">Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

function CreateQuestionForm({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [options, setOptions] = useState([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [structure, setStructure] = useState<{
    grades: { id: string; name: string; hasContent: boolean }[];
    subjects: { id: string; name: string }[];
    topics: { id: string; subjectId: string; name: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ structure: { grades: { id: string; name: string; hasContent: boolean }[]; subjects: { id: string; name: string }[]; topics: { id: string; subjectId: string; name: string }[] } }>("/structure").then((r) => {
      if (r.ok) setStructure((r as unknown as { structure: never }).structure);
    });
  }, []);

  const topics = structure?.topics.filter((t) => t.subjectId === subjectId) ?? [];

  const submit = async () => {
    setError(null);
    const r = await apiSend("POST", "/admin/questions", {
      text, explanation, difficulty, gradeId, subjectId, topicId, options,
    });
    if (!r.ok) return setError(r.error);
    if ("error" in (r as object)) return setError((r as unknown as { error: string }).error);
    toast("Question published!");
    onDone();
  };

  return (
    <div className="space-y-3 rounded-2xl border border-violet-500/30 bg-violet-500/6 p-4">
      <p className="font-display font-bold">New question</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Question text…" className="cc-tap w-full rounded-xl border border-input bg-background/60 p-3 text-sm outline-none" />
      <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} placeholder="Explanation of the correct answer…" className="cc-tap w-full rounded-xl border border-input bg-background/60 p-3 text-sm outline-none" />
      <div className="grid grid-cols-3 gap-2">
        <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} className="cc-tap rounded-xl border border-input bg-secondary/40 px-2.5 py-2 text-sm" aria-label="Class">
          <option value="">Class…</option>
          {structure?.grades.filter((g) => g.hasContent).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(""); }} className="cc-tap rounded-xl border border-input bg-secondary/40 px-2.5 py-2 text-sm" aria-label="Subject">
          <option value="">Subject…</option>
          {structure?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="cc-tap rounded-xl border border-input bg-secondary/40 px-2.5 py-2 text-sm" aria-label="Topic" disabled={!subjectId}>
          <option value="">Topic…</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setOptions(options.map((x, xi) => ({ ...x, isCorrect: xi === i })))}
              className={cn("cc-tap h-9 w-9 shrink-0 rounded-full text-xs font-bold", o.isCorrect ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground")}
              aria-label={`Mark option ${i + 1} correct`}
            >
              {String.fromCharCode(65 + i)}
            </button>
            <input
              value={o.text}
              onChange={(e) => setOptions(options.map((x, xi) => (xi === i ? { ...x, text: e.target.value } : x)))}
              placeholder={`Option ${i + 1}${o.isCorrect ? " (correct)" : ""}`}
              className="cc-tap w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none"
            />
          </div>
        ))}
      </div>
      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="cc-tap rounded-xl border border-input bg-secondary/40 px-2.5 py-2 text-sm" aria-label="Difficulty">
        <option value="easy">Easy (100 pts)</option>
        <option value="medium">Medium (125 pts)</option>
        <option value="hard">Hard (150 pts)</option>
      </select>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} className="cc-tap flex-1 rounded-xl bg-violet-500/80 py-2.5 text-sm font-bold text-white">Publish question</button>
        <button onClick={onDone} className="cc-tap rounded-xl bg-secondary px-4 text-sm font-bold">Cancel</button>
      </div>
    </div>
  );
}

// ── Users ────────────────────────────────────────────────────

type AdminUser = {
  id: string; email: string; displayName: string; avatar: string; role: string;
  gradeName: string | null; xp: number; rating: number; titles: number;
  isBot: boolean; suspendedUntil: string | null; deletedAt: string | null; createdAt: string;
};

function UsersSection() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiGet<{ users: AdminUser[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (r.ok) setUsers((r as unknown as { users: AdminUser[] }).users);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (userId: string, body: Record<string, unknown>) => {
    const r = await apiSend("PATCH", "/admin/users", { userId, ...body });
    if (!r.ok) return toast.error((r as unknown as { error?: string }).error ?? r.error);
    toast("Updated.");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center rounded-xl border border-input bg-secondary/40 px-3">
        <Search size={15} className="text-muted-foreground" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="cc-tap w-full bg-transparent px-2.5 py-2 text-sm outline-none" />
      </div>
      {loading ? <LoadingCard /> : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3.5">
              <Avatar avatar={u.avatar} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {u.displayName} {u.isBot && <Pill>Bot</Pill>}
                  {u.deletedAt && <Pill color="red">deleted</Pill>}
                  {u.suspendedUntil && u.suspendedUntil > new Date().toISOString() && <Pill color="red">suspended</Pill>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email} • {u.gradeName ?? "no class"} • Lv {Math.floor(Math.sqrt(u.xp / 50)) + 1} • {u.xp} XP • {u.titles}👑
                </p>
              </div>
              <select
                value={u.role}
                onChange={(e) => patch(u.id, { role: e.target.value })}
                className="cc-tap rounded-lg border border-input bg-secondary/40 px-2 py-1.5 text-xs"
                aria-label={`Role for ${u.displayName}`}
              >
                {["student", "teacher", "school_admin", "reviewer", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {u.suspendedUntil && u.suspendedUntil > new Date().toISOString() ? (
                <button onClick={() => patch(u.id, { suspend: false })} className="cc-tap rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300">Unsuspend</button>
              ) : (
                <button onClick={() => patch(u.id, { suspend: true, reason: "manual suspension" })} className="cc-tap rounded-lg bg-red-500/12 px-2.5 py-1.5 text-xs font-bold text-red-400">Suspend</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reports ──────────────────────────────────────────────────

function ReportsSection() {
  const [reports, setReports] = useState<
    { id: string; targetType: string; targetId: string; target: string; reason: string; details: string | null; status: string; reporter: string; createdAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await apiGet<{ reports: typeof reports }>("/admin/reports");
    if (r.ok) setReports((r as unknown as { reports: typeof reports }).reports);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (reportId: string, status: "resolved" | "dismissed") => {
    await apiSend("PATCH", "/admin/reports", { reportId, status });
    toast(`Report ${status}.`);
    load();
  };

  if (loading) return <LoadingCard />;
  if (reports.length === 0) return <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">No reports. A clean kingdom! 🎉</p>;

  return (
    <div className="space-y-2.5">
      {reports.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {r.targetType === "user" ? "👤" : "❓"} {r.reason}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Target: {r.target}</p>
              {r.details && <p className="mt-1 text-xs italic text-muted-foreground">“{r.details}”</p>}
              <p className="mt-1 text-xs text-muted-foreground">By {r.reporter} • {new Date(r.createdAt).toLocaleString()}</p>
            </div>
            {r.status === "open" ? (
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => resolve(r.id, "resolved")} className="cc-tap rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300">Resolve</button>
                <button onClick={() => resolve(r.id, "dismissed")} className="cc-tap rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold">Dismiss</button>
              </div>
            ) : (
              <Pill color={r.status === "resolved" ? "green" : "default"}>{r.status}</Pill>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tournaments ──────────────────────────────────────────────

function TournamentsSection() {
  const [tournaments, setTournaments] = useState<
    { id: string; name: string; status: string; subjectName: string; gradeName: string; maxParticipants: number; participants: { userId: string; displayName: string; seed: number }[]; matches: { id: string; round: number; slot: number; player1: string; player2: string; player1Id: string | null; player2Id: string | null; winnerId: string | null; status: string }[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxP, setMaxP] = useState(8);

  const load = useCallback(async () => {
    const r = await apiGet<{ tournaments: typeof tournaments }>("/admin/tournaments");
    if (r.ok) setTournaments((r as unknown as { tournaments: typeof tournaments }).tournaments);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const r = await apiSend("POST", "/admin/tournaments", { action: "create", name, description, maxParticipants: maxP });
    if (!r.ok) return toast.error(r.error);
    toast("Tournament created & registration opened!");
    setName(""); setDescription("");
    load();
  };

  const start = async (tournamentId: string) => {
    const r = await apiSend("POST", "/admin/tournaments", { action: "start", tournamentId });
    if (!r.ok) return toast.error((r as unknown as { error?: string }).error ?? r.error);
    toast("Bracket generated!");
    load();
  };

  const resolveMatch = async (matchId: string, winnerId: string, tournamentId: string) => {
    const r = await apiSend("POST", "/admin/tournaments", { action: "resolve", matchId, winnerId });
    if (!r.ok) return toast.error((r as unknown as { error?: string }).error ?? r.error);
    toast("Match resolved — winner advances.");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-500/30 bg-violet-500/6 p-4">
        <p className="font-display font-bold">Create tournament</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tournament name" className="cc-tap rounded-xl border border-input bg-background/60 px-3 py-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="cc-tap rounded-xl border border-input bg-background/60 px-3 py-2 text-sm" />
          <select value={maxP} onChange={(e) => setMaxP(Number(e.target.value))} className="cc-tap rounded-xl border border-input bg-secondary/40 px-3 py-2 text-sm" aria-label="Max participants">
            {[4, 8, 16, 32].map((n) => <option key={n} value={n}>{n} players</option>)}
          </select>
        </div>
        <button onClick={create} disabled={name.length < 3} className="cc-tap mt-2 w-full rounded-xl bg-violet-500/80 py-2.5 text-sm font-bold text-white disabled:opacity-50">Create & open registration</button>
      </div>

      {loading ? <LoadingCard /> : tournaments.map((t) => (
        <div key={t.id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display font-bold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.subjectName} • {t.gradeName} • {t.participants.length}/{t.maxParticipants} players • {t.status}</p>
            </div>
            {t.status === "registration" && t.participants.length >= 2 && (
              <button onClick={() => start(t.id)} className="cc-tap rounded-xl bg-yellow-500/20 px-3 py-2 text-xs font-bold text-yellow-300">Start bracket</button>
            )}
          </div>
          {t.matches.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {t.matches
                .filter((m) => m.round === 1 || m.player1Id || m.player2Id)
                .map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-xl bg-secondary/40 p-2.5 text-xs">
                    <span className="w-12 shrink-0 text-muted-foreground">R{m.round}M{m.slot + 1}</span>
                    {m.status === "completed" || m.winnerId ? (
                      <span className="flex-1">
                        <strong className={m.winnerId === m.player1Id ? "text-emerald-400" : ""}>{m.player1}</strong> vs <strong className={m.winnerId === m.player2Id ? "text-emerald-400" : ""}>{m.player2}</strong>
                      </span>
                    ) : m.player1Id && m.player2Id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <button onClick={() => resolveMatch(m.id, m.player1Id!, t.id)} className="cc-tap rounded-lg bg-secondary px-2 py-1 font-bold hover:bg-yellow-500/20">{m.player1} wins</button>
                        <button onClick={() => resolveMatch(m.id, m.player2Id!, t.id)} className="cc-tap rounded-lg bg-secondary px-2 py-1 font-bold hover:bg-yellow-500/20">{m.player2} wins</button>
                      </div>
                    ) : (
                      <span className="flex-1 text-muted-foreground">{m.player1} vs {m.player2} (waiting)</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Audit log ────────────────────────────────────────────────

function AuditSection() {
  const [logs, setLogs] = useState<{ id: string; action: string; entity: string; entityId: string | null; details: string | null; actor: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ logs: typeof logs }>("/admin/audit?what=audit").then((r) => {
      if (r.ok) setLogs((r as unknown as { logs: typeof logs }).logs);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingCard />;

  return (
    <div className="cc-scroll max-h-[70vh] overflow-y-auto rounded-2xl border border-border/60">
      {logs.map((l) => (
        <div key={l.id} className="flex items-center gap-3 border-b border-border/40 p-3 text-sm last:border-0">
          <Pill color={l.action.includes("reject") || l.action.includes("suspend") ? "red" : l.action.includes("publish") || l.action.includes("create") ? "green" : "default"}>
            {l.action}
          </Pill>
          <div className="min-w-0 flex-1">
            <p className="truncate">{l.entity}{l.entityId ? ` #${l.entityId.slice(-6)}` : ""} {l.details ? <span className="text-muted-foreground">— {l.details}</span> : null}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{l.actor} • {new Date(l.createdAt).toLocaleString()}</span>
        </div>
      ))}
      {logs.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No audit entries yet.</p>}
    </div>
  );
}

// ── Config ───────────────────────────────────────────────────

function ConfigSection() {
  const [config, setConfig] = useState<Record<string, string> | null>(null);
  const [announcement, setAnnouncement] = useState({ title: "", body: "" });

  useEffect(() => {
    apiGet<{ config: Record<string, string> }>("/admin/audit?what=config").then((r) => {
      if (r.ok) setConfig((r as unknown as { config: Record<string, string> }).config);
    });
  }, []);

  const save = async () => {
    const r = await apiSend("PUT", "/admin/audit", { config });
    if (!r.ok) return toast.error(r.error);
    toast("Configuration saved (audit-logged).");
  };

  const postAnnouncement = async () => {
    const r = await apiSend("PUT", "/admin/audit", { announcement });
    if (!r.ok) return toast.error(r.error);
    toast("Announcement published!");
    setAnnouncement({ title: "", body: "" });
  };

  if (!config) return <LoadingCard />;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/60 bg-card/70 p-4">
        <p className="font-display font-bold">Game rules & limits</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {Object.entries(config).map(([key, value]) => (
            <label key={key} className="text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">{key}</span>
              <input
                value={value}
                inputMode="numeric"
                onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                className="cc-tap w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none"
              />
            </label>
          ))}
        </div>
        <button onClick={save} className="cc-tap mt-3 w-full rounded-xl bg-violet-500/80 py-2.5 text-sm font-bold text-white">Save configuration</button>
        <p className="mt-2 text-xs text-muted-foreground">Changes are audit-logged and apply to future competitions.</p>
      </section>

      <section className="rounded-2xl border border-yellow-500/30 bg-yellow-500/6 p-4">
        <p className="font-display font-bold">Publish announcement</p>
        <input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} placeholder="Title" className="cc-tap mt-2 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm" />
        <textarea value={announcement.body} onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })} rows={2} placeholder="Message to all students…" className="cc-tap mt-2 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm" />
        <button onClick={postAnnouncement} disabled={announcement.title.length < 3} className="cc-tap mt-2 w-full rounded-xl bg-yellow-500/80 py-2.5 text-sm font-bold text-yellow-950 disabled:opacity-50">Publish</button>
      </section>
    </div>
  );
}

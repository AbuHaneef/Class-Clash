"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate, useRoute } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import {
  SubjectIcon, ChampionCrown, EmptyState, LoadingCard, Pill, ErrorState,
} from "@/components/clash/shared";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Timer, Layers, Crown, Shuffle, TrendingDown, Swords, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SubjectDetail = {
  subject: {
    id: string; name: string; icon: string; color: string; description: string;
    grades: { id: string; name: string }[];
    activeGrade: { id: string; name: string };
    topics: { id: string; name: string; description: string; questionCount: number }[];
    totalQuestions: number;
    champion: { userId: string; displayName: string; avatar: string; isBot: boolean; wonAt: string; defences: number } | null;
    myStats: { answered: number; correct: number; accuracy: number; bestScore: number | null } | null;
    iAmChampion: boolean;
  } | null;
  message?: string;
};

export default function SubjectDetailView({ subjectId }: { subjectId?: string }) {
  const me = useClash((s) => s.me);
  const route = useRoute();
  const [data, setData] = useState<SubjectDetail["subject"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  // optional ?grade= in hash
  const gradeParam = route.path.includes("?") ? route.path.split("?")[1] : "";
  const gradeQuery = new URLSearchParams(gradeParam).get("grade") ?? undefined;

  const load = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    const r = await apiGet<SubjectDetail>(`/subject/${subjectId}${gradeQuery ? `?gradeId=${gradeQuery}` : ""}`);
    if (r.ok) setData((r as unknown as { subject: SubjectDetail["subject"] }).subject);
    else setError(r.error);
    setLoading(false);
  }, [subjectId, gradeQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const startQuiz = async (mode: string, topicId?: string, difficulty?: string, count?: number) => {
    if (!me) return navigate("/login");
    setStarting(mode + (topicId ?? ""));
    const r = await apiSend<{ sessionId: string }>("POST", "/quiz/start", {
      mode,
      subjectId,
      topicId,
      difficulty,
      count,
    });
    setStarting(null);
    if (!r.ok) return toast.error(r.error);
    navigate(`/quiz/${r.sessionId}`);
  };

  if (loading) return <LoadingCard label="Loading subject…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data)
    return <EmptyState title="Subject not available" description="This subject isn't offered for the selected class yet." />;

  const s = data;
  const isMyGrade = me?.gradeId === s.activeGrade.id;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/subjects")} className="cc-tap flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden /> All subjects
      </button>

      {/* header */}
      <section className="rounded-3xl border border-border/60 bg-card/70 p-5 sm:p-6" style={{ boxShadow: `0 0 0 1px ${s.color}22, 0 14px 40px -18px ${s.color}55` }}>
        <div className="flex flex-wrap items-center gap-4">
          <SubjectIcon icon={s.icon} color={s.color} size={34} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{s.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {s.activeGrade.name} • {s.totalQuestions} published questions • {s.topics.length} topics
            </p>
          </div>
          {s.myStats && s.myStats.answered > 0 && (
            <div className="rounded-2xl bg-secondary/60 px-4 py-2.5 text-center">
              <p className="font-display text-xl font-bold" style={{ color: s.color }}>{s.myStats.accuracy}%</p>
              <p className="text-[11px] text-muted-foreground">your accuracy</p>
            </div>
          )}
        </div>

        {/* quick modes */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <ModeButton
            icon={Play} label="Quick Practice" desc="10 mixed questions, untimed"
            color="#34d399" busy={starting === "practice"} disabled={!isMyGrade}
            onClick={() => startQuiz("practice", undefined, undefined, 10)}
          />
          <ModeButton
            icon={Timer} label="Quick Arena" desc="7 timed competitive questions"
            color="#f5c518" busy={starting === "quick_arena"} disabled={!isMyGrade}
            onClick={() => startQuiz("quick_arena")}
          />
          <ModeButton
            icon={Shuffle} label="Mixed Practice" desc="Random topics, at your pace"
            color="#a855f7" busy={starting === "practice-mixed"} disabled={!isMyGrade}
            onClick={() => startQuiz("practice", undefined, undefined, 15)}
          />
          <ModeButton
            icon={FileText} label="Exam Prep" desc="20 questions, exam style"
            color="#f472b6" busy={starting === "exam"} disabled={!isMyGrade}
            onClick={() => startQuiz("exam", undefined, undefined, 20)}
          />
        </div>
        {!isMyGrade && (
          <p className="mt-3 rounded-xl bg-orange-500/10 px-4 py-2.5 text-xs text-orange-300">
            You're viewing {s.activeGrade.name}. To keep competition fair, quizzes are only playable for your own class ({me?.gradeName ?? "set your class first"}).
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* topics */}
        <section className="lg:col-span-3">
          <h2 className="mb-3 font-display text-lg font-bold">Topics</h2>
          {s.topics.filter((t) => t.questionCount > 0).length === 0 ? (
            <EmptyState title="No questions yet" description="Editors are preparing questions for these topics." />
          ) : (
            <div className="space-y-2.5">
              {s.topics.map((t) => (
                <div key={t.id} className={cn("rounded-2xl border border-border/60 bg-card/70 p-4", t.questionCount === 0 && "opacity-50")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.description} • {t.questionCount} questions
                      </p>
                    </div>
                    {t.questionCount > 0 && isMyGrade && (
                      <button
                        onClick={() => startQuiz("practice", t.id, undefined, 10)}
                        disabled={starting === "practice" + t.id}
                        className="cc-tap shrink-0 rounded-xl bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 px-4 text-sm font-bold text-white active:scale-95 disabled:opacity-50"
                      >
                        <span className="my-2 inline-flex items-center gap-1.5"><Play size={14} aria-hidden /> Practise</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6 lg:col-span-2">
          {/* champion */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Current Champion</h2>
            {s.champion ? (
              <div className="space-y-3">
                <ChampionCrown
                  name={s.champion.displayName}
                  avatar={s.champion.avatar}
                  subjectName={s.activeGrade.name}
                  isMe={s.iAmChampion}
                  defences={s.champion.defences}
                  onOpen={() => navigate(`/champion/${s.activeGrade.id}/${s.id}`)}
                />
                <button
                  onClick={async () => {
                    if (!me) return navigate("/login");
                    if (!isMyGrade) return toast.error("This crown belongs to another class.");
                    const r = await apiSend<{ challenge: { id: string } }>("POST", "/challenges", {
                      type: "champion",
                      subjectId: s.id,
                    });
                    if (!r.ok) return toast.error(r.error);
                    toast("Challenge accepted — the champion awaits!");
                    navigate(`/duel/${r.challenge.id}`);
                  }}
                  disabled={!isMyGrade || s.iAmChampion}
                  className="cc-tap w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-3 font-display font-bold text-yellow-950 shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50"
                >
                  <Crown size={16} className="mr-1.5 inline" aria-hidden />
                  {s.iAmChampion ? "You hold this crown" : "Challenge for the Crown"}
                </button>
              </div>
            ) : (
              <EmptyState icon={Crown} title="No champion yet" description="Win a duel in this subject to claim the first crown." />
            )}
          </section>

          {/* duel a classmate */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Duel a Classmate</h2>
            <button
              onClick={() => navigate("/duels")}
              className="cc-tap flex w-full items-center gap-3 rounded-2xl border border-pink-500/30 bg-pink-500/10 p-4 text-left hover:border-pink-500/60"
            >
              <Swords size={20} className="text-pink-400" aria-hidden />
              <div className="flex-1">
                <p className="font-display font-bold">Head-to-head</p>
                <p className="text-xs text-muted-foreground">Same questions for both players. Winner takes the bragging rights.</p>
              </div>
            </button>
          </section>

          {/* weak topics shortcut */}
          {s.myStats && s.myStats.answered >= 5 && s.myStats.accuracy < 70 && (
            <section className="rounded-2xl border border-orange-500/30 bg-orange-500/8 p-4">
              <p className="flex items-center gap-2 font-display font-bold text-orange-300">
                <TrendingDown size={17} aria-hidden /> Needs attention
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Your {s.name} accuracy is {s.myStats.accuracy}%. A focused topic practice would be a smart move!
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  icon: Icon, label, desc, color, onClick, busy, disabled,
}: {
  icon: React.ElementType; label: string; desc: string; color: string;
  onClick: () => void; busy?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="cc-tap flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 text-center transition-all active:scale-95 disabled:opacity-50"
      style={{ borderColor: color + "40", background: color + "0f" }}
    >
      <Icon size={20} style={{ color }} aria-hidden />
      <span className="font-display text-sm font-bold">{label}</span>
      <span className="text-[11px] leading-tight text-muted-foreground">{desc}</span>
    </button>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { SubjectIcon, LoadingCard, ErrorState, EmptyState, Pill } from "@/components/clash/shared";
import { Avatar } from "@/lib/clash/avatars";
import { toast } from "sonner";
import { Zap, CalendarCheck, Timer, Play, Trophy, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Structure = {
  subjects: { id: string; name: string; icon: string; color: string }[];
  subjectGrades: { subjectId: string; gradeId: string }[];
};

type DailyData = {
  daily: {
    id: string; date: string;
    subject: { id: string; name: string; color: string; icon: string };
    questionCount: number;
    myEntry: { score: number; correctCount: number; sessionId: string; sessionStatus: string } | null;
    leaderboard: { rank: number; id: string; displayName: string; avatar: string; score: number; correctCount: number; timeMs: number; isMe: boolean }[];
  } | null;
  message?: string;
};

export default function DailyAndArenaView({ which }: { which: "arena" | "daily" }) {
  const me = useClash((s) => s.me);
  const [structure, setStructure] = useState<Structure | null>(null);
  const [daily, setDaily] = useState<DailyData["daily"]>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (which === "daily") {
      const r = await apiGet<DailyData>("/daily");
      if (r.ok) setDaily((r as unknown as DailyData).daily);
    } else {
      const r = await apiGet<{ structure: Structure }>("/structure");
      if (r.ok) setStructure(r.structure);
    }
    setLoading(false);
  }, [which]);

  useEffect(() => {
    load();
  }, [load]);

  const mySubjects = React.useMemo(() => {
    if (!structure || !me?.gradeId) return [];
    const ids = new Set(
      structure.subjectGrades.filter((sg) => sg.gradeId === me.gradeId).map((sg) => sg.subjectId)
    );
    return structure.subjects.filter((s) => ids.has(s.id));
  }, [structure, me]);

  const startArena = async (subjectId: string) => {
    setStarting(subjectId);
    const r = await apiSend<{ sessionId: string }>("POST", "/quiz/start", {
      mode: "quick_arena",
      subjectId,
    });
    setStarting(null);
    if (!r.ok) return toast.error(r.error);
    navigate(`/quiz/${(r as unknown as { sessionId: string }).sessionId}`);
  };

  const playDaily = async () => {
    setStarting("daily");
    const r = await apiSend<{ sessionId: string }>("POST", "/quiz/start", { mode: "daily" });
    setStarting(null);
    if (!r.ok) return toast.error(r.error);
    navigate(`/quiz/${(r as unknown as { sessionId: string }).sessionId}`);
  };

  if (loading) return <LoadingCard label="Loading…" />;

  return (
    <div className="space-y-6">
      {which === "arena" ? (
        <>
          <div className="cc-hero-bg rounded-3xl border border-border/60 p-6">
            <Pill color="gold" className="mb-3"><Zap size={13} aria-hidden /> Timed competitive mode</Pill>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Quick Arena</h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              7 questions • 20 seconds each • speed bonus up to +20 pts per answer.
              Every session is server-validated and counts toward your season points.
            </p>
          </div>
          {mySubjects.length === 0 ? (
            <EmptyState title="No subjects for your class yet" description="Ask your teacher to check back soon — content is being added." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mySubjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => startArena(s.id)}
                  disabled={starting === s.id}
                  className="cc-tap flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 text-left transition-all hover:border-yellow-500/50 active:scale-95 disabled:opacity-50"
                >
                  <SubjectIcon icon={s.icon} color={s.color} size={24} />
                  <div className="flex-1">
                    <p className="font-display font-bold">{s.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Timer size={11} aria-hidden /> 7 questions • 20s each
                    </p>
                  </div>
                  <Play size={18} className="text-yellow-400" aria-hidden />
                </button>
              ))}
            </div>
          )}
          <section className="rounded-2xl border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground/80">Arena scoring rules (published):</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
              <li>Correct answer: 100 pts base × difficulty multiplier (Easy ×1, Medium ×1.25, Hard ×1.5)</li>
              <li>Speed bonus: up to +20 pts for fast correct answers</li>
              <li>Wrong or timed-out answers: 0 pts</li>
              <li>Ties in challenges: more correct → faster total time → higher rating</li>
            </ul>
          </section>
        </>
      ) : (
        <>
          <div className="cc-hero-bg rounded-3xl border border-border/60 p-6">
            <Pill color="violet" className="mb-3"><CalendarCheck size={13} aria-hidden /> One shot per day</Pill>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Daily Challenge</h1>
            {daily ? (
              <>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary/50 p-4">
                  <SubjectIcon icon={daily.subject.icon} color={daily.subject.color} size={28} />
                  <div className="flex-1">
                    <p className="font-display font-bold">{daily.subject.name}</p>
                    <p className="text-xs text-muted-foreground">{daily.questionCount} timed questions • everyone in your class gets the same set</p>
                  </div>
                  {daily.myEntry && daily.myEntry.sessionStatus === "completed" ? (
                    <Pill color="green">Done ✓ {daily.myEntry.score} pts</Pill>
                  ) : daily.myEntry ? (
                    <button onClick={playDaily} className="cc-tap rounded-xl bg-yellow-400 px-4 py-2 font-bold text-yellow-950 active:scale-95">Resume</button>
                  ) : (
                    <button
                      onClick={playDaily}
                      disabled={starting === "daily"}
                      className="cc-tap rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-2 font-display font-bold text-yellow-950 active:scale-95 disabled:opacity-50"
                    >
                      Play now
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{daily === null && loading ? "Loading…" : "Today's challenge isn't ready for your class yet."}</p>
            )}
          </div>

          {daily && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                <Trophy size={18} className="text-yellow-400" aria-hidden /> Today's Class Board
              </h2>
              {daily.leaderboard.length === 0 ? (
                <EmptyState title="No entries yet" description="Be the first from your class to post a score today!" />
              ) : (
                <div className="space-y-2">
                  {daily.leaderboard.map((e) => (
                    <div
                      key={e.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3",
                        e.isMe ? "border-yellow-500/40 bg-yellow-500/8" : "border-border/60 bg-card/70"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
                          e.rank === 1 ? "cc-podium-1 text-yellow-950" : e.rank === 2 ? "cc-podium-2 text-white" : e.rank === 3 ? "cc-podium-3 text-white" : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {e.rank}
                      </span>
                      <Avatar avatar={e.avatar} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{e.displayName} {e.isMe && <span className="text-yellow-400">(you)</span>}</p>
                        <p className="text-xs text-muted-foreground">{e.correctCount} correct • {Math.round(e.timeMs / 1000)}s</p>
                      </div>
                      <span className="font-display font-bold">{e.score}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                <CheckCircle2 size={12} className="mr-1 inline" aria-hidden />
                One official entry per account per day — replays don't overwrite your score.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

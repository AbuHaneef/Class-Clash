"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend, localDateStr } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import {
  SectionTitle, SubjectIcon, StreakFlame, XPBar, LevelBadge, SkeletonCards,
  EmptyState, Pill, ChampionCrown, LoadingCard,
} from "@/components/clash/shared";
import { sfx } from "@/lib/clash/client/sound";
import { toast } from "sonner";
import {
  Zap, CalendarCheck, Swords, Trophy, Flame, ArrowRight, Play, Crown,
  Target, Gift, ChevronRight, BookOpen, TrendingUp, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type HomeData = {
  me: {
    displayName: string;
    avatar: string;
    gradeName: string | null;
    streakCount: number;
    xp: number;
    level: { level: number; title: string; pct: number; intoLevel: number; needed: number };
    rating: number;
    seasonPoints: number;
    myTitles: number;
    totalTitles: number;
  };
  missions: {
    code: string; name: string; description: string; icon: string;
    target: number; xpReward: number; progress: number; completed: boolean; claimed: boolean;
  }[];
  daily: {
    subjectName: string; subjectColor: string; subjectIcon: string;
    questionCount: number; played: boolean; myScore: number | null;
  } | null;
  champions: {
    subjectId: string; gradeId: string; subjectName: string; subjectColor: string;
    subjectIcon: string; championName: string; championAvatar: string;
    isBot: boolean; isMe: boolean; defences: number;
  }[];
  recentSessions: {
    id: string; subjectName: string; subjectColor: string; subjectIcon: string;
    score: number; correctCount: number; totalCount: number; mode: string; completedAt: string;
  }[];
  activeChallenges: {
    id: string; type: string; status: string; statusLabel: string; subjectName: string;
    subjectColor: string; opponentName: string; opponentAvatar: string;
    iAmCreator: boolean; isChampion: boolean;
  }[];
  weakTopics: { name: string; subject: string; subjectId: string; accuracy: number; total: number }[];
  motivational: string;
};

export default function DashboardView() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const r = await apiGet<HomeData>("/home");
    if (r.ok) setData(r as unknown as HomeData);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) return <LoadingCard label="Loading your arena…" />;
  if (!data || !data.me)
    return <EmptyState title="Could not load your dashboard" description="Check your connection and try again." action={<button onClick={refresh} className="cc-tap rounded-xl bg-secondary px-4 py-2 text-sm font-semibold">Retry</button>} />;

  const m = data.me;
  const unclaimed = data.missions.filter((x) => x.completed && !x.claimed).length;

  return (
    <div className="space-y-7">
      {/* ── Welcome + XP ── */}
      <section className="cc-hero-bg rounded-3xl border border-border/60 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar avatar={m.avatar} size={56} ring="#f5c51855" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-bold sm:text-2xl">
              Hey, {m.displayName}! <LevelBadge level={m.level.level} size={30} />
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {m.gradeName} • {m.level.title} • Rating {m.rating}
              {m.myTitles > 0 && <span className="text-yellow-400"> • {m.myTitles} 👑</span>}
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <StreakFlame count={m.streakCount} />
            <p className="mt-1 text-xs text-muted-foreground">{m.seasonPoints} season pts</p>
          </div>
        </div>
        <div className="mt-4">
          <XPBar pct={m.level.pct} level={m.level.level} intoLevel={m.level.intoLevel} needed={m.level.needed} />
        </div>
        <p className="mt-3 text-sm italic text-yellow-300/90">“{data.motivational}”</p>
      </section>

      {/* ── Quick actions ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Practice", icon: BookOpen, path: "/subjects", color: "#34d399" },
          { label: "Quick Arena", icon: Zap, path: "/arena", color: "#f5c518" },
          { label: "Daily", icon: CalendarCheck, path: "/daily", color: "#a855f7" },
          { label: "Duel", icon: Swords, path: "/duels", color: "#f472b6" },
        ].map((a) => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className="cc-tap flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/70 p-4 transition-all hover:border-border active:scale-95"
          >
            <span className="rounded-xl p-2.5" style={{ background: a.color + "1f" }}>
              <a.icon size={20} style={{ color: a.color }} aria-hidden />
            </span>
            <span className="font-display text-sm font-bold">{a.label}</span>
          </button>
        ))}
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <div className="space-y-7">
          {/* ── Daily challenge ── */}
          <section>
            <SectionTitle icon={CalendarCheck} title="Today's Challenge" action={<button onClick={() => navigate("/daily")} className="text-xs font-semibold text-yellow-400 hover:underline">Details</button>} />
            {data.daily ? (
              <button
                onClick={() => navigate("/daily")}
                className="cc-tap flex w-full items-center gap-4 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/12 to-transparent p-4 text-left transition-all hover:border-violet-500/60"
              >
                <span className="rounded-2xl bg-violet-500/15 p-3">
                  <SubjectIcon icon={data.daily.subjectIcon} color={data.daily.subjectColor} size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold">{data.daily.subjectName} • {data.daily.questionCount} questions</p>
                  <p className="text-xs text-muted-foreground">
                    {data.daily.played ? `You scored ${data.daily.myScore} pts — see the daily board` : "One official entry per day. Timed!"}
                  </p>
                </div>
                {data.daily.played ? <Pill color="violet">Done ✓</Pill> : <Pill color="gold">Play</Pill>}
              </button>
            ) : (
              <EmptyState icon={CalendarCheck} title="Daily challenge warming up…" description="It appears once your class's subjects are ready." />
            )}
          </section>

          {/* ── Missions ── */}
          <section>
            <SectionTitle icon={Target} title="Today's Missions" action={unclaimed > 0 ? <Pill color="gold">{unclaimed} to claim</Pill> : undefined} />
            <div className="space-y-2.5">
              {data.missions.map((mi) => (
                <MissionRow key={mi.code} mission={mi} onClaimed={() => { refresh(); useClash.getState().fetchMe(); }} />
              ))}
            </div>
          </section>

          {/* ── Active challenges ── */}
          {data.activeChallenges.length > 0 && (
            <section>
              <SectionTitle icon={Swords} title="Your Battles" action={<button onClick={() => navigate("/duels")} className="text-xs font-semibold text-yellow-400 hover:underline">All</button>} />
              <div className="space-y-2.5">
                {data.activeChallenges.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/duel/${c.id}`)}
                    className="cc-tap flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3.5 text-left hover:border-border"
                  >
                    <Avatar avatar={c.opponentAvatar} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {c.isChampion && <Crown size={13} className="mr-1 inline text-yellow-400" aria-hidden />}
                        {c.subjectName} vs {c.opponentName}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.statusLabel}</p>
                    </div>
                    <ChevronRight size={17} className="text-muted-foreground" aria-hidden />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-7">
          {/* ── Champions of my class ── */}
          <section>
            <SectionTitle icon={Crown} title={`Crowns of ${m.gradeName ?? "your class"}`} action={<button onClick={() => navigate("/champions")} className="text-xs font-semibold text-yellow-400 hover:underline">All crowns</button>} />
            {data.champions.length === 0 ? (
              <EmptyState icon={Crown} title="No crowns for your class yet" description="Champions appear once your class subjects have them. Keep practising!" />
            ) : (
              <div className="cc-scroll max-h-96 space-y-2.5 overflow-y-auto pr-1">
                {data.champions.map((c) => (
                  <ChampionCrown
                    key={c.subjectId}
                    name={c.championName}
                    avatar={c.championAvatar}
                    subjectName={c.subjectName}
                    isMe={c.isMe}
                    defences={c.defences}
                    onOpen={() => navigate(`/champion/${c.gradeId}/${c.subjectId}`)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Continue learning ── */}
          <section>
            <SectionTitle icon={BookOpen} title="Continue Learning" action={<button onClick={() => navigate("/subjects")} className="text-xs font-semibold text-yellow-400 hover:underline">Browse</button>} />
            {data.recentSessions.length === 0 ? (
              <EmptyState icon={Play} title="No sessions yet" description="Start your first practice and it'll show up here." action={<button onClick={() => navigate("/subjects")} className="cc-tap rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-2 text-sm font-bold text-yellow-950">Start practising</button>} />
            ) : (
              <div className="space-y-2.5">
                {data.recentSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/subject/${subjectIdFromName(data, s)}`)}
                    className="cc-tap flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 text-left hover:border-border"
                  >
                    <SubjectIcon icon={s.subjectIcon} color={s.subjectColor} size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.subjectName}</p>
                      <p className="text-xs text-muted-foreground">
                        Last: {s.correctCount}/{s.totalCount} correct • {s.score} pts
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground" aria-hidden />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ── Focus areas ── */}
          {data.weakTopics.length > 0 && (
            <section>
              <SectionTitle icon={TrendingUp} title="Level Up These Topics" />
              <div className="space-y-2.5">
                {data.weakTopics.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => navigate(`/subject/${t.subjectId}`)}
                    className="cc-tap flex w-full items-center gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/8 p-3 text-left hover:border-orange-500/50"
                  >
                    <Flame size={17} className="ml-1 shrink-0 text-orange-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{t.name} <span className="font-normal text-muted-foreground">• {t.subject}</span></p>
                      <p className="text-xs text-muted-foreground">{t.accuracy}% accuracy in {t.total} recent answers</p>
                    </div>
                    <Pill color="orange">Train</Pill>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function subjectIdFromName(data: HomeData, s: HomeData["recentSessions"][number]): string {
  const champ = data.champions.find((c) => c.subjectName === s.subjectName);
  if (champ) return champ.subjectId;
  const weak = data.weakTopics.find((w) => w.subject === s.subjectName);
  return weak?.subjectId ?? "";
}

function MissionRow({ mission, onClaimed }: { mission: HomeData["missions"][number]; onClaimed: () => void }) {
  const [busy, setBusy] = useState(false);
  const claim = async () => {
    setBusy(true);
    const r = await apiSend<{ awarded: number }>("POST", "/missions/claim", {
      missionCode: mission.code,
      localDate: localDateStr(),
    });
    setBusy(false);
    if (r.ok && r.awarded > 0) {
      sfx.unlock();
      toast(`+${r.awarded} XP — ${mission.name} complete!`);
      onClaimed();
    } else if (r.ok) {
      toast("Already claimed.");
    } else {
      toast.error(r.error);
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        mission.completed ? "border-emerald-500/30 bg-emerald-500/8" : "border-border/60 bg-card/70"
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("rounded-xl p-2", mission.completed ? "bg-emerald-500/15" : "bg-secondary")}>
          <Sparkles size={16} className={mission.completed ? "text-emerald-400" : "text-muted-foreground"} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{mission.name} <span className="font-normal text-muted-foreground">+{mission.xpReward} XP</span></p>
          <p className="text-xs text-muted-foreground">{mission.description}</p>
        </div>
        {mission.claimed ? (
          <Pill color="green">Claimed</Pill>
        ) : mission.completed ? (
          <button
            onClick={claim}
            disabled={busy}
            className="cc-tap rounded-xl bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 active:scale-95"
          >
            <Gift size={13} className="mr-1 inline" aria-hidden /> Claim
          </button>
        ) : (
          <span className="text-xs font-bold text-muted-foreground">
            {mission.progress}/{mission.target}
          </span>
        )}
      </div>
      {!mission.completed && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all"
            style={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

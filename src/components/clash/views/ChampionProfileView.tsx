"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import { LoadingCard, ErrorState, Pill, ResultBadge, LevelBadge } from "@/components/clash/shared";
import { toast } from "sonner";
import { ArrowLeft, Crown, Swords, History, ShieldCheck, Clock } from "lucide-react";

type ChampionProfile = {
  champion: {
    user: {
      id: string; displayName: string; avatar: string; isBot: boolean; botSkill: number | null;
      xp: number; rating: number; level: number | null; streak: number | null;
    };
    wonAt: string;
    defences: number;
  } | null;
  grade: { id: string; name: string };
  subject: { id: string; name: string; color: string; icon: string };
  questionCount: number;
  history: { id: string; note: string; wonAt: string; former: string | null; newChampion: string }[];
  recentMatches: { id: string; challenger: string; championName: string; winnerId: string; draw: boolean; challengerWon: boolean; completedAt: string }[];
  eligibility: { iAmEligible: boolean; iAmChampion: boolean; reason: string };
};

export default function ChampionProfileView({ gradeId, subjectId }: { gradeId?: string; subjectId?: string }) {
  const me = useClash((s) => s.me);
  const [data, setData] = useState<ChampionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!gradeId || !subjectId) return navigate("/champions");
    const r = await apiGet<ChampionProfile>(`/champions/${gradeId}/${subjectId}`);
    if (r.ok) setData(r as unknown as ChampionProfile);
    else setError(r.error);
    setLoading(false);
  }, [gradeId, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const challenge = async () => {
    if (!data) return;
    setBusy(true);
    const r = await apiSend<{ challenge: { id: string } }>("POST", "/challenges", {
      type: "champion",
      subjectId: data.subject.id,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast(data.champion?.user.isBot ? "The guardian has accepted! Show no mercy." : "Challenge sent! The champion has 48h to respond.");
    navigate(`/duel/${(r as unknown as { challenge: { id: string } }).challenge.id}`);
  };

  if (loading) return <LoadingCard label="Loading champion profile…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const c = data.champion;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <button onClick={() => navigate("/champions")} className="cc-tap flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden /> Throne room
      </button>

      {/* champion card */}
      <section className="cc-champion-glow rounded-3xl border border-yellow-500/40 bg-gradient-to-b from-yellow-500/12 to-transparent p-6 text-center">
        <div className="relative mx-auto w-fit">
          <Avatar avatar={c?.user.avatar ?? "fox"} size={88} ring="#f5c518" />
          <Crown size={34} className="absolute -top-5 left-1/2 -translate-x-1/2 text-yellow-400 drop-shadow-lg" aria-hidden />
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold">{c?.user.displayName ?? "Vacant"}</h1>
        <p className="mt-1 font-display text-lg font-bold text-yellow-300">
          {data.subject.name} Champion • {data.grade.name}
        </p>
        {c?.user.isBot ? (
          <Pill color="violet" className="mt-2">🤖 Demo Guardian</Pill>
        ) : (
          <div className="mt-2 flex items-center justify-center gap-2">
            <LevelBadge level={c?.user.level ?? null} size={28} />
            <Pill>Rating {c?.user.rating}</Pill>
            {c && c.user.streak ? <Pill color="orange">🔥 {c.user.streak}</Pill> : null}
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Title since" value={c ? new Date(c.wonAt).toLocaleDateString() : "—"} />
          <Stat label="Defences" value={String(c?.defences ?? 0)} />
          <Stat label="Question pool" value={String(data.questionCount)} />
        </div>
        {c?.user.isBot && c.user.botSkill !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Guardian skill level: ~{Math.round((c.user.botSkill ?? 0.7) * 100)}% accuracy — study hard and it's beatable!
          </p>
        )}
      </section>

      {/* eligibility & challenge */}
      <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={18} className={data.eligibility.iAmEligible ? "text-emerald-400" : "text-muted-foreground"} aria-hidden />
          <p className="text-sm font-semibold">{data.eligibility.reason}</p>
        </div>
        {data.eligibility.iAmEligible && (
          <button
            onClick={challenge}
            disabled={busy}
            className="cc-tap mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 font-display font-bold text-yellow-950 shadow-lg shadow-orange-500/25 active:scale-95 disabled:opacity-50"
          >
            <Crown size={17} aria-hidden /> <span className="my-3">{busy ? "Sending challenge…" : "Challenge for the Crown"}</span>
          </button>
        )}
        <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-1.5"><Clock size={12} aria-hidden /> 8 questions • 25 seconds each • same set for both players</p>
          <p className="flex items-center gap-1.5"><Swords size={12} aria-hidden /> Champions accept within 48h or the challenge expires</p>
          <p className="flex items-center gap-1.5"><ShieldCheck size={12} aria-hidden /> Max 2 pending challengers per champion • 12h cooldown between your attempts</p>
        </div>
      </section>

      {/* title history */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <History size={18} className="text-yellow-400" aria-hidden /> Title History
        </h2>
        <div className="space-y-2">
          {data.history.map((h) => (
            <div key={h.id} className="rounded-2xl border border-border/50 bg-secondary/30 p-3.5">
              <p className="text-sm font-medium">{h.note}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {h.former ? `${h.former} → ${h.newChampion}` : `First champion: ${h.newChampion}`} • {new Date(h.wonAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* recent defences */}
      {data.recentMatches.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Recent Title Matches</h2>
          <div className="space-y-2">
            {data.recentMatches.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-3">
                <Swords size={15} className="ml-1 shrink-0 text-muted-foreground" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-sm">
                  <strong>{m.challenger}</strong> challenged <strong>{m.championName}</strong>
                </p>
                {m.draw ? <Pill color="violet">Draw</Pill> : m.challengerWon ? <Pill color="gold">Crown changed</Pill> : <Pill color="green">Defended</Pill>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/50 p-3">
      <p className="font-display text-base font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

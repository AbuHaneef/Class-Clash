"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiGet, apiSend, localDateStr } from "@/lib/clash/client/api";
import { LoadingCard, ErrorState, Pill } from "@/components/clash/shared";
import { sfx } from "@/lib/clash/client/sound";
import { useClash } from "@/lib/clash/client/store";
import { toast } from "sonner";
import { Medal, Gift, Target, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Data = {
  badges: { code: string; name: string; description: string; icon: string; color: string; earned: boolean; earnedAt: string | null }[];
  missions: { code: string; name: string; description: string; icon: string; target: number; xpReward: number; progress: number; completed: boolean; claimed: boolean }[];
};

export default function AchievementsView() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiGet<Data>("/achievements");
    if (r.ok) setData(r as unknown as Data);
    else setError(r.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (code: string) => {
    const r = await apiSend<{ awarded: number }>("POST", "/missions/claim", {
      missionCode: code,
      localDate: localDateStr(),
    });
    if (r.ok && (r as unknown as { awarded: number }).awarded > 0) {
      sfx.unlock();
      toast(`+${(r as unknown as { awarded: number }).awarded} XP claimed!`);
      load();
      useClash.getState().fetchMe();
    } else if (r.ok) toast("Already claimed.");
    else toast.error(r.error);
  };

  if (loading) return <LoadingCard label="Opening the trophy cabinet…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const earned = data.badges.filter((b) => b.earned);
  const locked = data.badges.filter((b) => !b.earned);

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Achievements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {earned.length}/{data.badges.length} badges earned. Badges are awarded by verified server events — no shortcuts.
        </p>
      </div>

      {/* earned */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Medal size={18} className="text-yellow-400" aria-hidden /> Badge Cabinet
        </h2>
        {earned.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 p-5 text-center text-sm text-muted-foreground">
            Your cabinet awaits its first badge — finish any quiz to earn <strong>First Steps</strong>!
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {earned.map((b) => (
              <div
                key={b.code}
                className="cc-card-glow rounded-2xl border p-4 text-center"
                style={{ borderColor: b.color + "55", background: `linear-gradient(160deg, ${b.color}14, transparent)` }}
              >
                <span
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
                  style={{ background: b.color + "26", color: b.color }}
                  aria-hidden
                >
                  🏅
                </span>
                <p className="mt-2 font-display text-sm font-bold">{b.name}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{b.description}</p>
                {b.earnedAt && (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {new Date(b.earnedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* locked */}
      {locked.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-muted-foreground">Still to unlock</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {locked.map((b) => (
              <div key={b.code} className="rounded-2xl border border-border/50 bg-secondary/30 p-4 text-center opacity-70">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-xl grayscale" aria-hidden>
                  🔒
                </span>
                <p className="mt-2 font-display text-sm font-bold">{b.name}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* missions */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Target size={18} className="text-yellow-400" aria-hidden /> Today's Missions
        </h2>
        <div className="space-y-2.5">
          {data.missions.map((m) => (
            <div
              key={m.code}
              className={cn(
                "rounded-2xl border p-4",
                m.claimed ? "border-border/50 bg-secondary/30 opacity-70"
                : m.completed ? "border-emerald-500/30 bg-emerald-500/8"
                : "border-border/60 bg-card/70"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {m.name} <span className="font-normal text-muted-foreground">+{m.xpReward} XP</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
                {m.claimed ? (
                  <Pill color="green"><Check size={12} aria-hidden /> Claimed</Pill>
                ) : m.completed ? (
                  <button
                    onClick={() => claim(m.code)}
                    className="cc-tap flex items-center gap-1 rounded-xl bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-300 active:scale-95"
                  >
                    <Gift size={13} aria-hidden /> Claim +{m.xpReward} XP
                  </button>
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">{m.progress}/{m.target}</span>
                )}
              </div>
              {!m.completed && (
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500"
                    style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Missions reset every day at midnight (your local time) — streaks count on your calendar day.</p>
      </section>
    </div>
  );
}

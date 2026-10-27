"use client";

import React, { useEffect, useMemo, useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet } from "@/lib/clash/client/api";
import { Avatar } from "@/lib/clash/avatars";
import { SubjectIcon, LoadingCard, EmptyState, Pill } from "@/components/clash/shared";
import { Crown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type ChampionRow = {
  gradeId: string;
  subjectId: string;
  gradeName: string;
  subject: { id: string; name: string; color: string; icon: string };
  champion: { id: string; displayName: string; avatar: string; isBot: boolean };
  wonAt: string;
  defences: number;
};

export default function ChampionsView() {
  const [champions, setChampions] = useState<ChampionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ champions: ChampionRow[] }>("/champions").then((r) => {
      if (r.ok) setChampions((r as unknown as { champions: ChampionRow[] }).champions);
      setLoading(false);
    });
  }, []);

  const grades = useMemo(() => [...new Set(champions.map((c) => c.gradeName))], [champions]);

  if (loading) return <LoadingCard label="Loading the throne room…" />;

  return (
    <div className="space-y-7">
      <div className="cc-hero-bg rounded-3xl border border-yellow-500/25 p-6 text-center">
        <Crown size={34} className="mx-auto text-yellow-400" aria-hidden />
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">The Throne Room</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Every class × subject has exactly one champion. Beat them in a Champion Challenge
          to take their crown — titles only move through verified matches, never XP.
        </p>
      </div>

      {grades.map((gradeName) => (
        <section key={gradeName}>
          <h2 className="mb-3 font-display text-lg font-bold">{gradeName}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {champions
              .filter((c) => c.gradeName === gradeName)
              .map((c) => (
                <button
                  key={`${c.gradeId}-${c.subjectId}`}
                  onClick={() => navigate(`/champion/${c.gradeId}/${c.subjectId}`)}
                  className={cn(
                    "group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5",
                    "border-yellow-500/25 bg-gradient-to-b from-yellow-500/8 to-transparent hover:border-yellow-500/60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <SubjectIcon icon={c.subject.icon} color={c.subject.color} size={20} />
                    {c.defences > 0 && (
                      <Pill color="violet"><Shield size={12} aria-hidden /> {c.defences} defences</Pill>
                    )}
                  </div>
                  <p className="mt-3 font-display font-bold">{c.subject.name}</p>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <div className="relative">
                      <Avatar avatar={c.champion.avatar} size={38} ring="#f5c518" />
                      <Crown size={15} className="absolute -top-2 left-1/2 -translate-x-1/2 text-yellow-400" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{c.champion.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.champion.isBot ? "Guardian bot — beat it to claim" : `Champion since ${new Date(c.wonAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </section>
      ))}

      {champions.length === 0 && (
        <EmptyState icon={Crown} title="No champions yet" description="Champions appear as soon as the first title match is won." />
      )}

      <p className="rounded-2xl border border-border/50 bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
        🤖 <strong className="text-foreground/80">About Guardian bots:</strong> seeded practice champions hold the first titles so every
        title is winnable from day one. Their attempts are generated the moment a challenge is created — before you play — and
        their skill level is fixed. Beat one and the crown is officially yours. Ratings are not affected by bot matches
        (only real duels move your rating), but season points and titles are real.
      </p>
    </div>
  );
}

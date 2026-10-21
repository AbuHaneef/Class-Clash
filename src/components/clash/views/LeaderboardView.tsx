"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import { LoadingCard, EmptyState, Pill } from "@/components/clash/shared";
import { Trophy, Zap, Star, BarChart3, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Entry = {
  id: string; displayName: string; avatar: string; value: number;
  sub: string; level: number; gradeName: string | null;
};

const TABS = [
  { key: "rating", label: "Competitive Rating", icon: BarChart3, desc: "Elo-style rating from verified duels & champion matches (real players only)" },
  { key: "season", label: "Season Points", icon: Star, desc: "Points from arena runs, duels and title matches this season" },
  { key: "xp", label: "XP & Level", icon: Zap, desc: "Total learning activity — practice, missions, badges" },
];

export default function LeaderboardView() {
  const me = useClash((s) => s.me);
  const [tab, setTab] = useState("rating");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiGet<{ entries: Entry[]; myRank: number | null }>(`/leaderboard?type=${tab}`);
    if (r.ok) {
      setEntries((r as unknown as { entries: Entry[] }).entries);
      setMyRank((r as unknown as { myRank: number | null }).myRank);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Leaderboards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Three separate measurements — never merged into one mystery score.
        </p>
      </div>

      <div className="cc-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "cc-tap flex shrink-0 items-center gap-1.5 rounded-2xl border-2 px-4 py-2 text-sm font-bold transition-all",
              tab === t.key ? "border-yellow-400 bg-yellow-500/10 text-yellow-300" : "border-border/60 bg-card/60 text-muted-foreground"
            )}
          >
            <t.icon size={15} aria-hidden /> {t.label.split(" ")[0]}
          </button>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-border/50 bg-secondary/30 p-3.5 text-xs leading-relaxed text-muted-foreground">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden /> {activeTab.desc}
      </p>

      {myRank && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/8 p-3 text-sm font-bold">
          <Trophy size={15} className="text-yellow-400" aria-hidden />
          You're ranked #{myRank} {myRank <= 3 ? "— podium! 🎉" : "— keep climbing!"}
        </div>
      )}

      {loading ? (
        <LoadingCard label="Ranking the contenders…" />
      ) : entries.length === 0 ? (
        <EmptyState icon={Trophy} title="Nobody has qualified yet" description="Play ranked modes to appear here. Honest boards start empty!" action={<button onClick={() => navigate("/arena")} className="cc-tap rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-2 text-sm font-bold text-yellow-950">Enter the Arena</button>} />
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => {
            const rank = i + 1;
            const isMe = e.id === me?.id;
            return (
              <button
                key={e.id}
                onClick={() => navigate(`/profile/${e.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:border-border",
                  isMe ? "border-yellow-500/50 bg-yellow-500/8" : "border-border/60 bg-card/70",
                  rank <= 3 && !isMe && "border-yellow-500/25 bg-gradient-to-r from-yellow-500/6 to-transparent"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
                    rank === 1 ? "cc-podium-1 text-yellow-950" : rank === 2 ? "cc-podium-2 text-white" : rank === 3 ? "cc-podium-3 text-white" : "bg-secondary text-muted-foreground"
                  )}
                  aria-label={`Rank ${rank}`}
                >
                  {rank}
                </span>
                <Avatar avatar={e.avatar} size={38} ring={rank === 1 ? "#f5c518" : undefined} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {e.displayName} {isMe && <span className="text-yellow-400">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Lv {e.level} • {e.gradeName} • {e.sub}</p>
                </div>
                <span className="font-display text-lg font-bold">{e.value}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        <Pill className="mx-auto">Subject leaderboards</Pill>{" "}
        Live inside each subject page — open a subject and check its champion & mastery board.
      </p>
    </div>
  );
}

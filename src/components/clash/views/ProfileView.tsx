"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import { LoadingCard, ErrorState, Pill, ResultBadge, LevelBadge, XPBar } from "@/components/clash/shared";
import { toast } from "sonner";
import {
  Settings, Crown, Flag, Swords, Calendar, Flame, Target, Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Profile = {
  profile: {
    id: string; displayName: string; avatar: string; isBot: boolean; isMe: boolean;
    gradeName: string | null; level: number | null; levelTitle: string; xp: number | null;
    rating: number | null; streak: number | null; joined: string;
    titles: { gradeId: string; subjectId: string; subjectName: string; gradeName: string; wonAt: string; defences: number }[];
    badges: { code: string; name: string; icon: string; color: string; earnedAt: string }[];
    record: { wins: number; losses: number; draws: number; quizzesCompleted: number; answered: number; accuracy: number };
    recentMatches: { id: string; type: string; result: string; score: number; opponentScore: number; opponentName: string; opponentAvatar: string; createdAt: string }[];
  };
};

export default function ProfileView({ userId }: { userId?: string }) {
  const me = useClash((s) => s.me);
  const [data, setData] = useState<Profile["profile"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    const id = userId ?? me?.id;
    if (!id) return;
    const r = await apiGet<Profile>(`/profile/${id}`);
    if (r.ok) setData((r as unknown as Profile).profile);
    else setError(r.error);
    setLoading(false);
  }, [userId, me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const shareProfile = async () => {
    if (!data) return;
    const r = await apiSend<{ token: string }>("POST", "/share", { type: "champion" });
    if (!r.ok) return toast.error(r.error);
    const url = `${window.location.origin}${window.location.pathname}#/share/${(r as unknown as { token: string }).token}`;
    if (navigator.share) navigator.share({ title: "ClassClash", url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast("Profile card link copied!"));
  };

  if (loading) return <LoadingCard label="Loading profile…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const p = data;
  const winRate = p.record.wins + p.record.losses > 0
    ? Math.round((p.record.wins / (p.record.wins + p.record.losses)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* header */}
      <section className="cc-hero-bg rounded-3xl border border-border/60 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Avatar avatar={p.avatar} size={72} ring="#f5c51888" />
            {p.titles.length > 0 && (
              <Crown size={26} className="absolute -top-3 left-1/2 -translate-x-1/2 text-yellow-400" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
              {p.displayName} <LevelBadge level={p.level} size={30} />
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {p.levelTitle} • {p.gradeName ?? "No class"} • Joined {new Date(p.joined).toLocaleDateString()}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.rating !== null && <Pill>Rating {p.rating}</Pill>}
              {p.streak ? <Pill color="orange"><Flame size={12} aria-hidden /> {p.streak}</Pill> : null}
              <Pill color="gold">{p.record.accuracy}% accuracy</Pill>
            </div>
          </div>
        </div>
        {p.xp !== null && me && (
          <div className="mt-4">
            <XPBar pct={Math.min(100, Math.round((p.xp % 100) / 1))} level={p.level ?? 1} compact />
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {p.isMe ? (
            <>
              <button onClick={() => navigate("/settings")} className="cc-tap flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/70">
                <Settings size={15} aria-hidden /> Edit profile
              </button>
              <button onClick={shareProfile} className="cc-tap flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/70">
                <Share2 size={15} aria-hidden /> Share card
              </button>
            </>
          ) : (
            <>
              {me && !p.isBot && (
                <button
                  onClick={async () => {
                    const r = await apiSend<{ challenge: { id: string } }>("POST", "/challenges", {
                      type: "duel",
                      subjectId: "PENDING",
                      opponentId: p.id,
                    });
                    if (!r.ok) return toast.error(r.error);
                    navigate(`/duel/${(r as unknown as { challenge: { id: string } }).challenge.id}`);
                  }}
                  className="hidden"
                />
              )}
              <button
                onClick={() => navigate("/duels")}
                className="cc-tap flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white"
              >
                <Swords size={15} aria-hidden /> Challenge
              </button>
              <button
                onClick={async () => {
                  if (!me) return;
                  const r = await apiSend("POST", "/rivals", { rivalId: p.id, action: "add" });
                  if (r.ok) toast(`${p.displayName} added to your rivals!`);
                }}
                className="cc-tap flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-sm font-bold hover:bg-secondary/70"
              >
                <Target size={15} aria-hidden /> Track rival
              </button>
              <button
                onClick={() => setReportOpen(!reportOpen)}
                className="cc-tap flex items-center gap-1.5 rounded-xl bg-secondary/60 px-4 py-2 text-sm font-bold text-muted-foreground"
              >
                <Flag size={15} aria-hidden /> Report
              </button>
            </>
          )}
        </div>
        {reportOpen && (
          <form
            className="mt-3 space-y-2 rounded-2xl border border-border/60 bg-secondary/40 p-3.5"
            onSubmit={async (e) => {
              e.preventDefault();
              const reason = (e.currentTarget.elements.namedItem("reason") as HTMLInputElement).value;
              const r = await apiSend("POST", "/report", { targetType: "user", targetId: p.id, reason });
              if (r.ok) {
                toast("Report sent to moderators. Thank you!");
                setReportOpen(false);
              }
            }}
          >
            <input
              name="reason"
              required
              minLength={3}
              maxLength={120}
              placeholder="What's wrong? (e.g. offensive name, suspicious behaviour)"
              className="cc-tap w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm outline-none"
            />
            <button className="cc-tap w-full rounded-xl bg-red-500/80 py-2 text-sm font-bold text-white">
              Send report
            </button>
          </form>
        )}
      </section>

      {/* titles */}
      {p.titles.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Crown size={18} className="text-yellow-400" aria-hidden /> Championship Titles ({p.titles.length})
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {p.titles.map((t) => (
              <button
                key={`${t.gradeId}-${t.subjectId}`}
                onClick={() => navigate(`/champion/${t.gradeId}/${t.subjectId}`)}
                className="cc-tap rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent p-3.5 text-left hover:border-yellow-500/60"
              >
                <p className="font-display font-bold">{t.subjectName} • {t.gradeName}</p>
                <p className="text-xs text-muted-foreground">
                  Won {new Date(t.wonAt).toLocaleDateString()} • {t.defences} successful defences
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* record stats */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Duels won" value={p.record.wins} sub={`${winRate}% win rate`} />
        <StatCard label="Duels lost" value={p.record.losses} sub="every loss is a lesson" />
        <StatCard label="Quizzes done" value={p.record.quizzesCompleted} sub={`${p.record.answered} questions answered`} />
        <StatCard label="Badges" value={p.badges.length} sub="see achievements" />
      </section>

      {/* badges */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Badge Cabinet</h2>
        {p.badges.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
            No badges yet — complete your first quiz to earn First Steps!
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {p.badges.map((b) => (
              <span
                key={b.code}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{ background: b.color + "1f", color: b.color }}
                title={b.name}
              >
                🏅 {b.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* match history */}
      {p.recentMatches.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Calendar size={17} className="text-yellow-400" aria-hidden /> Recent Battles
          </h2>
          <div className="space-y-2">
            {p.recentMatches.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-3">
                <Avatar avatar={m.opponentAvatar} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {m.type === "champion" ? "👑 " : "⚔️ "}vs {m.opponentName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.score} – {m.opponentScore} • {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <ResultBadge result={m.result} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 text-center">
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

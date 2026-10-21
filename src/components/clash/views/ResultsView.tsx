"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate, absoluteUrl } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Confetti, LoadingCard, ErrorState, Pill } from "@/components/clash/shared";
import { sfx } from "@/lib/clash/client/sound";
import { toast } from "sonner";
import { Check, X, Trophy, Crown, Share2, Link2, Zap, Flame, ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type CompleteResult = {
  sessionId: string;
  mode: string;
  score: number;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  xpEarned: number;
  levelUp: boolean;
  newLevel: number;
  newBadges: { code: string; name: string; icon: string; color: string }[];
  missionsCompleted: { code: string; name: string; xpReward: number }[];
  isPersonalBest: boolean;
  previousBest: number | null;
  streak: { count: number; isNew: boolean; isNewRecord: boolean };
  totalTimeMs: number;
  review: {
    id: string; text: string; difficulty: string; explanation: string;
    options: string[]; correctIndex: number; chosenIndex: number; topicName: string;
  }[];
  challenge?: {
    challengeId: string; status: string; winnerId: string | null; draw: boolean;
    titleChanged: boolean; summary: string;
  } | null;
};

export default function ResultsView({ sessionId }: { sessionId?: string }) {
  const me = useClash((s) => s.me);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return navigate("/");
    // The complete endpoint is idempotent — safe for refresh
    const r = await apiSend<{ result: CompleteResult }>("POST", `/quiz/${sessionId}/complete`, {});
    if (r.ok) {
      const res = (r as unknown as { result: CompleteResult }).result;
      setResult(res);
      const wonChallenge = res.challenge && res.challenge.winnerId === me?.id;
      if (res.accuracy >= 60 || wonChallenge || res.titleChanged) {
        setConfettiKey(Date.now());
        sfx.win();
      }
      useClash.getState().fetchMe();
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [sessionId, me?.id]);

  useEffect(() => {
    load();
     
  }, []);

  const share = async (type: string, refId?: string) => {
    const r = await apiSend<{ token: string }>("POST", "/share", { type, refId });
    if (!r.ok) return toast.error(r.error);
    const token = (r as unknown as { token: string }).token;
    setShareToken(token);
    const url = absoluteUrl(`/share/${token}`);
    if (navigator.share) {
      navigator.share({ title: "ClassClash", text: "Check out my ClassClash result!", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => toast("Share link copied!")).catch(() => toast(url));
    }
  };

  if (loading) return <LoadingCard label="Scoring your session…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!result) return null;

  const iWonChallenge = result.challenge && me && result.challenge.winnerId === me.id;
  const challengeOutcome = result.challenge
    ? result.challenge.draw ? "draw" : iWonChallenge ? "win" : "loss"
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Confetti burstKey={confettiKey} />

      {/* headline card */}
      <section className="cc-hero-bg rounded-3xl border border-border/60 p-6 text-center sm:p-8">
        {challengeOutcome && (
          <Pill color={challengeOutcome === "win" ? "gold" : challengeOutcome === "draw" ? "violet" : "red"} className="mx-auto mb-3">
            {result.challenge?.titleChanged ? <Crown size={13} aria-hidden /> : <Trophy size={13} aria-hidden />}
            {result.challenge?.titleChanged && challengeOutcome === "win"
              ? "NEW CHAMPION CROWNED!"
              : challengeOutcome === "win" ? "CHALLENGE WON!"
              : challengeOutcome === "draw" ? "IT'S A DRAW"
              : "CHALLENGE LOST"}
          </Pill>
        )}
        <p className="font-display text-6xl font-bold cc-gradient-text sm:text-7xl">
          {result.correctCount}/{result.totalCount}
        </p>
        <p className="mt-1 font-display text-xl font-bold">{result.score} points</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.accuracy}% accuracy • {result.isPersonalBest ? "🏆 New personal best!" : `Best: ${result.previousBest ?? result.score} pts`}
        </p>

        {result.challenge && (
          <p className="mt-3 rounded-xl bg-secondary/60 px-4 py-2 text-sm font-semibold">
            {result.challenge.summary}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {result.xpEarned > 0 && <Pill color="gold"><Zap size={13} aria-hidden /> +{result.xpEarned} XP</Pill>}
          {result.streak.isNew && result.streak.count > 0 && (
            <Pill color="orange"><Flame size={13} aria-hidden /> {result.streak.count}-day streak</Pill>
          )}
          {result.newBadges.map((b) => (
            <Pill key={b.code} color="violet">🏅 {b.name}</Pill>
          ))}
        </div>

        {result.levelUp && (
          <p className="cc-pop mt-4 font-display text-lg font-bold text-yellow-300">
            ⬆️ Level {result.newLevel} reached!
          </p>
        )}

        <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
          <button
            onClick={() => share(result.challenge?.titleChanged ? "champion" : "result", sessionId)}
            className="cc-tap flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-5 font-display font-bold text-yellow-950 active:scale-95"
          >
            <Share2 size={16} aria-hidden /> <span className="my-2.5">Share result</span>
          </button>
          {shareToken && (
            <button
              onClick={() => navigate(`/share/${shareToken}`)}
              className="cc-tap flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-5 font-semibold hover:bg-secondary"
            >
              <Link2 size={16} aria-hidden /> <span className="my-2.5">View share card</span>
            </button>
          )}
          {result.challenge && (
            <button
              onClick={() => navigate(`/duel/${result.challenge!.challengeId}`)}
              className="cc-tap flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-5 font-semibold hover:bg-secondary"
            >
              <RotateCcw size={16} aria-hidden /> <span className="my-2.5">Match details</span>
            </button>
          )}
        </div>
      </section>

      {/* review */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">Review & Learn</h2>
        <div className="space-y-3">
          {result.review.map((r, i) => {
            const correct = r.chosenIndex === r.correctIndex;
            return (
              <details key={r.id} className="group rounded-2xl border border-border/60 bg-card/70 p-4" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      correct ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    )}
                    aria-hidden
                  >
                    {correct ? <Check size={15} /> : <X size={15} />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    <span className="text-muted-foreground">Q{i + 1}.</span> {r.text}
                  </span>
                  <span className="text-xs text-muted-foreground group-open:hidden">explain ▾</span>
                </summary>
                <div className="mt-3 space-y-1.5 border-l-2 border-border/60 pl-4">
                  {r.options.map((o, oi) => (
                    <p
                      key={oi}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm",
                        oi === r.correctIndex && "bg-emerald-500/12 font-bold text-emerald-300",
                        oi === r.chosenIndex && oi !== r.correctIndex && "bg-red-500/12 text-red-300 line-through"
                      )}
                    >
                      {oi === r.correctIndex && "✓ "}
                      {o}
                      {oi === r.chosenIndex && oi !== r.correctIndex && " (your answer)"}
                    </p>
                  ))}
                  <p className="mt-2 rounded-xl bg-secondary/50 p-3 text-sm leading-relaxed text-foreground/85">
                    <strong className="text-yellow-300">Why:</strong> {r.explanation}
                  </p>
                  <p className="text-xs text-muted-foreground">Topic: {r.topicName} • {r.difficulty}</p>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          onClick={() => navigate("/subjects")}
          className="cc-tap flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 font-display font-bold text-yellow-950 active:scale-95"
        >
          <span className="my-3">Play another subject</span> <ArrowRight size={16} aria-hidden />
        </button>
        <button onClick={() => navigate("/")} className="cc-tap flex-1 rounded-2xl border border-border bg-secondary/50 font-semibold hover:bg-secondary">
          <span className="my-3 inline-block">Home</span>
        </button>
      </div>
    </div>
  );
}

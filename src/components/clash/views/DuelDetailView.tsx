"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import { LoadingCard, ErrorState, Pill, ResultBadge } from "@/components/clash/shared";
import { toast } from "sonner";
import { ArrowLeft, Play, Crown, Swords, Check, X, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

type ChallengeDetail = {
  challenge: {
    id: string; code: string; type: string; status: string;
    subject: { id: string; name: string; color: string; icon: string };
    gradeName: string;
    creator: { id: string; displayName: string; avatar: string; isBot: boolean };
    opponent: { id: string; displayName: string; avatar: string; isBot: boolean } | null;
    openInvite: boolean;
    iAmCreator: boolean;
    expiresAt: string; createdAt: string;
    winnerId: string | null; draw: boolean;
    mySessionId: string | null;
    theirSessionDone: boolean;
    creatorResult: {
      score: number; correctCount: number; totalCount: number; totalTimeMs: number;
      detail: { questionId: string; chosen: number; correct: boolean; correctIndex: number; text: string }[];
    } | null;
    opponentResult: {
      score: number; correctCount: number; totalCount: number; totalTimeMs: number;
      detail: { questionId: string; chosen: number; correct: boolean; correctIndex: number; text: string }[];
    } | null;
    questionCount: number;
  };
};

export default function DuelDetailView({ challengeId }: { challengeId?: string }) {
  const me = useClash((s) => s.me);
  const [data, setData] = useState<ChallengeDetail["challenge"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!challengeId) return navigate("/duels");
    const r = await apiGet<ChallengeDetail>(`/challenges/${challengeId}`);
    if (r.ok) setData((r as unknown as ChallengeDetail).challenge);
    else setError(r.error);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    load();
  }, [load]);

  const play = async () => {
    setBusy(true);
    const r = await apiSend<{ sessionId: string }>("POST", "/quiz/start", {
      mode: data?.type === "champion" ? "champion" : "duel",
      challengeId,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    navigate(`/quiz/${(r as unknown as { sessionId: string }).sessionId}`);
  };

  const act = async (action: "accept" | "decline" | "cancel") => {
    const r = await apiSend("POST", `/challenges/${challengeId}/action`, { action });
    if (!r.ok) return toast.error(r.error);
    toast(action === "accept" ? "Accepted — let's clash!" : "Done.");
    load();
  };

  if (loading) return <LoadingCard label="Loading match…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const c = data;
  const isChampionMatch = c.type === "champion";
  const meIsCreator = c.iAmCreator;
  const myRole = meIsCreator ? "creator" : "opponent";
  const myResult = meIsCreator ? c.creatorResult : c.opponentResult;
  const theirResult = meIsCreator ? c.opponentResult : c.creatorResult;
  const myPending = ["pending", "accepted", "in_progress"].includes(c.status) && !myResult;
  const iWon = c.winnerId === me?.id;
  const canPlay = (c.status === "accepted" || c.status === "in_progress") && !myResult;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <button onClick={() => navigate("/duels")} className="cc-tap flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} aria-hidden /> All challenges
      </button>

      {/* versus header */}
      <section className={cn("rounded-3xl border p-6 text-center", isChampionMatch ? "border-yellow-500/35 bg-gradient-to-b from-yellow-500/10 to-transparent" : "border-border/60 bg-card/70")}>
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          <PlayerCard
            name={c.creator.displayName}
            avatar={c.creator.avatar}
            isBot={c.creator.isBot}
            score={c.creatorResult?.score}
            you={meIsCreator}
          />
          <div className="text-center">
            <span className="font-display text-2xl font-bold text-muted-foreground">VS</span>
            {isChampionMatch && (
              <p className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-yellow-400">
                <Crown size={13} aria-hidden /> TITLE MATCH
              </p>
            )}
          </div>
          <PlayerCard
            name={c.opponent?.displayName ?? "Open invite"}
            avatar={c.opponent?.avatar ?? "fox"}
            isBot={c.opponent?.isBot}
            score={c.opponentResult?.score}
            you={!meIsCreator}
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {c.subject.name} • {c.gradeName} • {c.questionCount} questions
          {c.opponent?.isBot && " • Demo Guardian (fixed attempt, generated before you played)"}
        </p>

        {/* status / actions */}
        {c.status === "completed" && (
          <div className="mt-4">
            <div className="mx-auto flex w-fit items-center gap-2">
              {c.draw ? (
                <Pill color="violet">DRAW — champion retains the crown</Pill>
              ) : iWon ? (
                <Pill color="gold">🏆 YOU WON!</Pill>
              ) : (
                <ResultBadge result="loss" />
              )}
            </div>
          </div>
        )}

        {c.status === "pending" && !meIsCreator && (
          <div className="mt-5 flex justify-center gap-2.5">
            <button onClick={() => act("accept")} className="cc-tap rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-6 font-display font-bold text-yellow-950 active:scale-95">
              <span className="my-3 inline-block">Accept challenge</span>
            </button>
            <button onClick={() => act("decline")} className="cc-tap rounded-2xl bg-secondary px-5 font-semibold">Decline</button>
          </div>
        )}
        {c.status === "pending" && meIsCreator && (
          <p className="mt-4 text-sm text-muted-foreground">Waiting for your opponent to accept…</p>
        )}
        {canPlay && (
          <button
            onClick={play}
            disabled={busy}
            className="cc-tap mt-5 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-8 font-display font-bold text-yellow-950 shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50"
          >
            <span className="my-3 inline-block">{busy ? "Preparing…" : myPending ? "Play your round" : "View result"}</span>
          </button>
        )}
        {["accepted", "in_progress"].includes(c.status) && myResult && !theirResult && (
          <p className="mt-4 text-sm text-muted-foreground">
            <Timer size={13} className="mr-1 inline" aria-hidden />
            You're done — waiting for your opponent to finish their round.
          </p>
        )}
      </section>

      {/* question-by-question comparison (when both done) */}
      {myResult && theirResult && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Round-by-round</h2>
          <div className="space-y-2">
            {myResult.detail.map((d, i) => {
              const their = theirResult.detail[i];
              return (
                <div key={d.questionId} className="rounded-2xl border border-border/60 bg-card/70 p-3.5">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground">Q{i + 1}.</span> {d.text}
                  </p>
                  <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                    <CompareRow label="You" correct={d.correct} />
                    <CompareRow label={c.opponent && meIsCreator ? c.opponent.displayName : c.creator.displayName} correct={their?.correct ?? false} isBot={c.opponent?.isBot} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Correct answer keys are revealed once both players complete the match.
          </p>
        </section>
      )}

      {/* rematch */}
      {c.status === "completed" && !c.opponent?.isBot && (
        <button
          onClick={async () => {
            const r = await apiSend<{ challenge: { id: string } }>("POST", "/challenges", {
              type: "duel",
              subjectId: c.subject.id,
              opponentId: meIsCreator ? c.opponent!.id : c.creator.id,
            });
            if (!r.ok) return toast.error(r.error);
            toast("Rematch sent!");
            navigate(`/duel/${(r as unknown as { challenge: { id: string } }).challenge.id}`);
          }}
          className="cc-tap flex w-full items-center justify-center gap-2 rounded-2xl border border-pink-500/40 bg-pink-500/10 py-3 font-display font-bold text-pink-300 active:scale-95"
        >
          <Swords size={17} aria-hidden /> Request rematch
        </button>
      )}
    </div>
  );
}

function PlayerCard({
  name, avatar, isBot, score, you,
}: {
  name: string; avatar: string; isBot?: boolean; score?: number | null; you?: boolean;
}) {
  return (
    <div className="min-w-0 text-center">
      <Avatar avatar={avatar} size={56} ring={you ? "#f5c518" : undefined} className="mx-auto" />
      <p className="mt-2 max-w-24 truncate text-sm font-bold sm:max-w-32">{name}</p>
      {isBot && <Pill className="mt-1">Demo Guardian</Pill>}
      {score !== undefined && score !== null && (
        <p className="mt-1 font-display text-2xl font-bold">{score}</p>
      )}
      {you && <p className="text-xs text-yellow-400">you</p>}
    </div>
  );
}

function CompareRow({ label, correct, isBot }: { label: string; correct: boolean; isBot?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
        correct ? "bg-emerald-500/12 text-emerald-300" : "bg-red-500/10 text-red-300"
      )}
    >
      {correct ? <Check size={13} aria-hidden /> : <X size={13} aria-hidden />}
      <span className="truncate">{label}{isBot ? " 🤖" : ""}</span>
      <span className="ml-auto">{correct ? "correct" : "missed"}</span>
    </div>
  );
}

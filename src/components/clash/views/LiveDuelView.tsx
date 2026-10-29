"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { navigate, absoluteUrl } from "@/lib/clash/client/router";
import { apiGet } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { getLiveSocket, isLiveAuthed, setLiveAuthed } from "@/lib/clash/client/live";
import { Avatar } from "@/lib/clash/avatars";
import { LoadingCard, EmptyState, Pill, TimerRing, Confetti } from "@/components/clash/shared";
import { QuestionImage } from "@/components/clash/QuestionImage";
import { sfx } from "@/lib/clash/client/sound";
import { toast } from "sonner";
import {
  Swords, Radio, Bot, Users, Link2, ArrowLeft, Zap, Timer, Trophy,
  UserX, Wifi, WifiOff, RefreshCw, ChevronRight, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── types ────────────────────────────────────────────────────

type Subject = { id: string; name: string; icon: string; color: string };

type MatchPlayer = {
  userId: string;
  displayName: string;
  avatar: string;
  rating: number;
  isBot: boolean;
  score?: number;
  correctCount?: number;
};

type MatchMeta = {
  roomId: string;
  challengeId: string;
  subjectId: string;
  subjectName: string;
  gradeName: string;
  questionCount: number;
  timePerQuestionSec: number;
  vsBot: boolean;
  you: MatchPlayer;
  opponent: MatchPlayer;
};

type LiveQuestion = {
  id: string;
  text: string;
  type: string;
  difficulty: string;
  points: number;
  timeLimit: number;
  imageUrl: string | null;
  options: { id: string; text: string }[];
  subjectName: string;
  topicName: string;
};

type RoundResult = {
  index: number;
  correctOptionId: string | null;
  you: { chosenOptionId: string | null; correct: boolean; points: number; ms: number };
  opponent: { chosenOptionId: string | null; correct: boolean; points: number; ms: number };
  scoreYou: number;
  scoreOpp: number;
};

type OverPayload = {
  result: {
    challengeId: string;
    winnerId: string | null;
    draw: boolean;
    summary: string;
  } | null;
  forfeitLost: boolean;
  you: {
    userId: string;
    score: number;
    correctCount: number;
    totalCount: number;
    ratingBefore: number | null;
    ratingAfter: number | null;
    ratingDelta: number | null;
    xpEarned: number;
  } | null;
  summary: string;
};

type Phase =
  | "connecting"
  | "lobby"
  | "queueing"
  | "room"
  | "starting"
  | "countdown"
  | "question"
  | "reveal"
  | "over";

// ── view ─────────────────────────────────────────────────────

export default function LiveDuelView() {
  const me = useClash((s) => s.me);
  const setLiveMatchActive = useClash((s) => s.setLiveMatchActive);
  const soundOn = useClash((s) => s.soundOn);

  const [phase, setPhase] = useState<Phase>("connecting");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [meta, setMeta] = useState<MatchMeta | null>(null);
  const [question, setQuestion] = useState<{ q: LiveQuestion; index: number; total: number; durationSec: number } | null>(null);
  const [answered, setAnswered] = useState<string | null>(null);
  const [oppAnswered, setOppAnswered] = useState(false);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [scores, setScores] = useState<{ you: number; opp: number }>({ you: 0, opp: 0 });
  const [over, setOver] = useState<OverPayload | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [queueSecs, setQueueSecs] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [oppLeft, setOppLeft] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [authOk, setAuthOk] = useState(false);
  const [burst, setBurst] = useState(0);

  const phaseRef = useRef<Phase>("connecting");
  const startedRef = useRef(false); // match actually started (for leave-on-unmount)

  useEffect(() => {
    phaseRef.current = phase;
    const inMatch = ["starting", "countdown", "question", "reveal"].includes(phase);
    setLiveMatchActive(inMatch);
    startedRef.current = inMatch;
  }, [phase, setLiveMatchActive]);

  useEffect(() => {
    sfx.enabled = soundOn;
  }, [soundOn]);

  // load my subjects
  useEffect(() => {
    if (!me) return;
    (async () => {
      const r = await apiGet<{
        structure: { subjects: Subject[]; subjectGrades: { subjectId: string; gradeId: string }[] };
      }>("/structure");
      if (r.ok) {
        const s = (r as unknown as {
          structure: { subjects: Subject[]; subjectGrades: { subjectId: string; gradeId: string }[] };
        }).structure;
        const myIds = new Set(s.subjectGrades.filter((sg) => sg.gradeId === me.gradeId).map((sg) => sg.subjectId));
        setSubjects(s.subjects.filter((x) => myIds.has(x.id)));
      }
    })();
  }, [me]);

  const resetMatchState = useCallback(() => {
    setMeta(null);
    setQuestion(null);
    setAnswered(null);
    setOppAnswered(false);
    setLastResult(null);
    setScores({ you: 0, opp: 0 });
    setOver(null);
    setRoomCode(null);
    setOppLeft(false);
    setRematchPending(false);
    setCountdown(3);
  }, []);

  // socket wiring (single registration)
  useEffect(() => {
    const sock = getLiveSocket();

    // If the socket is already connected+authed (navigating back to /live
    // within the same session), auth:ok won't fire again — restore state.
    if (sock.connected) {
      setConnected(true);
      if (isLiveAuthed()) {
        setAuthOk(true);
        setPhase((p) => (p === "connecting" ? "lobby" : p));
      }
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setAuthOk(false);
      setLiveAuthed(false);
      if (["starting", "countdown", "question", "reveal"].includes(phaseRef.current)) {
        setOppLeft(true); // treat our own drop as "reconnecting…" overlay
      }
    };

    const onAuthOk = () => {
      setLiveAuthed(true);
      setAuthOk(true);
      setAuthMsg(null);
      setPhase((p) => (p === "connecting" ? "lobby" : p));
    };
    const onAuthFail = (d: { message?: string }) => {
      setLiveAuthed(false);
      setAuthOk(false);
      setAuthMsg(d?.message ?? "Sign in to play live duels.");
      setPhase("lobby");
    };

    const onQueueStatus = (d: { searching?: boolean }) => {
      if (d.searching) setPhase("queueing");
      else setPhase((p) => (p === "queueing" ? "lobby" : p));
    };

    const onRoomCreated = (d: { code: string }) => {
      setRoomCode(d.code);
      setPhase("room");
    };
    const onRoomJoined = () => {
      setPhase("starting");
    };
    const onRoomCancelled = (d: { reason?: string }) => {
      toast(d?.reason ?? "Room closed.");
      resetMatchState();
      setPhase("lobby");
    };

    const onMatchReady = (d: MatchMeta & { phase?: string }) => {
      setMeta(d);
      setScores({ you: 0, opp: 0 });
      setPhase("countdown");
      setCountdown(3);
    };
    const onMatchRejoin = (d: MatchMeta & { phase: string; question?: { question: LiveQuestion; index: number; total: number; durationSec: number; endsAtMs: number; answered?: boolean }; lastResult?: RoundResult | null }) => {
      setMeta(d);
      setScores({ you: d.you.score ?? 0, opp: d.opponent.score ?? 0 });
      setOppLeft(false);
      if (d.phase === "question" && d.question) {
        setQuestion({ q: d.question.question, index: d.question.index, total: d.question.total, durationSec: d.question.durationSec });
        setAnswered(d.question.answered ? "locked" : null);
        setPhase("question");
      } else if (d.phase === "reveal" || d.phase === "finished") {
        if (d.lastResult) {
          setLastResult(d.lastResult);
          setScores({ you: d.lastResult.scoreYou, opp: d.lastResult.scoreOpp });
          setPhase(d.phase === "finished" ? "over" : "reveal");
          if (d.phase === "finished") setOver({ result: null, forfeitLost: false, you: null, summary: "Match finished." });
        } else {
          setPhase("countdown");
        }
      } else {
        setPhase("countdown");
      }
    };
    const onCountdown = (d: { value: number }) => {
      setCountdown(d.value);
      if (sfx.enabled) sfx.tick();
    };
    const onQuestionShow = (d: { index: number; total: number; question: LiveQuestion; durationSec: number }) => {
      setQuestion({ q: d.question, index: d.index, total: d.total, durationSec: d.durationSec });
      setAnswered(null);
      setOppAnswered(false);
      setLastResult(null);
      setPhase("question");
    };
    const onOpponentAnswered = () => setOppAnswered(true);
    const onRoundResult = (d: RoundResult) => {
      setLastResult(d);
      setScores({ you: d.scoreYou, opp: d.scoreOpp });
      setPhase("reveal");
      if (sfx.enabled) (d.you.correct ? sfx.correct : sfx.wrong)();
    };
    const onMatchOver = (d: OverPayload) => {
      setOver(d);
      setPhase("over");
      const iWon = d.result?.winnerId && d.result.winnerId === me?.id;
      if (sfx.enabled) (iWon ? sfx.win : d.result?.draw ? sfx.unlock : sfx.lose)();
      if (iWon) setBurst((b) => b + 1);
      useClash.getState().fetchMe();
    };
    const onOppLeftMsg = () => setOppLeft(true);
    const onOppBack = () => setOppLeft(false);
    const onRematchWait = () => {
      setRematchPending(true);
      toast("Opponent wants a rematch!");
    };
    const onMatchError = (d: { message?: string }) => {
      toast.error(d?.message ?? "Live duel error.");
      resetMatchState();
      setPhase("lobby");
    };
    const onLiveError = (d: { message?: string }) => toast.error(d?.message ?? "Live error.");

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    sock.on("auth:ok", onAuthOk);
    sock.on("auth:failed", onAuthFail);
    sock.on("queue:status", onQueueStatus);
    sock.on("room:created", onRoomCreated);
    sock.on("room:joined", onRoomJoined);
    sock.on("match:cancelled", onRoomCancelled);
    sock.on("match:ready", onMatchReady);
    sock.on("match:rejoin", onMatchRejoin);
    sock.on("match:countdown", onCountdown);
    sock.on("question:show", onQuestionShow);
    sock.on("opponent:answered", onOpponentAnswered);
    sock.on("round:result", onRoundResult);
    sock.on("match:over", onMatchOver);
    sock.on("match:opponent_left", onOppLeftMsg);
    sock.on("match:opponent_back", onOppBack);
    sock.on("rematch:wait", onRematchWait);
    sock.on("match:error", onMatchError);
    sock.on("live:error", onLiveError);

    if (sock.connected) setConnected(true);

    return () => {
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
      sock.off("auth:ok", onAuthOk);
      sock.off("auth:failed", onAuthFail);
      sock.off("queue:status", onQueueStatus);
      sock.off("room:created", onRoomCreated);
      sock.off("room:joined", onRoomJoined);
      sock.off("match:cancelled", onRoomCancelled);
      sock.off("match:ready", onMatchReady);
      sock.off("match:rejoin", onMatchRejoin);
      sock.off("match:countdown", onCountdown);
      sock.off("question:show", onQuestionShow);
      sock.off("opponent:answered", onOpponentAnswered);
      sock.off("round:result", onRoundResult);
      sock.off("match:over", onMatchOver);
      sock.off("match:opponent_left", onOppLeftMsg);
      sock.off("match:opponent_back", onOppBack);
      sock.off("rematch:wait", onRematchWait);
      sock.off("match:error", onMatchError);
      sock.off("live:error", onLiveError);
      // leaving the live view mid-match = forfeit (honest rule)
      if (startedRef.current) {
        sock.emit("match:leave");
        startedRef.current = false;
      }
    };
  }, [me?.id, resetMatchState]);

  // queue elapsed ticker
  useEffect(() => {
    if (phase !== "queueing") {
      setQueueSecs(0);
      return;
    }
    const iv = setInterval(() => setQueueSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ── actions ─────────────────────────────────────────────────

  const sock = () => getLiveSocket();
  const requireSubject = () => {
    if (!subjectId) {
      toast.error("Pick a subject first.");
      return false;
    }
    return true;
  };

  const quickMatch = () => {
    if (!requireSubject()) return;
    resetMatchState();
    sock().emit("queue:join", { subjectId });
  };
  const cancelQueue = () => sock().emit("queue:leave");
  const playTrainer = () => {
    if (!requireSubject()) return;
    resetMatchState();
    sock().emit("bot:play", { subjectId });
  };
  const createRoom = () => {
    if (!requireSubject()) return;
    resetMatchState();
    sock().emit("room:create", { subjectId });
  };
  const cancelRoom = () => {
    sock().emit("room:cancel");
    resetMatchState();
    setPhase("lobby");
  };
  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return toast.error("Enter the 5-character room code.");
    resetMatchState();
    sock().emit("room:join", { code });
  };
  const submitAnswer = (optionId: string) => {
    if (phase !== "question" || answered || !question) return;
    setAnswered(optionId);
    sock().emit("answer:submit", {
      questionIndex: question.index,
      questionId: question.q.id,
      optionId,
    });
  };
  const rematch = () => sock().emit("rematch:accept");
  const backToLobby = () => {
    resetMatchState();
    setPhase("lobby");
  };

  // ── render ──────────────────────────────────────────────────

  if (!me) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Live Duels</h1>
        <EmptyState
          icon={Radio}
          title="Sign in to play live"
          description="Real-time duels need an account so your rating, XP and league points are tracked."
          action={
            <button onClick={() => navigate("/login")} className="cc-tap rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-2.5 font-bold text-yellow-950">
              Sign in
            </button>
          }
        />
      </div>
    );
  }

  if (phase === "connecting") return <LoadingCard label="Connecting to live arena…" />;

  const inMatch = ["starting", "countdown", "question", "reveal"].includes(phase);

  return (
    <div className={cn("space-y-5", inMatch && "mx-auto max-w-2xl")}>
      {burst > 0 && <Confetti burstKey={burst} />}

      {/* ── header ── */}
      {!inMatch && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg">
                <Radio size={18} aria-hidden />
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                </span>
              </span>
              Live Duels
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time battles — same questions, same clock, instant results.
            </p>
          </div>
          <Pill color={connected ? "green" : "red"}>
            {connected ? <Wifi size={12} aria-hidden /> : <WifiOff size={12} aria-hidden />}
            {connected ? "Live server connected" : "Reconnecting…"}
          </Pill>
        </div>
      )}

      {authMsg && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300" role="alert">
          {authMsg}
        </div>
      )}

      {/* ── lobby ── */}
      {phase === "lobby" && !authMsg && (
        <>
          <section className="rounded-3xl border border-border/60 bg-card/70 p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">1. Pick your battlefield</p>
              {!authOk && (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" aria-hidden />
                  Connecting…
                </span>
              )}
            </div>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects available for your class yet.</p>
            ) : (
              <div className="cc-scroll flex gap-2 overflow-x-auto pb-1">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubjectId(s.id)}
                    className={cn(
                      "cc-tap flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3.5 py-2 text-sm font-bold transition-all",
                      subjectId === s.id ? "border-pink-500 bg-pink-500/10" : "border-border/60 bg-secondary/40"
                    )}
                    aria-pressed={subjectId === s.id}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <button
              onClick={quickMatch}
              disabled={!authOk}
              className="cc-tap group rounded-3xl border-2 border-pink-500/40 bg-gradient-to-b from-pink-500/15 to-transparent p-5 text-left transition-all hover:border-pink-500 active:scale-[0.98] disabled:opacity-40"
            >
              <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/20">
                <Users size={22} className="text-pink-400" aria-hidden />
              </span>
              <p className="font-display font-bold">Quick Match</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Auto-match with a classmate queuing for the same subject. Rating moves!
              </p>
            </button>

            <button
              onClick={playTrainer}
              disabled={!authOk}
              className="cc-tap group rounded-3xl border-2 border-violet-500/40 bg-gradient-to-b from-violet-500/15 to-transparent p-5 text-left transition-all hover:border-violet-500 active:scale-[0.98] disabled:opacity-40"
            >
              <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20">
                <Bot size={22} className="text-violet-300" aria-hidden />
              </span>
              <p className="font-display font-bold">Live Trainer</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Battle a trainer bot right now — no waiting. Season points, no rating change.
              </p>
            </button>

            <button
              onClick={createRoom}
              disabled={!authOk}
              className="cc-tap group rounded-3xl border-2 border-yellow-500/40 bg-gradient-to-b from-yellow-500/15 to-transparent p-5 text-left transition-all hover:border-yellow-500 active:scale-[0.98] disabled:opacity-40"
            >
              <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-500/20">
                <Link2 size={22} className="text-yellow-400" aria-hidden />
              </span>
              <p className="font-display font-bold">Friend Room</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Create a room code and duel a classmate the moment they join.
              </p>
            </button>
          </section>

          <section className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/70 p-5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Link2 size={14} aria-hidden /> Have a room code?
              </p>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                placeholder="ABCDE"
                maxLength={6}
                aria-label="Room code"
                className="cc-tap w-full rounded-xl border border-input bg-secondary/40 px-4 py-3 text-center font-display text-xl tracking-[0.35em] outline-none placeholder:tracking-normal placeholder:text-muted-foreground/50"
              />
            </div>
            <button
              onClick={joinRoom}
              disabled={!authOk}
              className="cc-tap rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-6 py-3 font-bold text-yellow-950 active:scale-95 disabled:opacity-40"
            >
              Join room
            </button>
          </section>

          <section className="rounded-2xl border border-border/50 bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-1.5 font-semibold text-foreground/80">
              <Zap size={13} aria-hidden /> How live duels work
            </p>
            Both players get the same questions on the same clock (20s each). Faster correct answers earn
            bigger bonuses. Rounds stay in sync — you both see the answer before the next question.
            Leaving mid-match counts as a forfeit. Wins earn season points that count towards your
            school&apos;s league position.
          </section>
        </>
      )}

      {/* ── queueing ── */}
      {phase === "queueing" && (
        <section className="flex flex-col items-center rounded-3xl border border-pink-500/30 bg-card/70 p-10 text-center">
          <span className="relative mb-5 flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-pink-500/20" />
            <span className="absolute inset-2 animate-pulse rounded-full bg-pink-500/10" />
            <Swords size={40} className="text-pink-400" aria-hidden />
          </span>
          <p className="font-display text-lg font-bold">Searching for an opponent…</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {subjects.find((s) => s.id === subjectId)?.name ?? "Duel"} • {queueSecs}s elapsed
          </p>
          <p className="mt-3 max-w-sm text-xs text-muted-foreground">
            No one online? Try a <strong>Live Trainer</strong> battle instead — they&apos;re always ready.
          </p>
          <button
            onClick={cancelQueue}
            className="cc-tap mt-5 rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            Cancel search
          </button>
        </section>
      )}

      {/* ── friend room waiting ── */}
      {phase === "room" && roomCode && (
        <section className="flex flex-col items-center rounded-3xl border border-yellow-500/30 bg-card/70 p-10 text-center">
          <p className="font-display text-lg font-bold">Room created — waiting for your classmate</p>
          <div className="my-5 rounded-2xl border-2 border-dashed border-yellow-500/50 bg-yellow-500/10 px-10 py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400/80">Room code</p>
            <p className="font-display text-4xl font-bold tracking-[0.3em] text-yellow-300">{roomCode}</p>
          </div>
          <button
            onClick={() => {
              const url = absoluteUrl("/live");
              navigator.clipboard
                ?.writeText(`${url} (room code ${roomCode})`)
                .then(() => toast("Invite copied!"))
                .catch(() => toast(`Share code: ${roomCode}`));
            }}
            className="cc-tap mb-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-2.5 font-bold text-yellow-950 active:scale-95"
          >
            <Copy size={15} aria-hidden /> Copy invite
          </button>
          <p className="mb-5 text-xs text-muted-foreground">
            They enter this code on the Live Duels page. The match starts the second they join.
          </p>
          <button onClick={cancelRoom} className="cc-tap rounded-xl bg-secondary px-5 py-2 text-sm font-bold text-muted-foreground hover:text-foreground">
            Close room
          </button>
        </section>
      )}

      {/* ── match ── */}
      {inMatch && meta && (
        <>
          {/* VS header */}
          <section className="rounded-3xl border border-border/60 bg-card/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <PlayerScore name={meta.you.displayName} avatar={meta.you.avatar} score={scores.you} align="left" />
              <div className="flex flex-col items-center px-1">
                <Pill color="red" className="animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> LIVE
                </Pill>
                <span className="mt-1 text-[11px] font-semibold text-muted-foreground">{meta.subjectName}</span>
                <span className="text-[10px] text-muted-foreground/70">
                  {meta.gradeName} • {question ? `${question.index + 1}/${question.total}` : `0/${meta.questionCount}`}
                </span>
              </div>
              <PlayerScore name={meta.opponent.displayName} avatar={meta.opponent.avatar} score={scores.opp} align="right" isBot={meta.opponent.isBot} />
            </div>
            {/* round progress dots */}
            <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
              {Array.from({ length: meta.questionCount }).map((_, i) => {
                const current = question ? i === question.index : false;
                const justDone = question ? i === question.index - 1 : false;
                const won = justDone && lastResult?.you.correct;
                const lost = justDone && lastResult && !lastResult.you.correct;
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-4 rounded-full transition-colors",
                      current
                        ? "bg-yellow-400"
                        : won
                          ? "bg-emerald-500"
                          : lost
                            ? "bg-red-500/60"
                            : question && i < question.index
                              ? "bg-emerald-500/40"
                              : "bg-secondary"
                    )}
                  />
                );
              })}
            </div>
          </section>

          {oppLeft && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm font-semibold text-orange-300" role="alert">
              <UserX size={16} aria-hidden />
              {meta.vsBot ? "You went offline…" : "Opponent connection lost"} — match ends if they don&apos;t return.
            </div>
          )}

          {/* countdown */}
          {phase === "countdown" && (
            <section className="flex flex-col items-center rounded-3xl border border-border/60 bg-card/70 p-14">
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Get ready</p>
              <p key={countdown} className="font-display text-7xl font-bold text-yellow-400 cc-countdown-pop">{countdown}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {meta.questionCount} questions • {meta.timePerQuestionSec}s each • faster = more points
              </p>
            </section>
          )}

          {/* question */}
          {(phase === "question" || phase === "reveal") && question && (
            <section className="rounded-3xl border border-border/60 bg-card/70 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Pill color="violet">{question.q.topicName}</Pill>
                  <Pill color={question.q.difficulty === "hard" ? "red" : question.q.difficulty === "medium" ? "orange" : "green"}>
                    {question.q.difficulty}
                  </Pill>
                </div>
                <CountdownRing key={`${question.q.id}-${phase}`} durationSec={question.durationSec} frozen={phase === "reveal"} />
              </div>

              <p className="mb-4 font-display text-lg font-bold leading-snug sm:text-xl">{question.q.text}</p>
              {question.q.imageUrl && (
                <div className="mb-4">
                  <QuestionImage src={question.q.imageUrl} alt="Question illustration" maxHeight={180} />
                </div>
              )}

              <div className="grid gap-2.5">
                {question.q.options.map((opt, i) => {
                  const isCorrect = lastResult && lastResult.correctOptionId === opt.id;
                  const isMyChoice = answered === opt.id;
                  const isOppChoice =
                    lastResult && (lastResult.opponent.chosenOptionId === opt.id) && !meta.opponent.isBot;
                  const revealed = phase === "reveal" && lastResult;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => submitAnswer(opt.id)}
                      disabled={phase !== "question" || Boolean(answered)}
                      aria-label={opt.text}
                      className={cn(
                        "cc-tap flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left text-sm font-semibold transition-all",
                        "border-border/60 bg-secondary/40",
                        phase === "question" && !answered && "hover:border-yellow-400/60 hover:bg-secondary/70",
                        answered && isMyChoice && !revealed && "border-yellow-400 bg-yellow-500/15",
                        revealed && isCorrect && "border-emerald-500 bg-emerald-500/20",
                        revealed && isMyChoice && !isCorrect && "border-red-500 bg-red-500/15",
                        revealed && !isCorrect && !isMyChoice && !isOppChoice && "opacity-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold",
                          revealed && isCorrect
                            ? "bg-emerald-500 text-white"
                            : revealed && isMyChoice && !isCorrect
                              ? "bg-red-500 text-white"
                              : isMyChoice
                                ? "bg-yellow-400 text-yellow-950"
                                : "bg-secondary text-foreground/70"
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-0 flex-1">{opt.text}</span>
                      {isOppChoice && (
                        <span className="flex h-6 items-center gap-1 rounded-full bg-pink-500/20 px-2 text-[10px] font-bold text-pink-300">
                          <Avatar avatar={meta.opponent.avatar} size={14} /> them
                        </span>
                      )}
                      {revealed && isCorrect && <Trophy size={16} className="text-emerald-400" aria-hidden />}
                    </button>
                  );
                })}
              </div>

              {/* per-round status strip */}
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                {phase === "question" ? (
                  answered ? (
                    <span className="font-semibold text-yellow-400">Answer locked in — waiting for opponent…</span>
                  ) : oppAnswered ? (
                    <span className="font-semibold text-pink-400">Opponent answered — hurry!</span>
                  ) : (
                    <span>Pick your answer</span>
                  )
                ) : lastResult ? (
                  <span className="font-semibold">
                    <span className={lastResult.you.correct ? "text-emerald-400" : "text-red-400"}>
                      You {lastResult.you.correct ? "✓" : "✗"} +{lastResult.you.points}
                    </span>
                    {" • "}
                    <span className={lastResult.opponent.correct ? "text-emerald-400" : "text-red-400"}>
                      {meta.vsBot ? "Trainer" : "They"} {lastResult.opponent.correct ? "✓" : "✗"} +{lastResult.opponent.points}
                    </span>
                  </span>
                ) : (
                  <span>Revealing…</span>
                )}
                <span className="flex items-center gap-1">
                  <Timer size={12} aria-hidden /> {meta.timePerQuestionSec}s per question
                </span>
              </div>
            </section>
          )}

          <button
            onClick={() => {
              getLiveSocket().emit("match:leave");
              resetMatchState();
              setPhase("lobby");
            }}
            className="cc-tap mx-auto flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground/70 hover:bg-red-500/10 hover:text-red-400"
          >
            <ArrowLeft size={13} aria-hidden /> Forfeit & leave (counts as a loss)
          </button>
        </>
      )}

      {/* ── result ── */}
      {phase === "over" && (
        <OverScreen
          over={over}
          meta={meta}
          scores={scores}
          me={me}
          rematchPending={rematchPending}
          onRematch={rematch}
          onLobby={backToLobby}
          onDetails={() => over?.result?.challengeId && navigate(`/duel/${over.result.challengeId}`)}
        />
      )}
    </div>
  );
}

// ── sub components ───────────────────────────────────────────

function PlayerScore({
  name,
  avatar,
  score,
  align,
  isBot,
}: {
  name: string;
  avatar: string;
  score: number;
  align: "left" | "right";
  isBot?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", align === "right" && "flex-row-reverse text-right")}>
      <div className="relative shrink-0">
        <Avatar avatar={avatar} size={44} ring={align === "left" ? "#f5c51855" : "#f43f5e55"} />
        {isBot && <Bot size={14} className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5 text-violet-300" aria-hidden />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{name}</p>
        <p className="font-display text-2xl font-bold tabular-nums text-yellow-300" aria-label={`Score ${score}`}>
          {score}
        </p>
      </div>
    </div>
  );
}

function CountdownRing({ durationSec, frozen }: { durationSec: number; frozen?: boolean }) {
  const [left, setLeft] = useState(durationSec);
  useEffect(() => {
    if (frozen) return;
    const end = Date.now() + durationSec * 1000;
    const iv = setInterval(() => {
      const remain = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(remain);
      if (remain <= 0) clearInterval(iv);
    }, 250);
    return () => clearInterval(iv);
  }, [durationSec, frozen]);
  return <TimerRing secondsLeft={left} total={durationSec} size={50} />;
}

function OverScreen({
  over,
  meta,
  scores,
  me,
  rematchPending,
  onRematch,
  onLobby,
  onDetails,
}: {
  over: OverPayload | null;
  meta: MatchMeta | null;
  scores: { you: number; opp: number };
  me: { id: string };
  rematchPending: boolean;
  onRematch: () => void;
  onLobby: () => void;
  onDetails: () => void;
}) {
  const winnerId = over?.result?.winnerId ?? null;
  const draw = over?.result?.draw ?? false;
  const iWon = winnerId === me.id;
  const isLoss = Boolean(winnerId && !draw && winnerId !== me.id);
  const forfeitLost = over?.forfeitLost ?? false;

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div
        className={cn(
          "rounded-3xl border p-8 text-center",
          iWon
            ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/15 to-transparent"
            : isLoss
              ? "border-red-500/40 bg-gradient-to-b from-red-500/15 to-transparent"
              : "border-violet-500/40 bg-gradient-to-b from-violet-500/15 to-transparent"
        )}
      >
        <p className="font-display text-4xl font-black tracking-tight">
          {iWon ? "VICTORY" : isLoss ? (forfeitLost ? "FORFEIT" : "DEFEAT") : "DRAW"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {over?.summary ?? (forfeitLost ? "You left the match." : "Match complete.")}
        </p>

        {meta && (
          <div className="mt-6 flex items-center justify-center gap-6 sm:gap-10">
            <div className="text-center">
              <Avatar avatar={meta.you.avatar} size={52} ring="#f5c51855" />
              <p className="mt-1.5 max-w-24 truncate text-xs font-bold">{meta.you.displayName}</p>
              <p className="font-display text-2xl font-bold text-yellow-300">{scores.you}</p>
            </div>
            <span className="font-display text-xl text-muted-foreground">vs</span>
            <div className="text-center">
              <Avatar avatar={meta.opponent.avatar} size={52} ring="#f43f5e55" />
              <p className="mt-1.5 max-w-24 truncate text-xs font-bold">{meta.opponent.displayName}</p>
              <p className="font-display text-2xl font-bold text-pink-400">{scores.opp}</p>
            </div>
          </div>
        )}

        {over?.you && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Pill color="green">+{over.you.xpEarned} XP</Pill>
            {over.you.correctCount !== undefined && (
              <Pill>{over.you.correctCount}/{over.you.totalCount} correct</Pill>
            )}
            {over.you.ratingDelta !== null && over.you.ratingDelta !== undefined && meta && !meta.vsBot && (
              <Pill color={over.you.ratingDelta >= 0 ? "gold" : "red"}>
                Rating {over.you.ratingAfter} ({over.you.ratingDelta >= 0 ? "+" : ""}{over.you.ratingDelta})
              </Pill>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          onClick={onRematch}
          className="cc-tap flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3.5 font-display font-bold text-white active:scale-95"
        >
          <RefreshCw size={17} aria-hidden />
          {meta?.vsBot ? "Rematch trainer" : rematchPending ? "Waiting for opponent…" : "Rematch"}
        </button>
        <button
          onClick={onDetails}
          className="cc-tap flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 py-3.5 font-bold hover:bg-secondary active:scale-95"
        >
          View full breakdown <ChevronRight size={16} aria-hidden />
        </button>
        <button
          onClick={onLobby}
          className="cc-tap flex-1 rounded-2xl border border-border bg-secondary/50 py-3.5 font-bold hover:bg-secondary active:scale-95"
        >
          Live lobby
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Season points from live duels count towards your school league position.
      </p>
    </section>
  );
}

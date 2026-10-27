"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend, localDateStr } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { TimerRing, useCountdown, LoadingCard, ErrorState } from "@/components/clash/shared";
import { sfx } from "@/lib/clash/client/sound";
import { toast } from "sonner";
import { Check, X, ArrowRight, Flag, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

type SanitizedQuestion = {
  id: string; text: string; type: string; difficulty: string;
  points: number; timeLimit: number;
  options: { id: string; text: string }[];
  subjectName: string; topicName: string;
};

type SessionState = {
  session: {
    id: string; mode: string; status: string; subjectName: string; topicName: string | null;
    totalCount: number; currentIndex: number; score: number; correctCount: number;
    timeLimitPer: number; answeredQuestionIds: string[];
  };
  questions: SanitizedQuestion[];
};

type Feedback = { correct: boolean; correctIndex: number; explanation: string; points: number } | null;

const IMMEDIATE_MODES = ["practice", "guest"];
const DIFF_COLOR: Record<string, string> = { easy: "#34d399", medium: "#f5c518", hard: "#ef4444" };

export default function QuizPlayView({ sessionId }: { sessionId?: string }) {
  const me = useClash((s) => s.me);

  if (sessionId === "guest") return <GuestQuiz />;
  if (!me) {
    navigate("/login");
    return null;
  }
  if (!sessionId) {
    navigate("/");
    return null;
  }
  return <QuizRunner sessionId={sessionId} />;
}

// ── Authenticated quiz runner ────────────────────────────────

function QuizRunner({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [locked, setLocked] = useState(false); // per-question lock while submitting
  const [finishing, setFinishing] = useState(false);
  const questionStart = useRef<number>(Date.now());
  const soundTick = useClash((s) => s.soundOn);

  const load = useCallback(async () => {
    const r = await apiGet<SessionState>(`/quiz/${sessionId}`);
    if (r.ok) {
      const data = (r as unknown as { session: SessionState["session"]; questions: SanitizedQuestion[] });
      if (data.session.status === "completed") {
        navigate(`/results/${sessionId}`, true);
        return;
      }
      const firstUnanswered =
        data.questions.findIndex((q) => !data.session.answeredQuestionIds.includes(q.id));
      setQIndex(Math.max(0, firstUnanswered === -1 ? data.questions.length : firstUnanswered));
      setState({ session: data.session, questions: data.questions });
      questionStart.current = Date.now();
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const q = state?.questions[qIndex];
  const immediate = IMMEDIATE_MODES.includes(state?.session.mode ?? "");
  const timed = (state?.session.timeLimitPer ?? 0) > 0;

  const answerRef = useRef<(optionId: string | null) => void>(() => {});

  const { left, elapsedMs } = useCountdown(
    state?.session.timeLimitPer ?? 0,
    Boolean(timed && state && q && !feedback && !finishing),
    timed ? () => answerRef.current(null) : undefined
  );

  // tick sound in last 5 seconds
  useEffect(() => {
    if (soundTick && timed && left <= 5 && left > 0 && !feedback) sfx.tick();
  }, [left]);

  const answer = async (optionId: string | null) => {
    if (!state || !q || locked || feedback) return;
    setLocked(true);
    setSelected(optionId);
    const timeSpent = elapsedMs() > 0 ? elapsedMs() : Date.now() - questionStart.current;
    const r = await apiSend<Feedback & { recorded?: boolean }>("POST", `/quiz/${sessionId}/answer`, {
      questionId: q.id,
      optionId,
      timeSpentMs: timeSpent,
    });
    if (!r.ok) {
      toast.error(r.error);
      setLocked(false);
      setSelected(null);
      return;
    }
    if ("recorded" in r && r.recorded) {
      // competitive: no reveal — move on
      advance();
    } else {
      setFeedback(r as Feedback);
      if (r.correct) sfx.correct();
      else sfx.wrong();
    }
  };
  answerRef.current = answer;

  const advance = () => {
    setFeedback(null);
    setSelected(null);
    setLocked(false);
    questionStart.current = Date.now();
    if (state && qIndex + 1 >= state.questions.length) {
      finish();
    } else {
      setQIndex(qIndex + 1);
    }
  };

  const finish = async () => {
    setFinishing(true);
    const r = await apiSend("POST", `/quiz/${sessionId}/complete`, { localDate: localDateStr() });
    setFinishing(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    navigate(`/results/${sessionId}`, true);
  };

  // ── safety: leaving an in-progress quiz is fine (session resumes) ──

  if (loading) return <LoadingCard label="Preparing your questions…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!state || !q)
    return <ErrorState message="This quiz session is no longer available." onRetry={() => navigate("/")} />;

  const { session } = state;
  const progressPct = Math.round(((qIndex + (feedback ? 1 : 0)) / session.totalCount) * 100);
  const options = q.options;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* HUD */}
      <div className="sticky top-14 z-20 -mx-1 rounded-b-2xl border-b border-border/60 bg-background/90 px-1 pb-3 pt-1 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold">
              {session.mode === "duel" || session.mode === "champion" ? "⚔️ " : ""}
              {session.subjectName}
              {session.topicName ? ` • ${session.topicName}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Question {qIndex + 1} of {session.totalCount} • Score {session.score}
            </p>
          </div>
          {timed && !feedback && (
            <TimerRing secondsLeft={left} total={session.timeLimitPer} />
          )}
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500"
            style={{ width: `${Math.max(4, progressPct)}%` }}
          />
        </div>
      </div>

      {/* question card */}
      <div key={q.id} className="cc-slide-up rounded-3xl border border-border/60 bg-card/80 p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-bold capitalize"
            style={{ background: (DIFF_COLOR[q.difficulty] ?? "#f5c518") + "1f", color: DIFF_COLOR[q.difficulty] ?? "#f5c518" }}
          >
            {q.difficulty}
          </span>
          <span className="text-xs text-muted-foreground">{q.points} pts</span>
        </div>
        <h2 className="font-display text-lg font-semibold leading-relaxed sm:text-xl">{q.text}</h2>

        {/* options */}
        <div className="mt-5 space-y-2.5" role="group" aria-label="Answer options">
          {options.map((o, i) => {
            const isSelected = selected === o.id;
            const isCorrectOption =
              feedback && feedback.correctIndex === i;
            const isWrongSelection = feedback && isSelected && !feedback.correct;
            return (
              <button
                key={o.id}
                onClick={() => !locked && !feedback && answer(o.id)}
                disabled={Boolean(feedback) || locked}
                aria-label={`Option ${i + 1}: ${o.text}`}
                className={cn(
                  "cc-tap flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium transition-all sm:text-base",
                  "active:scale-[0.98]",
                  !feedback && !isSelected && "border-border/60 bg-secondary/40 hover:border-yellow-500/50 hover:bg-secondary/70",
                  !feedback && isSelected && "border-yellow-400 bg-yellow-500/10",
                  isCorrectOption && "border-emerald-500 bg-emerald-500/15 text-emerald-300",
                  isWrongSelection && "cc-shake border-red-500 bg-red-500/15 text-red-300",
                  feedback && !isCorrectOption && !isWrongSelection && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    isSelected || isCorrectOption ? "border-transparent" : "border-border"
                  )}
                  style={{
                    background: isCorrectOption ? "#10b981" : isWrongSelection ? "#ef4444" : isSelected ? "#f5c518" : "transparent",
                    color: isSelected || isCorrectOption || isWrongSelection ? "#0a0a0a" : undefined,
                  }}
                  aria-hidden
                >
                  {isCorrectOption ? <Check size={15} /> : isWrongSelection ? <X size={15} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{o.text}</span>
              </button>
            );
          })}
        </div>

        {/* practice feedback */}
        {feedback && (
          <div
            className={cn(
              "cc-pop mt-5 rounded-2xl border p-4",
              feedback.correct ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
            )}
            role="status"
          >
            <p className={cn("flex items-center gap-2 font-display font-bold", feedback.correct ? "text-emerald-400" : "text-red-400")}>
              {feedback.correct ? <><Check size={17} aria-hidden /> Correct! +{feedback.points} pts</> : <><X size={17} aria-hidden /> Not quite</>}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{feedback.explanation}</p>
            <button
              onClick={advance}
              className="cc-tap mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 font-display font-bold text-yellow-950 active:scale-95 sm:w-auto sm:px-6"
            >
              <span className="my-2.5">
                {qIndex + 1 >= session.totalCount ? "See Results" : "Next Question"}
              </span>{" "}
              <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        )}

        {/* competitive: auto-advance after brief confirmation */}
        {!immediate && selected && !feedback && (
          <p className="mt-4 text-center text-sm text-muted-foreground" role="status">
            <ListChecks size={14} className="mr-1 inline" aria-hidden /> Answer locked in.
          </p>
        )}
      </div>

      {finishing && <LoadingCard label="Validating your results on the server…" />}

      <p className="text-center text-xs text-muted-foreground">
        <Flag size={11} className="mr-1 inline" aria-hidden />
        Refresh-safe: your progress is saved as you go. Timed competitive answers are validated server-side.
      </p>
    </div>
  );
}

// ── Guest demo quiz (no account, nothing saved) ──────────────

function GuestQuiz() {
  const [demo, setDemo] = useState<{ questions: SanitizedQuestion[]; disclaimer: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiGet<{ demo: { questions: SanitizedQuestion[] }; disclaimer: string }>("/guest/quiz").then((r) => {
      if (r.ok) setDemo({ questions: r.demo.questions, disclaimer: r.disclaimer });
      setLoading(false);
    });
  }, []);

  const q = demo?.questions[qIndex];

  const answer = async (optionId: string) => {
    if (!q || feedback) return;
    setSelected(optionId);
    const r = await apiSend<Feedback>("POST", "/guest/quiz/answer", {
      questionId: q.id,
      optionId,
    });
    if (!r.ok) return;
    setFeedback(r);
    if (r.correct) {
      setScore((s) => s + 100);
      setCorrectCount((c) => c + 1);
      sfx.correct();
    } else sfx.wrong();
  };

  const next = () => {
    setFeedback(null);
    setSelected(null);
    if (demo && qIndex + 1 >= demo.questions.length) setDone(true);
    else setQIndex(qIndex + 1);
  };

  if (loading) return <LoadingCard label="Loading sample questions…" />;
  if (!demo) return <ErrorState message="Couldn't load the preview quiz right now." onRetry={() => location.reload()} />;

  if (done) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-4 text-center">
        <div className="cc-hero-bg rounded-3xl border border-border/60 p-8">
          <p className="font-display text-5xl font-bold cc-gradient-text">{correctCount}/{demo.questions.length}</p>
          <p className="mt-2 text-muted-foreground">Preview score: {score} pts (not saved)</p>
          <p className="mt-4 text-sm text-muted-foreground">{demo.disclaimer}</p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => navigate("/register")}
              className="cc-tap rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-6 font-display font-bold text-yellow-950 active:scale-95"
            >
              <span className="my-2.5 inline-block">Create a free account</span>
            </button>
            <button onClick={() => navigate("/")} className="cc-tap rounded-2xl bg-secondary px-6 font-semibold">
              <span className="my-2.5 inline-block">Back to home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-center text-xs font-semibold text-violet-300">
        Guest preview — nothing is saved. Register for XP, badges and championships!
      </div>
      <div className="rounded-3xl border border-border/60 bg-card/80 p-5 sm:p-7">
        <p className="text-xs text-muted-foreground">
          Sample question {qIndex + 1} of {demo.questions.length} • {q.subjectName}
        </p>
        <h2 className="mt-2 font-display text-lg font-semibold leading-relaxed sm:text-xl">{q.text}</h2>
        <div className="mt-5 space-y-2.5">
          {q.options.map((o, i) => {
            const isCorrectOption = feedback && feedback.correctIndex === i;
            const isWrong = feedback && selected === o.id && !feedback.correct;
            return (
              <button
                key={o.id}
                onClick={() => answer(o.id)}
                disabled={Boolean(feedback)}
                className={cn(
                  "cc-tap flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium sm:text-base",
                  !feedback && "border-border/60 bg-secondary/40 hover:border-yellow-500/50",
                  isCorrectOption && "border-emerald-500 bg-emerald-500/15 text-emerald-300",
                  isWrong && "cc-shake border-red-500 bg-red-500/15 text-red-300",
                  feedback && !isCorrectOption && !isWrong && "opacity-60"
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold" aria-hidden>
                  {isCorrectOption ? <Check size={15} /> : isWrong ? <X size={15} /> : String.fromCharCode(65 + i)}
                </span>
                {o.text}
              </button>
            );
          })}
        </div>
        {feedback && (
          <div className={cn("cc-pop mt-5 rounded-2xl border p-4", feedback.correct ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10")}>
            <p className={cn("font-display font-bold", feedback.correct ? "text-emerald-400" : "text-red-400")}>
              {feedback.correct ? "Correct!" : "Not quite"}
            </p>
            <p className="mt-1.5 text-sm text-foreground/85">{feedback.explanation}</p>
            <button onClick={next} className="cc-tap mt-3.5 w-full rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 font-display font-bold text-yellow-950 active:scale-95 sm:w-auto sm:px-6">
              <span className="my-2.5 inline-block">{qIndex + 1 >= demo.questions.length ? "Finish preview" : "Next"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar, AVATAR_LIST } from "@/lib/clash/avatars";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Sparkles } from "lucide-react";

type Grade = { id: string; name: string; levelName: string; hasContent: boolean };

export default function OnboardingView() {
  const { me, fetchMe } = useClash();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [avatar, setAvatar] = useState(me?.avatar ?? "fox");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ structure: { grades: Grade[] } }>("/structure").then((r) => {
      if (r.ok) setGrades(r.structure.grades.filter((g) => g.hasContent));
    });
  }, []);

  useEffect(() => {
    if (me && !displayName) {
      setDisplayName(me.displayName);
      setAvatar(me.avatar);
    }
  }, [me, displayName]);

  const levels = [...new Set(grades.map((g) => g.levelName))];

  const finish = async () => {
    if (!gradeId) {
      setError("Pick your class to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await apiSend("POST", "/onboarding", {
      displayName: displayName.trim(),
      avatar,
      gradeId,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    await fetchMe();
    toast("You're all set! Welcome to ClassClash 🎉");
    navigate("/", true);
  };

  const steps = ["Profile", "Your class", "Ready"];

  return (
    <div className="mx-auto max-w-lg py-4">
      {/* stepper */}
      <div className="mb-6 flex items-center justify-center gap-2" aria-label={`Step ${step + 1} of 3`}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                i === step ? "bg-yellow-500/15 text-yellow-300" : i < step ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"
              )}
            >
              {i < step ? <Check size={13} aria-hidden /> : <span>{i + 1}</span>}
              {s}
            </span>
            {i < steps.length - 1 && <span className="h-px w-6 bg-border/70" aria-hidden />}
          </React.Fragment>
        ))}
      </div>

      <div className="cc-hero-bg rounded-3xl border border-border/60 p-6 sm:p-8">
        {step === 0 && (
          <section aria-label="Choose your identity">
            <h1 className="font-display text-2xl font-bold">Create your player identity</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This is how classmates will see you on leaderboards. Keep it fun and safe — no real names.
            </p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-semibold">Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={16}
                placeholder="e.g. QuantumQueen"
                className="cc-tap w-full rounded-xl border border-input bg-secondary/40 px-4 py-2.5 text-sm outline-none focus:border-yellow-500/50"
              />
            </label>
            <p className="mt-5 mb-2 text-sm font-semibold">Pick your avatar</p>
            <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Avatar selection">
              {AVATAR_LIST.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  role="radio"
                  aria-checked={avatar === a}
                  className={cn(
                    "flex justify-center rounded-2xl border-2 p-1.5 transition-all",
                    avatar === a ? "border-yellow-400 bg-yellow-500/10" : "border-transparent hover:border-border"
                  )}
                >
                  <Avatar avatar={a} size={40} />
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section aria-label="Choose your class">
            <h1 className="font-display text-2xl font-bold">Which class are you in?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You'll compete for championships within your class. More classes unlock as content is added.
            </p>
            <div className="mt-5 space-y-5">
              {levels.map((lvl) => (
                <div key={lvl}>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <GraduationCap size={14} aria-hidden /> {lvl}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {grades
                      .filter((g) => g.levelName === lvl)
                      .map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setGradeId(g.id)}
                          className={cn(
                            "cc-tap rounded-xl border-2 px-3 py-2.5 font-display text-sm font-bold transition-all",
                            gradeId === g.id
                              ? "border-yellow-400 bg-yellow-500/10 text-yellow-300"
                              : "border-border/60 bg-secondary/40 hover:border-border"
                          )}
                        >
                          {g.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-label="You are ready" className="text-center">
            <div className="cc-pop mx-auto mt-2 flex w-fit items-center gap-4 rounded-3xl border border-yellow-500/30 bg-yellow-500/8 p-5">
              <Avatar avatar={avatar} size={64} ring="#f5c518" />
              <div className="text-left">
                <p className="font-display text-xl font-bold">{displayName || "Player One"}</p>
                <p className="text-sm text-muted-foreground">
                  {grades.find((g) => g.id === gradeId)?.name ?? "No class selected"}
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-2.5 text-left">
              {[
                { icon: "🎓", text: "Practise subjects topic by topic with instant explanations" },
                { icon: "⚔️", text: "Duel classmates and enter the Quick Arena" },
                { icon: "👑", text: "Challenge Guardian bots to win real championship crowns" },
                { icon: "🔥", text: "Build streaks, complete missions, earn XP and badges" },
              ].map((x) => (
                <p key={x.text} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-4 py-3 text-sm">
                  <span aria-hidden>{x.icon}</span> {x.text}
                </p>
              ))}
            </div>
          </section>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-500/12 px-4 py-2.5 text-sm font-medium text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center justify-between">
          <button
            onClick={() => (step === 0 ? navigate("/settings") : setStep(step - 1))}
            className="cc-tap flex items-center gap-1.5 rounded-xl px-4 font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} aria-hidden /> {step === 0 ? "Later" : "Back"}
          </button>
          {step < 2 ? (
            <button
              onClick={() => {
                if (step === 0 && (displayName.trim().length < 3)) {
                  setError("Choose a display name (3–16 characters).");
                  return;
                }
                setError(null);
                setStep(step + 1);
              }}
              className="cc-tap flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-6 font-display font-bold text-yellow-950 active:scale-95"
            >
              <span className="my-2.5">Continue</span> <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={busy}
              className="cc-tap flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-6 font-display font-bold text-yellow-950 active:scale-95 disabled:opacity-60"
            >
              <Sparkles size={16} aria-hidden /> <span className="my-2.5">{busy ? "Saving…" : "Start clashing!"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

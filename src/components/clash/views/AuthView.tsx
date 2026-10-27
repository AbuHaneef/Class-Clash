"use client";

import React, { useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User as UserIcon, Play, Loader2 } from "lucide-react";

export default function AuthView({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchMe = useClash((s) => s.fetchMe);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r =
      mode === "register"
        ? await apiSend<{ userId: string }>("POST", "/auth/register", {
            email,
            password,
            displayName,
          })
        : await apiSend<{ userId: string; onboarded: boolean }>("POST", "/auth/login", {
            email,
            password,
          });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const me = await fetchMe();
    toast(mode === "register" ? "Account created! Let's set you up." : `Welcome back${me ? ", " + me.displayName : ""}!`);
    const staff = me?.role === "admin" || me?.role === "reviewer";
    navigate(me && !me.onboarded ? "/onboarding" : staff ? "/admin/dashboard" : "/", true);
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="cc-hero-bg rounded-3xl border border-border/60 p-6 sm:p-8">
        <h1 className="text-center font-display text-3xl font-bold">
          {mode === "register" ? (
            <>Join the <span className="cc-gradient-text">Clash</span></>
          ) : (
            <>Welcome <span className="cc-gradient-text">back</span></>
          )}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === "register"
            ? "One account for practice, duels and championships."
            : "Sign in to continue your climb."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3.5">
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Display name</span>
              <span className="flex items-center rounded-xl border border-input bg-secondary/40">
                <UserIcon size={17} className="ml-3 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. AdaTheBrain"
                  maxLength={16}
                  required
                  autoComplete="nickname"
                  className="cc-tap w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                3–16 characters. Never share your real name or phone number.
              </span>
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Email</span>
            <span className="flex items-center rounded-xl border border-input bg-secondary/40">
              <Mail size={17} className="ml-3 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="cc-tap w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Password</span>
            <span className="flex items-center rounded-xl border border-input bg-secondary/40">
              <Lock size={17} className="ml-3 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                required
                minLength={mode === "register" ? 8 : undefined}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="cc-tap w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="cc-tap px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
              </button>
            </span>
          </label>

          {error && (
            <p className="rounded-xl bg-red-500/12 px-4 py-2.5 text-sm font-medium text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="cc-tap flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 font-display font-bold text-yellow-950 shadow-lg shadow-orange-500/20 transition-transform active:scale-95 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={18} className="my-3 animate-spin" aria-hidden />
            ) : (
              <span className="my-3">{mode === "register" ? "Create my account" : "Sign in"}</span>
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-sm">
          {mode === "register" ? (
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => navigate("/login")} className="font-bold text-yellow-400 hover:underline">
                Sign in
              </button>
            </p>
          ) : (
            <p className="text-muted-foreground">
              New to ClassClash?{" "}
              <button onClick={() => navigate("/register")} className="font-bold text-yellow-400 hover:underline">
                Create an account
              </button>
            </p>
          )}
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border/70" /> or <span className="h-px flex-1 bg-border/70" />
        </div>

        <button
          onClick={() => navigate("/quiz/guest")}
          className="cc-tap flex w-full items-center justify-center gap-2 rounded-2xl border border-border/70 bg-secondary/50 font-semibold text-foreground/90 hover:bg-secondary"
        >
          <Play size={16} className="my-3 text-emerald-400" aria-hidden />
          <span className="my-3">Try a sample quiz (no account)</span>
        </button>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Forgot your password? Email support is not enabled yet —
          contact your teacher or platform support to reset it.
        </p>
      </div>
    </div>
  );
}

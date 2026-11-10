"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator, BookOpen, Microscope, Wrench, Scale, Globe2, Monitor,
  Atom, Orbit, Leaf, TrendingUp, Flame, Crown, Star, Zap, Trophy,
  Flag, Target, Swords, Users, RotateCcw,
  Shield, CalendarCheck, ListChecks, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/lib/clash/avatars";
import { cn } from "@/lib/utils";

// ── Subject icon mapping ─────────────────────────────────────

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  calculator: Calculator,
  "book-open": BookOpen,
  microscope: Microscope,
  wrench: Wrench,
  scale: Scale,
  "globe-2": Globe2,
  monitor: Monitor,
  atom: Atom,
  orbit: Orbit,
  leaf: Leaf,
  "trending-up": TrendingUp,
  // badges
  flag: Flag, target: Target, flame: Flame, zap: Zap, trophy: Trophy,
  swords: Swords, users: Users, "rotate-ccw": RotateCcw, crown: Crown,
  shield: Shield, "calendar-check": CalendarCheck, "list-checks": ListChecks,
  star: Star, sparkles: Sparkles,
};

export function SubjectIcon({
  icon,
  color,
  size = 22,
  className,
}: {
  icon: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const Icon = SUBJECT_ICONS[icon] ?? Sparkles;
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-lg", className)}
      style={{ width: size * 1.7, height: size * 1.7, background: (color ?? "#f59e0b") + "22" }}
    >
      <Icon size={size} style={{ color: color ?? "#f59e0b" }} aria-hidden />
    </span>
  );
}

// ── Level badge ──────────────────────────────────────────────

export function LevelBadge({ level, size = 34 }: { level: number | null; size?: number }) {
  if (level === null) return <span className="text-xs text-muted-foreground">Bot</span>;
  return (
    <span
      className="relative inline-flex items-center justify-center font-display font-bold"
      style={{ width: size, height: size }}
      aria-label={`Level ${level}`}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} className="absolute inset-0">
        <path
          d="M20 2 L34 11 L34 29 L20 38 L6 29 L6 11 Z"
          fill="url(#lvlg)"
          stroke="#f5c518"
          strokeWidth="1.5"
        />
        <defs>
          <linearGradient id="lvlg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <span className="relative text-white" style={{ fontSize: size * 0.38 }}>
        {level}
      </span>
    </span>
  );
}

// ── XP bar ───────────────────────────────────────────────────

export function XPBar({
  pct,
  level,
  intoLevel,
  needed,
  compact,
}: {
  pct: number;
  level: number;
  intoLevel?: number;
  needed?: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("w-full", compact ? "" : "space-y-1")}>
      {!compact && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground/90">Level {level}</span>
          <span className="text-muted-foreground">
            {intoLevel !== undefined && needed !== undefined ? `${intoLevel}/${needed} XP` : ""}
          </span>
        </div>
      )}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="XP progress"
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(3, pct)}%`,
            background: "linear-gradient(90deg, #f5c518, #f97316)",
            boxShadow: "0 0 10px #f5c51866",
          }}
        />
      </div>
    </div>
  );
}

// ── Streak flame ─────────────────────────────────────────────

export function StreakFlame({ count, size = 18 }: { count: number; size?: number }) {
  if (!count) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-bold text-orange-400"
      title={`${count}-day learning streak`}
    >
      <Flame size={size} className="text-orange-400" aria-hidden />
      {count}
    </span>
  );
}

// ── Champion crown chip ──────────────────────────────────────

export function ChampionCrown({
  name,
  avatar,
  subjectName,
  isMe,
  onOpen,
  defences,
  size = 44,
}: {
  name: string;
  avatar: string;
  subjectName: string;
  isMe?: boolean;
  onOpen?: () => void;
  defences?: number;
  size?: number;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
        "border-yellow-500/25 bg-gradient-to-r from-yellow-500/10 to-transparent hover:border-yellow-500/50 hover:from-yellow-500/15",
        isMe && "cc-champion-glow"
      )}
    >
      <div className="relative">
        <Avatar avatar={avatar} size={size} ring="#f5c518" />
        <Crown
          size={18}
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-yellow-400 drop-shadow"
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-bold text-foreground">{subjectName}</div>
        <div className="truncate text-xs text-muted-foreground">
          {isMe ? "You hold this crown!" : `${name}${defences ? ` • ${defences} defences` : ""}`}
        </div>
      </div>
      <span className="rounded-lg bg-yellow-500/15 px-2.5 py-1 text-xs font-bold text-yellow-400">
        {isMe ? "Champion" : "Challenge"}
      </span>
    </button>
  );
}

// ── Circular timer ───────────────────────────────────────────

export function TimerRing({
  secondsLeft,
  total,
  size = 54,
}: {
  secondsLeft: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? secondsLeft / total : 0;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const danger = secondsLeft <= 5;
  return (
    <div
      className="relative"
      role="timer"
      aria-label={`${secondsLeft} seconds left`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={danger ? "#ef4444" : "#f5c518"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.95s linear, stroke 0.3s" }}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-display font-bold",
          danger ? "text-red-400" : "text-foreground"
        )}
        style={{ fontSize: size * 0.32 }}
      >
        {secondsLeft}
      </span>
    </div>
  );
}

// ── Confetti (CSS-only, reduced-motion aware) ────────────────

export function Confetti({ burstKey }: { burstKey: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        dur: 1.8 + Math.random() * 1.6,
        color: ["#f5c518", "#f97316", "#a855f7", "#34d399", "#f472b6"][i % 5],
        w: 6 + Math.random() * 6,
      })),
    [burstKey]
  );
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={`${burstKey}-${i}`}
          className="cc-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 1.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── States ───────────────────────────────────────────────────

export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center">
      <span className="mb-3 rounded-2xl bg-secondary p-3">
        <Icon size={26} className="text-muted-foreground" aria-hidden />
      </span>
      <p className="font-display font-semibold">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-center" role="alert">
      <p className="text-sm font-medium text-red-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="cc-tap mt-3 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold hover:bg-secondary/70"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function LoadingCard({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/50 p-8">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"
        aria-hidden
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/50" />
      ))}
    </div>
  );
}

// ── Section header ───────────────────────────────────────────

export function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        {Icon && <Icon size={19} className="text-yellow-400" aria-hidden />}
        {title}
      </h2>
      {action}
    </div>
  );
}

// ── Countdown hook (client timer with drift correction) ──────

export function useCountdown(totalSeconds: number, running: boolean, onEnd?: () => void) {
  const [left, setLeft] = useState(totalSeconds);
  const endRef = useRef<number>(0);
  const endCb = useRef(onEnd);

  useEffect(() => {
    endCb.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!running) return;
    endRef.current = Date.now() + totalSeconds * 1000;
    setLeft(totalSeconds);
    const iv = setInterval(() => {
      const remain = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(remain);
      if (remain <= 0) {
        clearInterval(iv);
        endCb.current?.();
      }
    }, 250);
    return () => clearInterval(iv);
     
  }, [running, totalSeconds]);

  const elapsedMs = () => (totalSeconds - left) * 1000;
  return { left, elapsedMs };
}

// ── Safe display of points & accuracy ────────────────────────

export function Pill({
  children,
  color = "default",
  className,
}: {
  children: React.ReactNode;
  color?: "default" | "gold" | "green" | "red" | "violet" | "orange";
  className?: string;
}) {
  const colors: Record<string, string> = {
    default: "bg-secondary text-foreground/80",
    gold: "bg-yellow-500/15 text-yellow-400",
    green: "bg-emerald-500/15 text-emerald-400",
    red: "bg-red-500/15 text-red-400",
    violet: "bg-violet-500/15 text-violet-300",
    orange: "bg-orange-500/15 text-orange-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        colors[color],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { label: string; color: "green" | "red" | "violet" }> = {
    win: { label: "WIN", color: "green" },
    loss: { label: "LOSS", color: "red" },
    draw: { label: "DRAW", color: "violet" },
  };
  const r = map[result] ?? map.draw;
  return <Pill color={r.color}>{r.label}</Pill>;
}

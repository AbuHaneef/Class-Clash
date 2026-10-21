"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate, absoluteUrl } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import { SubjectIcon, LoadingCard, EmptyState, Pill, SectionTitle, ResultBadge } from "@/components/clash/shared";
import { toast } from "sonner";
import {
  Swords, Plus, Search, Link2, Check, X, ChevronRight, Users, Trophy, Crown, Ban, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Challenge = {
  id: string; code: string; type: string; status: string; isLive?: boolean;
  subject: { id: string; name: string; color: string; icon: string };
  gradeName: string;
  opponent: { id: string; displayName: string; avatar: string; isBot: boolean } | null;
  openInvite: boolean;
  iAmCreator: boolean;
  expiresAt: string; createdAt: string;
  draw: boolean; winnerId: string | null; iWon: boolean;
  myScore: number | null; theirScore: number | null;
  iPlayed: boolean; theyPlayed: boolean;
};

type Classmate = {
  id: string; displayName: string; avatar: string; rating: number;
  level: number; streak: number; titles: number; isRival: boolean;
};

export default function DuelsView() {
  const me = useClash((s) => s.me);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; icon: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"challenges" | "new">("challenges");
  const [query, setQuery] = useState("");
  const [duelSubject, setDuelSubject] = useState<string | null>(null);
  const [duelOpponent, setDuelOpponent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, cm, st] = await Promise.all([
      apiGet<{ challenges: Challenge[] }>("/challenges"),
      apiGet<{ classmates: Classmate[] }>(`/classmates${query ? `?q=${encodeURIComponent(query)}` : ""}`),
      apiGet<{ structure: { subjects: { id: string; name: string; icon: string; color: string }[]; subjectGrades: { subjectId: string; gradeId: string }[] } }>("/structure"),
    ]);
    if (c.ok) setChallenges((c as unknown as { challenges: Challenge[] }).challenges);
    if (cm.ok) setClassmates((cm as unknown as { classmates: Classmate[] }).classmates);
    if (st.ok) {
      const s = st.structure;
      const myIds = new Set(s.subjectGrades.filter((sg) => sg.gradeId === me?.gradeId).map((sg) => sg.subjectId));
      setSubjects(s.subjects.filter((x) => myIds.has(x.id)));
    }
    setLoading(false);
  }, [query, me?.gradeId]);

  useEffect(() => {
    load();
  }, [load]);

  const createDuel = async (open: boolean) => {
    if (!duelSubject) return toast.error("Pick a subject first.");
    if (!open && !duelOpponent) return toast.error("Pick an opponent.");
    setBusy(true);
    const r = await apiSend<{ challenge: { id: string; code: string } }>("POST", "/challenges", {
      type: "duel",
      subjectId: duelSubject,
      ...(open ? {} : { opponentId: duelOpponent }),
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    const ch = (r as unknown as { challenge: { id: string; code: string } }).challenge;
    if (open) {
      const url = absoluteUrl(`/join/${ch.code}`);
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast.success(`Invite link copied! Code: ${ch.code}`);
    } else {
      toast("Challenge sent! Waiting for their reply.");
    }
    setTab("challenges");
    load();
  };

  const act = async (id: string, action: "accept" | "decline" | "cancel") => {
    const r = await apiSend("POST", `/challenges/${id}/action`, { action });
    if (!r.ok) return toast.error(r.error);
    toast(action === "accept" ? "Challenge accepted — let's clash!" : action === "decline" ? "Declined." : "Cancelled.");
    load();
  };

  if (loading) return <LoadingCard label="Loading your duels…" />;

  const active = challenges.filter((c) => ["pending", "accepted", "in_progress"].includes(c.status));
  const history = challenges.filter((c) => ["completed", "expired", "declined", "cancelled"].includes(c.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Duels & Challenges</h1>
          <p className="text-sm text-muted-foreground">Head-to-head battles with your classmates.</p>
        </div>
        <div className="flex rounded-2xl bg-secondary/60 p-1" role="tablist">
          {(["challenges", "new"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "cc-tap rounded-xl px-4 text-sm font-bold transition-colors",
                tab === t ? "bg-yellow-500/20 text-yellow-300" : "text-muted-foreground"
              )}
            >
              {t === "challenges" ? "My challenges" : "New duel"}
            </button>
          ))}
        </div>
      </div>

      {/* live duels entry point */}
      <button
        onClick={() => navigate("/live")}
        className="cc-tap group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl border-2 border-pink-500/40 bg-gradient-to-r from-pink-500/15 via-rose-500/10 to-transparent p-4 text-left transition-all hover:border-pink-500 active:scale-[0.99]"
      >
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg">
          <Radio size={22} aria-hidden />
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-display font-bold">
            Live Duels — play in real time
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> LIVE
            </span>
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            Same questions, same clock, instant results. Quick Match, Live Trainer bots or friend rooms.
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-pink-400 transition-transform group-hover:translate-x-1" aria-hidden />
      </button>

      {tab === "new" ? (
        <section className="space-y-5 rounded-3xl border border-border/60 bg-card/70 p-5">
          {/* subject picker */}
          <div>
            <p className="mb-2 text-sm font-semibold">1. Choose the battlefield</p>
            <div className="cc-scroll flex gap-2 overflow-x-auto pb-1">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDuelSubject(s.id)}
                  className={cn(
                    "cc-tap flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3.5 py-2 text-sm font-bold transition-all",
                    duelSubject === s.id ? "border-yellow-400 bg-yellow-500/10" : "border-border/60 bg-secondary/40"
                  )}
                >
                  <SubjectIcon icon={s.icon} color={s.color} size={17} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* opponent picker */}
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              2. Choose an opponent <span className="text-xs font-normal text-muted-foreground">(same class only)</span>
            </p>
            <div className="mb-3 flex items-center rounded-xl border border-input bg-secondary/40 px-3">
              <Search size={15} className="text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search classmates…"
                className="cc-tap w-full bg-transparent px-2.5 py-2 text-sm outline-none"
              />
            </div>
            <div className="cc-scroll max-h-80 space-y-2 overflow-y-auto pr-1">
              {classmates.length === 0 ? (
                <EmptyState icon={Users} title="No classmates found" description="Invite friends with an open challenge link, or ask classmates to join ClassClash!" />
              ) : (
                classmates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setDuelOpponent(duelOpponent === c.id ? null : c.id)}
                    className={cn(
                      "cc-tap flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all",
                      duelOpponent === c.id ? "border-pink-500 bg-pink-500/10" : "border-transparent bg-secondary/40 hover:border-border"
                    )}
                  >
                    <Avatar avatar={c.avatar} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{c.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        Lv {c.level} • Rating {c.rating}{c.titles > 0 ? ` • ${c.titles}👑` : ""}
                      </p>
                    </div>
                    {duelOpponent === c.id && <Check size={18} className="text-pink-400" aria-hidden />}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={() => createDuel(false)}
              disabled={busy || !duelSubject || !duelOpponent}
              className="cc-tap flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 font-display font-bold text-white active:scale-95 disabled:opacity-40"
            >
              <Swords size={17} aria-hidden /> <span className="my-3">Send challenge</span>
            </button>
            <button
              onClick={() => createDuel(true)}
              disabled={busy || !duelSubject}
              className="cc-tap flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 font-bold hover:bg-secondary active:scale-95 disabled:opacity-40"
            >
              <Link2 size={16} aria-hidden /> <span className="my-3">Create open invite link</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Open invites can be claimed by any classmate with the link — share the code anywhere.
            Challenges expire after 48h if not accepted.
          </p>
        </section>
      ) : (
        <>
          {/* active */}
          <section>
            <SectionTitle icon={Swords} title={`Active (${active.length})`} />
            {active.length === 0 ? (
              <EmptyState icon={Swords} title="No active challenges" description="Start a duel from the New duel tab, or challenge a champion from the Champions page." action={<button onClick={() => setTab("new")} className="cc-tap rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white">New duel</button>} />
            ) : (
              <div className="space-y-2.5">
                {active.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
                    <div className="flex items-center gap-3">
                      {c.openInvite && c.iAmCreator ? (
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary"><Link2 size={19} className="text-muted-foreground" aria-hidden /></span>
                      ) : (
                        <Avatar avatar={c.opponent?.avatar ?? "fox"} size={44} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">
                          {c.type === "champion" && <Crown size={13} className="mr-1 inline text-yellow-400" aria-hidden />}
                          {c.subject.name} vs {c.openInvite && c.iAmCreator ? "open invite" : c.opponent?.displayName ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.gradeName} • {statusLabel(c)} • expires {new Date(c.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!c.iAmCreator && c.status === "pending" && (
                          <>
                            <button onClick={() => act(c.id, "accept")} className="cc-tap rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 active:scale-95">Accept</button>
                            <button onClick={() => act(c.id, "decline")} className="cc-tap rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 active:scale-95">Decline</button>
                          </>
                        )}
                        {c.iAmCreator && c.status === "pending" && (
                          <button onClick={() => act(c.id, "cancel")} className="cc-tap rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-muted-foreground active:scale-95">Cancel</button>
                        )}
                        {["accepted", "in_progress"].includes(c.status) && (
                          <button onClick={() => navigate(`/duel/${c.id}`)} className="cc-tap rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-2 text-xs font-bold text-yellow-950 active:scale-95">
                            {c.iPlayed ? "View" : "Play"}
                          </button>
                        )}
                      </div>
                    </div>
                    {c.openInvite && c.iAmCreator && c.status === "pending" && (
                      <button
                        onClick={() => {
                          const url = absoluteUrl(`/join/${c.code}`);
                          navigator.clipboard?.writeText(url).then(() => toast("Invite link copied!")).catch(() => toast(url));
                        }}
                        className="cc-tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                      >
                        <Link2 size={13} aria-hidden /> Copy invite link — code {c.code}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* history */}
          {history.length > 0 && (
            <section>
              <SectionTitle icon={Trophy} title="History" />
              <div className="space-y-2.5">
                {history.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/duel/${c.id}`)}
                    className="cc-tap flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-3 text-left hover:border-border"
                  >
                    <Avatar avatar={c.opponent?.avatar ?? "fox"} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {c.type === "champion" && <Crown size={12} className="mr-1 inline text-yellow-400" aria-hidden />}
                        {c.isLive && (
                          <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black text-red-400">
                            <span className="h-1 w-1 rounded-full bg-red-500" />LIVE
                          </span>
                        )}
                        {c.subject.name} vs {c.opponent?.displayName ?? "open"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.myScore !== null ? `${c.myScore} – ${c.theirScore}` : statusLabel(c)}
                      </p>
                    </div>
                    {c.status === "completed" ? <ResultBadge result={c.iWon ? "win" : c.draw ? "draw" : "loss"} /> : <Pill>{statusLabel(c)}</Pill>}
                    <ChevronRight size={16} className="text-muted-foreground" aria-hidden />
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* rivalries note */}
      <section className="rounded-2xl border border-border/50 bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-1.5 font-semibold text-foreground/80">
          <Ban size={13} aria-hidden /> Safety first
        </p>
        ClassClash has no open chat or direct messages. You can only interact through challenges.
        Report anything strange from a profile page — reports go straight to moderators.
      </section>
    </div>
  );
}

function statusLabel(c: Challenge): string {
  if (c.openInvite && c.status === "pending") return "Waiting for a challenger to claim";
  const map: Record<string, string> = {
    pending: c.iAmCreator ? "Waiting for reply" : "They're waiting for you",
    accepted: "Ready to play",
    in_progress: "In progress",
    completed: "Completed",
    expired: "Expired",
    declined: "Declined",
    cancelled: "Cancelled",
  };
  return map[c.status] ?? c.status;
}

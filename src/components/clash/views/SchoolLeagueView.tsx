"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import { LoadingCard, EmptyState, Pill, SectionTitle, LevelBadge, ResultBadge } from "@/components/clash/shared";
import { toast } from "sonner";
import {
  School, Users, Crown, LogIn, LogOut, Plus, Copy, ChevronDown, ChevronRight,
  Trophy, Medal, Sparkles, Swords, Radio, Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── types ────────────────────────────────────────────────────

type LeagueRow = {
  id: string;
  rank: number;
  name: string;
  motto: string | null;
  color: string;
  joinCode: string | null;
  memberCount: number;
  totalPoints: number;
  crowns: number;
  topContributor: { displayName: string; avatar: string; points: number } | null;
  isMySchool: boolean;
  demoSquad: boolean;
};

type MySchool = {
  id: string;
  name: string;
  motto: string | null;
  color: string;
  joinCode: string;
  memberCount: number;
  totalPoints: number;
  crowns: number;
  rank: number | null;
  topContributor: { displayName: string; avatar: string; points: number } | null;
  demoSquad: boolean;
};

type SchoolDetail = {
  school: {
    id: string;
    name: string;
    motto: string | null;
    color: string;
    joinCode: string | null;
    memberCount: number;
    totalPoints: number;
    crowns: number;
    rank: number | null;
    demoSquad: boolean;
  };
  members: {
    id: string;
    displayName: string;
    avatar: string;
    isBot: boolean;
    gradeName: string | null;
    level: number | null;
    rating: number;
    seasonPoints: number;
    titles: number;
  }[];
  feed: {
    id: string;
    subjectName: string;
    isLive: boolean;
    result: string;
    score: number;
    opponentScore: number;
    player: { displayName: string; avatar: string };
    opponent: { displayName: string; avatar: string; isMember: boolean };
    at: string;
  }[];
};

// ── view ─────────────────────────────────────────────────────

export default function SchoolLeagueView() {
  const me = useClash((s) => s.me);
  const fetchMe = useClash((s) => s.fetchMe);

  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<LeagueRow[]>([]);
  const [mySchool, setMySchool] = useState<MySchool | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // join/create forms
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMotto, setNewMotto] = useState("");
  const [newColor, setNewColor] = useState<string>("");

  const load = useCallback(async () => {
    const r = await apiGet<{ table: LeagueRow[]; mySchool: MySchool | null; colors: string[] }>("/schools");
    if (r.ok) {
      const d = r as unknown as { table: LeagueRow[]; mySchool: MySchool | null; colors: string[] };
      setTable(d.table);
      setMySchool(d.mySchool);
      setColors(d.colors);
      if (!newColor && d.colors.length) setNewColor(d.colors[0]);
    }
    setLoading(false);
  }, [newColor]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    if (detail?.school.id === id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    const r = await apiGet<SchoolDetail>(`/schools/${id}`);
    if (r.ok) setDetail((r as unknown as SchoolDetail));
    else toast.error(r.error);
    setDetailLoading(false);
  };

  const doJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return toast.error("Enter your school's join code.");
    setBusy(true);
    const r = await apiSend<{ school: { name: string } }>("POST", "/schools/join", { code });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`You joined ${(r as unknown as { school: { name: string } }).school.name}!`);
    setJoinCode("");
    fetchMe();
    load();
  };

  const doCreate = async () => {
    if (newName.trim().length < 4) return toast.error("School name must be at least 4 characters.");
    setBusy(true);
    const r = await apiSend<{ school: { name: string; joinCode: string } }>("POST", "/schools", {
      name: newName.trim(),
      motto: newMotto.trim() || undefined,
      color: newColor,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    const s = (r as unknown as { school: { name: string; joinCode: string } }).school;
    toast.success(`${s.name} founded! Share join code ${s.joinCode}.`);
    setShowCreate(false);
    setNewName("");
    setNewMotto("");
    fetchMe();
    load();
  };

  const doLeave = async () => {
    setBusy(true);
    const r = await apiSend("POST", "/schools/leave");
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast("You left your school.");
    setDetail(null);
    fetchMe();
    load();
  };

  if (loading) return <LoadingCard label="Loading the school league…" />;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg">
              <Flag size={18} aria-hidden />
            </span>
            School Leagues
          </h1>
          <p className="text-sm text-muted-foreground">
            Every duel, champion match and live win scores points for your school.
          </p>
        </div>
        <Pill color="gold">
          <Trophy size={12} aria-hidden /> 2026 Season
        </Pill>
      </div>

      {/* my school */}
      {mySchool ? (
        <section className="relative overflow-hidden rounded-3xl border p-5" style={{ borderColor: mySchool.color + "55", background: `linear-gradient(135deg, ${mySchool.color}14, transparent 60%)` }}>
          <div className="flex flex-wrap items-center gap-4">
            <SchoolCrest name={mySchool.name} color={mySchool.color} size={58} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold">{mySchool.name}</h2>
                {mySchool.rank !== null && (
                  <Pill color="gold">
                    <Medal size={12} aria-hidden /> League #{mySchool.rank}
                  </Pill>
                )}
                {mySchool.demoSquad && <Pill>Seeded squad</Pill>}
              </div>
              {mySchool.motto && <p className="text-xs italic text-muted-foreground">“{mySchool.motto}”</p>}
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{mySchool.totalPoints} league pts</span>
                <span className="flex items-center gap-1"><Users size={12} aria-hidden /> {mySchool.memberCount} members</span>
                <span className="flex items-center gap-1"><Crown size={12} aria-hidden /> {mySchool.crowns} crowns</span>
                {mySchool.topContributor && (
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} aria-hidden /> Top: {mySchool.topContributor.displayName} ({mySchool.topContributor.points})
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {mySchool.joinCode && (
                <button
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(mySchool.joinCode!)
                      .then(() => toast(`Join code copied: ${mySchool.joinCode}`))
                      .catch(() => toast(`Join code: ${mySchool.joinCode}`));
                  }}
                  className="cc-tap flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs font-bold hover:text-foreground"
                >
                  <Copy size={12} aria-hidden /> Code {mySchool.joinCode}
                </button>
              )}
              <button
                onClick={doLeave}
                disabled={busy}
                className="cc-tap flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground/70 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={12} aria-hidden /> Leave school
              </button>
            </div>
          </div>
        </section>
      ) : me ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {/* join */}
          <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
            <p className="flex items-center gap-2 font-display font-bold">
              <LogIn size={17} className="text-yellow-400" aria-hidden /> Join your school
            </p>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Got a join code from a classmate or teacher? Enter it here.
            </p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && doJoin()}
                placeholder="ABC123"
                maxLength={6}
                aria-label="School join code"
                className="cc-tap min-w-0 flex-1 rounded-xl border border-input bg-secondary/40 px-4 py-3 text-center font-display text-lg tracking-[0.3em] outline-none"
              />
              <button
                onClick={doJoin}
                disabled={busy}
                className="cc-tap rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-5 font-bold text-yellow-950 active:scale-95 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>

          {/* create */}
          <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
            <p className="flex items-center gap-2 font-display font-bold">
              <Plus size={17} className="text-emerald-400" aria-hidden /> Found a new school
            </p>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Be the founder — create your school, share the code, and climb the league together.
            </p>
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="cc-tap w-full rounded-xl border-2 border-dashed border-emerald-500/40 py-3 font-bold text-emerald-400 hover:bg-emerald-500/10 active:scale-[0.98]"
              >
                Create a school
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Springfield High"
                  maxLength={40}
                  aria-label="School name"
                  className="cc-tap w-full rounded-xl border border-input bg-secondary/40 px-4 py-2.5 text-sm outline-none"
                />
                <input
                  value={newMotto}
                  onChange={(e) => setNewMotto(e.target.value)}
                  placeholder="Motto (optional)"
                  maxLength={80}
                  aria-label="School motto"
                  className="cc-tap w-full rounded-xl border border-input bg-secondary/40 px-4 py-2.5 text-sm outline-none"
                />
                <div className="flex items-center gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      aria-label={`Crest colour ${c}`}
                      className={cn(
                        "cc-tap h-8 w-8 rounded-full border-2 transition-transform",
                        newColor === c ? "scale-110 border-foreground" : "border-transparent"
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={doCreate}
                    disabled={busy}
                    className="cc-tap flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 font-bold text-white active:scale-95 disabled:opacity-50"
                  >
                    Found it!
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="cc-tap rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold text-muted-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={School}
          title="Sign in to represent your school"
          description="Create or join a school with a code, then every win pushes your school up the league."
          action={
            <button onClick={() => navigate("/login")} className="cc-tap rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-2.5 font-bold text-yellow-950">
              Sign in
            </button>
          }
        />
      )}

      {/* league table */}
      <section>
        <SectionTitle icon={Trophy} title={`League table (${table.length} schools)`} />
        {table.length === 0 ? (
          <EmptyState icon={School} title="No schools yet" description="Be the first — found a school and top the table!" />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/70">
            <div className="grid grid-cols-[2.6rem_1fr_auto] items-center gap-2 border-b border-border/50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[3rem_1fr_4.5rem_4rem_5.5rem]">
              <span className="text-center">#</span>
              <span>School</span>
              <span className="hidden text-center sm:block">Members</span>
              <span className="hidden text-center sm:block">Crowns</span>
              <span className="text-right">Points</span>
            </div>
            {table.map((row) => (
              <div key={row.id}>
                <button
                  onClick={() => openDetail(row.id)}
                  className={cn(
                    "grid w-full grid-cols-[2.6rem_1fr_auto] items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary/40 sm:grid-cols-[3rem_1fr_4.5rem_4rem_5.5rem]",
                    row.isMySchool && "bg-yellow-500/8"
                  )}
                  aria-expanded={detail?.school.id === row.id}
                >
                  <span className="flex items-center justify-center">
                    <RankBadge rank={row.rank} />
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <SchoolCrest name={row.name} color={row.color} size={34} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{row.name}</span>
                        {row.isMySchool && <Pill color="gold" className="!px-1.5 !py-0 !text-[10px]">Yours</Pill>}
                        {row.demoSquad && <Pill className="!px-1.5 !py-0 !text-[10px]">Seeded squad</Pill>}
                      </span>
                      {row.topContributor && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          Top: {row.topContributor.displayName} · {row.topContributor.points} pts
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="hidden items-center justify-center gap-1 text-center text-xs text-muted-foreground sm:flex">
                    <Users size={12} aria-hidden /> {row.memberCount}
                  </span>
                  <span className="hidden items-center justify-center gap-1 text-center text-xs text-muted-foreground sm:flex">
                    <Crown size={12} aria-hidden /> {row.crowns}
                  </span>
                  <span className="text-right">
                    <span className="font-display text-base font-bold tabular-nums text-yellow-300">{row.totalPoints}</span>
                    {detail?.school.id === row.id ? (
                      <ChevronDown size={14} className="ml-1 inline text-muted-foreground" aria-hidden />
                    ) : (
                      <ChevronRight size={14} className="ml-1 inline text-muted-foreground" aria-hidden />
                    )}
                  </span>
                </button>
                {detail?.school.id === row.id && <SchoolDetailBody detail={detail} />}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          League points = the season points your members earn in duels, champion matches and live duels
          (win 3 · draw 2 · loss 1). Seeded squads are rival schools staffed by Guardian bots — beat their scores!
        </p>
      </section>
    </div>
  );
}

// ── sub components ───────────────────────────────────────────

function SchoolCrest({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span
      className="flex shrink-0 items-center justify-center font-display font-black"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
        color: "#1a1a1a",
        fontSize: size * 0.36,
        boxShadow: `0 4px 14px -4px ${color}66`,
      }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={20} className="text-yellow-400" aria-label="1st place" />;
  if (rank === 2) return <Medal size={19} className="text-zinc-300" aria-label="2nd place" />;
  if (rank === 3) return <Medal size={19} className="text-amber-600" aria-label="3rd place" />;
  return <span className="font-display text-sm font-bold text-muted-foreground">{rank}</span>;
}

function SchoolDetailBody({ detail }: { detail: SchoolDetail }) {
  const s = detail.school;
  return (
    <div className="border-t border-border/40 bg-secondary/25 px-4 py-4 sm:px-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* members */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Squad ({s.memberCount})
          </p>
          <div className="cc-scroll max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {detail.members.map((m, i) => (
              <button
                key={m.id}
                onClick={() => navigate(`/profile/${m.id}`)}
                className="cc-tap flex w-full items-center gap-2.5 rounded-xl bg-card/70 p-2 text-left hover:bg-card"
              >
                <span className="w-5 text-center font-display text-xs font-bold text-muted-foreground">{i + 1}</span>
                <Avatar avatar={m.avatar} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{m.displayName}</span>
                    {m.titles > 0 && <Crown size={12} className="text-yellow-400" aria-hidden />}
                    {m.isBot && <Pill className="!px-1.5 !py-0 !text-[10px]">bot</Pill>}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {m.gradeName ?? "—"} · Rating {m.rating}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-display text-sm font-bold text-yellow-300">{m.seasonPoints}</span>
                  <span className="block text-[10px] text-muted-foreground">pts</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* recent form */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent form</p>
          {detail.feed.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              No matches yet — this school&apos;s players haven&apos;t clashed anyone.
            </p>
          ) : (
            <div className="cc-scroll max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {detail.feed.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 rounded-xl bg-card/70 p-2">
                  <Avatar avatar={f.player.avatar} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">
                      {f.player.displayName} <span className="text-muted-foreground">vs</span> {f.opponent.displayName}
                      {f.opponent.isMember && <span className="text-emerald-400"> (schoolmate)</span>}
                    </p>
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {f.isLive && <Radio size={10} className="text-pink-400" aria-hidden />}
                      {f.subjectName} · {f.score}–{f.opponentScore}
                    </p>
                  </div>
                  <ResultBadge result={f.result} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet } from "@/lib/clash/client/api";
import { Avatar } from "@/lib/clash/avatars";
import { SubjectIcon, Pill } from "@/components/clash/shared";
import { Crown, Swords, Trophy, Zap, Flame, ArrowRight, Sparkles, GraduationCap, Medal, Radio, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

type Structure = {
  subjects: { id: string; name: string; icon: string; color: string; description: string }[];
  announcements: { title: string; body: string }[];
};

export default function LandingView() {
  const [structure, setStructure] = useState<Structure | null>(null);

  useEffect(() => {
    apiGet<{ structure: Structure }>("/structure").then((r) => {
      if (r.ok) setStructure(r.structure);
    });
  }, []);

  return (
    <div className="space-y-14 pb-8">
      {/* ── Hero ── */}
      <section className="cc-hero-bg relative overflow-hidden rounded-3xl border border-border/60 px-6 py-12 text-center sm:px-10 sm:py-16">
        <Pill color="gold" className="mx-auto mb-5">
          <Sparkles size={13} aria-hidden /> Championship quiz arena for schools
        </Pill>
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">
          Your Class. Your Subject.{" "}
          <span className="cc-gradient-text">Your Crown.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
          Test what you know, challenge your rivals, and become the champion of
          your favourite subject. Learn. Challenge. Climb.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={() => navigate("/register")}
            className="cc-tap cc-pulse-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-8 font-display text-lg font-bold text-yellow-950 shadow-xl shadow-orange-500/25 transition-transform hover:scale-[1.02] active:scale-95 sm:w-auto"
          >
            <Swords size={20} aria-hidden /> Play Now — Free
          </button>
          <button
            onClick={() => navigate("/champions")}
            className="cc-tap flex w-full items-center justify-center gap-2 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-8 font-display text-lg font-bold text-yellow-300 transition-colors hover:bg-yellow-500/20 sm:w-auto"
          >
            <Crown size={20} aria-hidden /> Explore Champions
          </button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          No app install needed — plays right in your browser. Guest preview available.
        </p>

        {/* floating trophy cluster */}
        <div className="pointer-events-none absolute -left-6 top-8 hidden opacity-70 lg:block" aria-hidden>
          <div className="cc-float rounded-2xl border border-border/70 bg-card/80 p-4 shadow-xl">
            <Trophy size={28} className="text-yellow-400" />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-4 bottom-10 hidden opacity-70 lg:block" aria-hidden>
          <div className="cc-float flex items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 shadow-xl" style={{ animationDelay: "1.2s" }}>
            <Flame size={22} className="text-orange-400" />
            <span className="font-display text-sm font-bold">7-day streak</span>
          </div>
        </div>
      </section>

      {/* ── Announcement ── */}
      {structure?.announcements?.[0] && (
        <section className="rounded-2xl border border-yellow-500/25 bg-yellow-500/8 px-5 py-4">
          <p className="font-display font-bold text-yellow-300">📣 {structure.announcements[0].title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{structure.announcements[0].body}</p>
        </section>
      )}

      {/* ── How it works ── */}
      <section>
        <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">How the clash works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: GraduationCap,
              title: "1. Learn",
              text: "Practise real curriculum questions topic by topic, with instant explanations for every answer.",
              color: "#34d399",
            },
            {
              icon: Swords,
              title: "2. Challenge",
              text: "Enter the Quick Arena, duel classmates, or challenge the reigning champion of your subject.",
              color: "#f5c518",
            },
            {
              icon: Crown,
              title: "3. Become Champion",
              text: "Win a Champion Challenge and the crown is yours — until a classmate takes it from you.",
              color: "#a855f7",
            },
          ].map((s) => (
            <div key={s.title} className="rounded-2xl border border-border/60 bg-card/70 p-5 cc-card-glow">
              <span
                className="mb-3 inline-flex rounded-xl p-2.5"
                style={{ background: s.color + "1f" }}
              >
                <s.icon size={22} style={{ color: s.color }} aria-hidden />
              </span>
              <h3 className="font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Subjects ── */}
      <section>
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Subjects you can master</h2>
          <button
            onClick={() => navigate("/subjects")}
            className="flex items-center gap-1 text-sm font-semibold text-yellow-400 hover:underline"
          >
            Browse all <ArrowRight size={15} aria-hidden />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(structure?.subjects ?? []).slice(0, 8).map((s) => (
            <div key={s.id} className="rounded-2xl border border-border/60 bg-card/70 p-4 transition-colors hover:border-border">
              <SubjectIcon icon={s.icon} color={s.color} size={24} />
              <p className="mt-2.5 font-display text-sm font-bold">{s.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Champions preview ── */}
      <ChampionsPreview />

      {/* ── Game modes ── */}
      <section>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Eight ways to play</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Radio, name: "Live Duels", desc: "Real-time battles — same questions, same clock, instant results.", hot: true },
            { icon: Flag, name: "School Leagues", desc: "Found or join a school. Every win lifts your school up the table.", hot: true },
            { icon: Zap, name: "Quick Arena", desc: "7 rapid-fire timed questions. Pure clash." },
            { icon: Swords, name: "1v1 Duels", desc: "Head-to-head against a classmate. Same questions, one winner." },
            { icon: Crown, name: "Champion Challenge", desc: "Face the reigning champion. Beat them, take the crown." },
            { icon: GraduationCap, name: "Topic Practice", desc: "Learn at your own pace with instant explanations." },
            { icon: Medal, name: "Daily Challenge", desc: "One shot every day. Climb your class daily board." },
            { icon: Trophy, name: "Tournaments", desc: "Bracket battles for ultimate glory. (Beta)" },
          ].map((m) => (
            <div key={m.name} className={cn("relative flex gap-3 rounded-2xl border p-4", "hot" in m && m.hot ? "border-pink-500/40 bg-gradient-to-b from-pink-500/10 to-transparent" : "border-border/60 bg-card/70")}>
              <m.icon size={22} className={cn("mt-0.5 shrink-0", "hot" in m && m.hot ? "text-pink-400" : "text-yellow-400")} aria-hidden />
              <div>
                <p className="font-display font-bold">
                  {m.name}{"hot" in m && m.hot && (
                    <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 align-middle text-[9px] font-black text-red-400">NEW</span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/12 via-transparent to-orange-500/10 px-6 py-10 text-center">
        <h2 className="font-display text-3xl font-bold">
          Think you can wear the <span className="cc-gradient-text">crown</span>?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Registration takes 30 seconds. Pick your class, choose a subject, and your first champion challenge awaits.
        </p>
        <button
          onClick={() => navigate("/register")}
          className="cc-tap mt-6 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-8 font-display text-lg font-bold text-yellow-950 shadow-xl shadow-orange-500/25 transition-transform hover:scale-[1.02] active:scale-95"
        >
          <span className="my-2 inline-block">Start Your Journey</span>
        </button>
      </section>

      <footer className="border-t border-border/60 pt-6 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <button onClick={() => navigate("/how-to-play")} className="hover:text-foreground">How to play</button>
          <button onClick={() => navigate("/help")} className="hover:text-foreground">Help & rules</button>
          <button onClick={() => navigate("/privacy")} className="hover:text-foreground">Privacy</button>
          <button onClick={() => navigate("/terms")} className="hover:text-foreground">Terms</button>
        </div>
        <p className="mt-4 text-xs">
          ClassClash — built for Nigerian primary & secondary schools. Every question is reviewed for correctness and learning value.
        </p>
      </footer>
    </div>
  );
}

function ChampionsPreview() {
  const [champions, setChampions] = useState<
    { subject: { name: string; icon: string; color: string }; gradeName: string; champion: { displayName: string; avatar: string; isBot: boolean } }[]
  >([]);
  useEffect(() => {
    apiGet<{
      champions: {
        subject: { name: string; icon: string; color: string };
        gradeName: string;
        champion: { displayName: string; avatar: string; isBot: boolean };
      }[];
    }>("/champions").then((r) => {
      if (r.ok) setChampions((r as unknown as { champions: typeof champions }).champions.slice(0, 4));
    });
  }, []);
  if (champions.length === 0) return null;
  return (
    <section>
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Thrones waiting to be taken</h2>
        <button onClick={() => navigate("/champions")} className="flex items-center gap-1 text-sm font-semibold text-yellow-400 hover:underline">
          All crowns <ArrowRight size={15} aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Current champions include Guardian bots — practice champions holding the first titles. Beat one and the real crown becomes yours.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {champions.map((c, i) => (
          <button
            key={i}
            onClick={() => navigate("/champions")}
            className="flex items-center gap-3 rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/8 to-transparent p-4 text-left transition-all hover:border-yellow-500/50"
          >
            <div className="relative">
              <Avatar avatar={c.champion.avatar} size={46} ring="#f5c518" />
              <Crown size={19} className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-yellow-400" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-bold">{c.subject.name} · {c.gradeName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {c.champion.isBot ? `${c.champion.displayName} — Guardian bot` : `Champion: ${c.champion.displayName}`}
              </p>
            </div>
            <Pill color="gold">Take it</Pill>
          </button>
        ))}
      </div>
    </section>
  );
}

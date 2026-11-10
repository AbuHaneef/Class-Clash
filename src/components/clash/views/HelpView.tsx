"use client";

import React from "react";
import { navigate } from "@/lib/clash/client/router";
import { Crown, Swords, Zap, GraduationCap, CalendarCheck, Trophy, ShieldCheck, Scale, Lock, FileText, HelpCircle, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "how", label: "How to play", icon: BookOpen },
  { key: "help", label: "Help & rules", icon: HelpCircle },
  { key: "privacy", label: "Privacy", icon: Lock },
  { key: "terms", label: "Terms", icon: Scale },
];

export default function HelpView({ tab }: { tab?: string }) {
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="cc-scroll -mx-1 flex gap-2 overflow-x-auto px-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active.key === t.key}
            onClick={() => navigate(`/${t.key === "how" ? "how-to-play" : t.key}`)}
            className={cn(
              "cc-tap flex shrink-0 items-center gap-1.5 rounded-2xl border-2 px-4 py-2 text-sm font-bold",
              active.key === t.key ? "border-yellow-400 bg-yellow-500/10 text-yellow-300" : "border-border/60 bg-card/60 text-muted-foreground"
            )}
          >
            <t.icon size={15} aria-hidden /> {t.label}
          </button>
        ))}
      </div>

      {active.key === "how" && <HowToPlay />}
      {active.key === "help" && <HelpRules />}
      {active.key === "privacy" && <Privacy />}
      {active.key === "terms" && <Terms />}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-7 font-display text-xl font-bold first:mt-0">{children}</h2>;
}

function HowToPlay() {
  return (
    <article className="space-y-3 rounded-3xl border border-border/60 bg-card/70 p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold">How to play ClassClash</h1>

      <H2>1. Learn 🎓</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Pick your class and open a subject. Practise topic by topic — every answer gets instant feedback with a
        clear explanation so you actually learn from mistakes. Practice is untimed, earns XP (capped at 120 XP/day
        to reward real learning, not grinding), and never affects your competitive rating.
      </p>

      <H2>2. Compete ⚔️</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        <strong>Quick Arena:</strong> 7 timed questions against the clock — speed gives a small bonus, but correctness
        always dominates. <strong>Duels:</strong> challenge a classmate; you both answer the same questions and the
        higher validated score wins. <strong>Daily Challenge:</strong> one official entry per day, same set for your
        whole class, with its own daily board.
      </p>

      <H2>3. Become Champion 👑</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Every class × subject has ONE champion. Open a subject page, view the current champion, and hit
        <em> Challenge for the Crown</em>. The match is 8 questions, 25 seconds each. Beat the champion and the title
        transfers to you — recorded in the permanent title history. Champions can hold at most 2 pending challengers
        at once, and a beaten challenger waits 12 hours before trying again (anti-farming rules).
      </p>

      <H2>4. Come back daily 🔥</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Daily missions refresh every day on your local calendar. Keep your streak alive by completing any quiz each day.
        Streaks use your local calendar day — miss a day and it resets to 1.
      </p>

      <H2>Scoring rules (published)</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>Correct answer: 100 pts base × difficulty (Easy ×1, Medium ×1.25, Hard ×1.5)</li>
        <li>Speed bonus (competitive modes only): up to +20 pts for fast correct answers</li>
        <li>Wrong or timed out: 0 pts. Server-side timing and validation — the app can't fake a score</li>
        <li>Challenge tie-breaks: score → correct count → faster total time → higher rating → draw (champion retains)</li>
        <li>Rating (Elo-style, starts at 1000) moves only in real duels & champion matches, never vs bots</li>
      </ul>

      <H2>XP & levels</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Level thresholds: level L requires 50 × (L−1) × L total XP. Earn XP from quizzes, missions, badges and
        verified match results. XP measures activity; rating measures competitive performance; a crown marks the
        current title holder. Three different things — never merged into one mystery number.
      </p>
    </article>
  );
}

function HelpRules() {
  return (
    <article className="space-y-3 rounded-3xl border border-border/60 bg-card/70 p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold">Help, fair play & what's real</h1>

      <H2>Fair play rules</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>All ranked scoring is computed and validated on the server — the browser never decides your score.</li>
        <li>One answer per question per session (enforced by the database); one daily entry per account.</li>
        <li>Unusually fast answering flags a session for moderator review — it never auto-bans anyone.</li>
        <li>Champion challenges: max 2 pending per champion, 48h response window, 12h challenger cooldown.</li>
        <li>Dispute a result or report a bad question from any quiz review screen or profile page.</li>
      </ul>

      <H2>What's fully working in this build</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>Accounts, onboarding, profiles, guest preview quiz</li>
        <li>Question bank engine with server-validated answers & explanations</li>
        <li>Practice, Exam Prep, Quick Arena, Daily Challenge (per class)</li>
        <li><strong>Real-time Live Duels:</strong> Quick Match matchmaking, instant Live Trainer bots and friend room codes — same questions, synced rounds, forfeit on leaving</li>
        <li><strong>School Leagues:</strong> found or join a school with a code; every duel, champion match and live win scores league points for your school</li>
        <li>Asynchronous duels with invite links & codes; champion challenges with transaction-safe title transfers</li>
        <li>XP, levels, badges, streaks, missions, notifications, share cards</li>
        <li>Leaderboards (rating / season / XP), learning analytics, PWA installability</li>
        <li>Admin: question CRUD + CSV import + review queue, user & role management, moderation reports, audit log, platform config</li>
      </ul>

      <H2>What's foundation/beta (clearly labelled in-app)</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li><strong>Tournaments:</strong> registration & brackets work; match resolution is admin-confirmed for now.</li>
        <li><strong>Teacher dashboards:</strong> teacher & school-admin roles exist; class dashboards are on the roadmap.</li>
        <li><strong>Google sign-in & email delivery:</strong> not configured in this environment — email/password works.</li>
        <li><strong>Offline practice caching:</strong> the PWA shell installs; question caching for offline play is planned.</li>
        <li><strong>Live duels & school leagues:</strong> the live server keeps match state in memory — if the server restarts mid-match, in-flight live duels are void (no rating change), and completed results are safely stored.</li>
      </ul>

      <H2>Question bank & Guardian champions</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Every question in the bank is part of the <em>ClassClash Launch Bank</em> — reviewed for correctness and
        learning value, with worked explanations. Guardian bots hold the initial titles so championships are playable
        from day one; their attempts are generated the moment a challenge is created, before you play. New questions
        are added by editors through the admin review queue.
      </p>
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-sm">
        <p className="font-bold text-emerald-300">Real platform</p>
        <p className="mt-1 text-muted-foreground">
          Anyone can register with an email and password and play immediately — practice, arenas, live duels,
          school leagues and championships. Staff accounts (admin &amp; reviewer) are issued privately by the
          platform operator and are never published on the site.
        </p>
      </div>

      <H2>Getting help</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Confusing question? Tap the report button in any quiz review. Suspicious player? Report from their profile.
        Reports reach moderators with full audit trails. For account issues, contact your class teacher or platform support.
      </p>
    </article>
  );
}

function Privacy() {
  return (
    <article className="space-y-3 rounded-3xl border border-border/60 bg-card/70 p-6 sm:p-8">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Lock size={22} className="text-yellow-400" aria-hidden /> Privacy at ClassClash</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        ClassClash is built for school students, so privacy is a first-class feature, not an afterthought.
      </p>
      <H2>What we collect</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>Email (for sign-in only — never shown on profiles or leaderboards)</li>
        <li>Display name and avatar (both chosen by you; real names are blocked)</li>
        <li>Your class, quiz answers and results (needed for learning features)</li>
      </ul>
      <H2>What we never do</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>No public direct messages or open chat — challenges are the only interaction channel</li>
        <li>No sharing of individual weak-topic data with other students or the public</li>
        <li>No selling data, no advertising, no behavioural tracking</li>
        <li>No shaming: low scores are never broadcast</li>
      </ul>
      <H2>Your controls</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>Change display name, avatar and class anytime in Settings</li>
        <li>Request account deletion in Settings (soft-deletes your public presence immediately)</li>
        <li>Block/report any user — reports go to human moderators</li>
      </ul>
      <H2>Younger students</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This platform is designed with child-sensible defaults: private-by-default profiles, no chat, no location,
        no third-party trackers. Schools and parents should ensure accounts are created with adult guidance where required.
      </p>
    </article>
  );
}

function Terms() {
  return (
    <article className="space-y-3 rounded-3xl border border-border/60 bg-card/70 p-6 sm:p-8">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Scale size={22} className="text-yellow-400" aria-hidden /> Terms of use</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        By using ClassClash you agree to play fair and be kind. Simple rules for a great arena:
      </p>
      <H2>Do</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>Play under one account, as yourself</li>
        <li>Challenge classmates honestly and cheer their progress</li>
        <li>Report questions you believe are wrong — that helps everyone</li>
      </ul>
      <H2>Don't</H2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>Impersonate others or use offensive names</li>
        <li>Share answers during active competitions or manipulate scores</li>
        <li>Harass other players (no chat exists by design, but don't be creative)</li>
      </ul>
      <H2>Consequences</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Moderators review reports with full audit logs. Actions range from warnings to temporary restrictions.
        Permanent bans are never issued by automated heuristics alone — a human always decides. Match results stand
        unless invalidated through the dispute process.
      </p>
      <H2>Content</H2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Launch questions are reviewed educational content, not official examination papers. Curriculum alignment labels appear
        only after editorial review. The platform is provided "as is" for learning and friendly competition.
      </p>
    </article>
  );
}

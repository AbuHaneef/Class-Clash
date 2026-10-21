"use client";

import React, { useEffect, lazy, Suspense } from "react";
import { useRoute, navigate } from "@/lib/clash/client/router";
import { useClash } from "@/lib/clash/client/store";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { Avatar } from "@/lib/clash/avatars";
import { LevelBadge, XPBar, StreakFlame, LoadingCard } from "./shared";
import { sfx } from "@/lib/clash/client/sound";
import { toast } from "sonner";
import {
  Home, Swords, Trophy, BarChart3, User as UserIcon, Bell, Zap,
  GraduationCap, Settings, CalendarCheck, Medal, LogOut, ScrollText,
  ShieldCheck, Flame, Crown, Gamepad2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Views (lazy-loaded for faster first paint on low-end phones) ──
const LandingView = lazy(() => import("./views/LandingView"));
const AuthView = lazy(() => import("./views/AuthView"));
const OnboardingView = lazy(() => import("./views/OnboardingView"));
const DashboardView = lazy(() => import("./views/DashboardView"));
const SubjectsView = lazy(() => import("./views/SubjectsView"));
const SubjectDetailView = lazy(() => import("./views/SubjectDetailView"));
const QuizPlayView = lazy(() => import("./views/QuizPlayView"));
const ResultsView = lazy(() => import("./views/ResultsView"));
const DuelsView = lazy(() => import("./views/DuelsView"));
const DuelDetailView = lazy(() => import("./views/DuelDetailView"));
const ChampionsView = lazy(() => import("./views/ChampionsView"));
const ChampionProfileView = lazy(() => import("./views/ChampionProfileView"));
const LeaderboardView = lazy(() => import("./views/LeaderboardView"));
const DailyAndArenaView = lazy(() => import("./views/DailyAndArenaView"));
const ProfileView = lazy(() => import("./views/ProfileView"));
const SettingsView = lazy(() => import("./views/SettingsView"));
const AnalyticsView = lazy(() => import("./views/AnalyticsView"));
const AchievementsView = lazy(() => import("./views/AchievementsView"));
const NotificationsView = lazy(() => import("./views/NotificationsView"));
const TournamentsView = lazy(() => import("./views/TournamentsView"));
const HelpView = lazy(() => import("./views/HelpView"));
const ShareView = lazy(() => import("./views/ShareView"));
const JoinView = lazy(() => import("./views/JoinView"));
const AdminView = lazy(() => import("./views/AdminView"));

export default function AppShell() {
  const route = useRoute();
  const { me, fetchMe, soundOn } = useClash();

  // session bootstrap
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // keep sound flag synced
  useEffect(() => {
    sfx.enabled = soundOn;
    if (soundOn) sfx.init();
  }, [soundOn]);

  // poll notifications while signed in
  useEffect(() => {
    if (!me) return;
    const iv = setInterval(() => fetchMe(), 45_000);
    return () => clearInterval(iv);
  }, [me, fetchMe]);

  // register service worker (PWA)
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol === "https:" || "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const [path0, path1, path2] = route.segments;
  const isQuiz = path0 === "quiz";
  const isLandingish = ["", "how-to-play", "help", "privacy", "terms", "login", "register", "share", "join"].includes(path0 ?? "");

  // ── Route guard: onboarding ──
  useEffect(() => {
    if (me && !me.onboarded && path0 !== "onboarding" && path0 !== "settings" && path0 !== "share") {
      navigate("/onboarding", true);
    }
  }, [me, path0]);

  const view = renderRoute(route.segments, Boolean(me));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!isQuiz && <TopBar me={me} hidden={isQuiz} />}
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-3 pb-28 pt-4 sm:px-5 lg:pb-10">
        {me && <SidebarNav path0={path0 ?? ""} />}
        <main className="min-w-0 flex-1" id="main">
          <Suspense fallback={<LoadingCard label="Loading…" />}>{view}</Suspense>
        </main>
      </div>
      {me && !isQuiz && <BottomNav path0={path0 ?? ""} />}
      {!me && !isLandingish && null}
    </div>
  );
}

function renderRoute(segments: string[], signedIn: boolean): React.ReactNode {
  const [p0, p1, p2] = segments;
  switch (p0) {
    case undefined:
      return signedIn ? <DashboardView /> : <LandingView />;
    case "onboarding":
      return <OnboardingView />;
    case "login":
    case "register":
      return <AuthView mode={p0 === "register" ? "register" : "login"} />;
    case "how-to-play":
      return <HelpView tab="how" />;
    case "help":
      return <HelpView tab="help" />;
    case "privacy":
      return <HelpView tab="privacy" />;
    case "terms":
      return <HelpView tab="terms" />;
    case "subjects":
      return <SubjectsView />;
    case "subject":
      return <SubjectDetailView subjectId={p1} />;
    case "quiz":
      return <QuizPlayView sessionId={p1} />;
    case "results":
      return <ResultsView sessionId={p1} />;
    case "arena":
      return signedIn ? <DailyAndArenaView which="arena" /> : <AuthView mode="login" />;
    case "duels":
      return <DuelsView />;
    case "duel":
      return <DuelDetailView challengeId={p1} />;
    case "champions":
      return <ChampionsView />;
    case "champion":
      return <ChampionProfileView gradeId={p1} subjectId={p2} />;
    case "leaderboard":
      return <LeaderboardView />;
    case "daily":
      return signedIn ? <DailyAndArenaView which="daily" /> : <AuthView mode="login" />;
    case "profile":
      return <ProfileView userId={p1} />;
    case "settings":
      return <SettingsView />;
    case "analytics":
      return <AnalyticsView />;
    case "achievements":
      return <AchievementsView />;
    case "notifications":
      return <NotificationsView />;
    case "tournaments":
      return <TournamentsView />;
    case "share":
      return <ShareView token={p1} />;
    case "join":
      return <JoinView code={p1} />;
    case "admin":
      return <AdminView section={p1 ?? "dashboard"} />;
    default:
      return signedIn ? <DashboardView /> : <LandingView />;
  }
}

// ── Top bar ──────────────────────────────────────────────────

function TopBar({ me, hidden }: { me: ReturnType<typeof useClash.getState>["me"]; hidden: boolean }) {
  if (hidden) return null;
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-5">
        <button
          onClick={() => navigate(me ? "/" : "/")}
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
          aria-label="ClassClash home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 text-base shadow-lg">
            <Crown size={17} className="text-yellow-950" aria-hidden />
          </span>
          <span className="hidden sm:inline">
            Class<span className="cc-gradient-text">Clash</span>
          </span>
        </button>

        {me ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden w-40 sm:block">
              <XPBar pct={me.levelInfo?.pct ?? 0} level={me.levelInfo?.level ?? 1} compact />
            </div>
            <LevelBadge level={me.levelInfo?.level ?? 1} size={30} />
            <StreakFlame count={me.streakCount} />
            <button
              onClick={() => navigate("/notifications")}
              className="cc-tap relative flex items-center justify-center rounded-xl bg-secondary/70"
              aria-label={`Notifications${me.unread ? `, ${me.unread} unread` : ""}`}
            >
              <Bell size={18} className="m-2.5 text-foreground/80" aria-hidden />
              {me.unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {me.unread > 9 ? "9+" : me.unread}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate(`/profile/${me.id}`)}
              aria-label="My profile"
              className="cc-tap flex items-center rounded-full"
            >
              <Avatar avatar={me.avatar} size={34} ring="#f5c51855" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/how-to-play")}
              className="cc-tap hidden items-center rounded-xl px-3 font-medium text-muted-foreground hover:text-foreground sm:flex"
            >
              How to play
            </button>
            <button
              onClick={() => navigate("/login")}
              className="cc-tap items-center rounded-xl px-3 font-semibold text-foreground/90 hover:text-foreground"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("/register")}
              className="cc-tap flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 px-4 font-bold text-yellow-950 shadow-lg shadow-orange-500/20 transition-transform active:scale-95"
            >
              <Gamepad2 size={16} aria-hidden /> <span className="my-2.5">Play Now</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ── Bottom nav (mobile) ──────────────────────────────────────

const NAV_ITEMS = [
  { path: "", label: "Home", icon: Home },
  { path: "subjects", label: "Learn", icon: GraduationCap },
  { path: "arena", label: "Arena", icon: Zap },
  { path: "champions", label: "Crowns", icon: Trophy },
  { path: "leaderboard", label: "Ranks", icon: BarChart3 },
];

function BottomNav({ path0 }: { path0: string }) {
  return (
    <nav
      className="cc-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-md lg:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const active = path0 === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path ? `/${item.path}` : "/")}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-semibold transition-colors",
                active ? "text-yellow-400" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Sidebar (desktop) ────────────────────────────────────────

const SIDE_ITEMS = [
  { path: "", label: "Dashboard", icon: Home },
  { path: "subjects", label: "Subjects & Practice", icon: GraduationCap },
  { path: "arena", label: "Quick Arena", icon: Zap },
  { path: "daily", label: "Daily Challenge", icon: CalendarCheck },
  { path: "duels", label: "Duels & Challenges", icon: Swords },
  { path: "champions", label: "Champions", icon: Trophy },
  { path: "leaderboard", label: "Leaderboards", icon: BarChart3 },
  { path: "achievements", label: "Achievements", icon: Medal },
  { path: "analytics", label: "My Progress", icon: Flame },
  { path: "tournaments", label: "Tournaments", icon: ScrollText },
];

function SidebarNav({ path0 }: { path0: string }) {
  const me = useClash((s) => s.me);
  const setMe = useClash((s) => s.setMe);
  const isAdmin = me?.role === "admin" || me?.role === "reviewer";

  const logout = async () => {
    await apiSend("POST", "/auth/logout");
    setMe(null);
    toast("Signed out. See you soon!");
    navigate("/");
  };

  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-60 shrink-0 flex-col gap-1 self-start lg:flex" aria-label="Sidebar">
      {SIDE_ITEMS.map((item) => {
        const active = path0 === item.path;
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path ? `/${item.path}` : "/")}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-yellow-500/12 text-yellow-300"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} aria-hidden />
            {item.label}
          </button>
        );
      })}
      <div className="my-2 h-px bg-border/60" />
      <button
        onClick={() => navigate("/notifications")}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      >
        <Bell size={18} aria-hidden /> Notifications
        {me && me.unread > 0 && (
          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
            {me.unread}
          </span>
        )}
      </button>
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      >
        <Settings size={18} aria-hidden /> Settings
      </button>
      {isAdmin && (
        <button
          onClick={() => navigate("/admin/dashboard")}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
            path0 === "admin" ? "bg-violet-500/15 text-violet-300" : "text-violet-400/80 hover:bg-violet-500/10"
          )}
        >
          <ShieldCheck size={18} aria-hidden /> Admin Panel
        </button>
      )}
      <button
        onClick={logout}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground/70 hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut size={18} aria-hidden /> Sign out
      </button>
    </aside>
  );
}

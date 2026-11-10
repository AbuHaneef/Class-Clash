"use client";

import React, { useEffect, useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import { LoadingCard, EmptyState, Pill } from "@/components/clash/shared";
import { toast } from "sonner";
import { ScrollText, Users, CheckCircle2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tournament = {
  id: string; name: string; description: string; status: string;
  subjectName: string; gradeName: string; maxParticipants: number;
  participantCount: number; startsAt: string | null; endsAt: string | null;
  participants: { id: string; displayName: string; avatar: string; seed: number }[];
  roundCount: number;
};

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#94a3b8" },
  registration: { label: "Registration open", color: "#34d399" },
  active: { label: "Live", color: "#f5c518" },
  completed: { label: "Completed", color: "#a855f7" },
  cancelled: { label: "Cancelled", color: "#ef4444" },
};

export default function TournamentsView() {
  const me = useClash((s) => s.me);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ tournaments: Tournament[] }>("/tournaments").then((r) => {
      if (r.ok) setTournaments((r as unknown as { tournaments: Tournament[] }).tournaments);
      setLoading(false);
    });
  }, []);

  const register = async (id: string) => {
    if (!me) return navigate("/login");
    const r = await apiSend("POST", "/tournaments", { tournamentId: id });
    if (!r.ok) return toast.error(r.error);
    toast.success("You're in! Good luck.");
    const updated = await apiGet<{ tournaments: Tournament[] }>("/tournaments");
    if (updated.ok) setTournaments((updated as unknown as { tournaments: Tournament[] }).tournaments);
  };

  if (loading) return <LoadingCard label="Loading tournaments…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
          <ScrollText size={24} className="text-yellow-400" aria-hidden /> Tournaments
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Official bracket competitions run by platform administrators.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-yellow-500/25 bg-yellow-500/8 p-4 text-xs leading-relaxed text-yellow-200/90">
        <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          <strong>Beta feature — honest label:</strong> registration and live brackets work; match
          resolution is currently confirmed by tournament admins while automated tournament matching is
          completed. Only admins can create official tournaments.
        </span>
      </p>

      {tournaments.length === 0 ? (
        <EmptyState icon={ScrollText} title="No tournaments announced yet" description="Official tournaments will appear here when administrators open registration." />
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => {
            const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.draft;
            const iAmIn = t.participants.some((p) => p.id === me?.id);
            return (
              <div key={t.id} className="rounded-3xl border border-border/60 bg-card/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold">{t.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Pill color="violet">{t.subjectName}</Pill>
                      <Pill>{t.gradeName}</Pill>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{ background: st.color + "22", color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold">{t.participantCount}/{t.maxParticipants}</p>
                    <p className="text-xs text-muted-foreground">players</p>
                  </div>
                </div>

                {/* participants */}
                {t.participants.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {t.participants.map((p) => (
                      <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-secondary/60 py-1 pl-1 pr-3 text-xs font-semibold">
                        <Avatar avatar={p.avatar} size={22} />
                        {p.displayName}
                      </span>
                    ))}
                  </div>
                )}

                {t.status === "registration" && me && !iAmIn && t.participantCount < t.maxParticipants && (
                  <button
                    onClick={() => register(t.id)}
                    className="cc-tap mt-4 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 font-display font-bold text-yellow-950 active:scale-95"
                  >
                    <span className="my-2.5 inline-block">Register</span>
                  </button>
                )}
                {iAmIn && (
                  <p className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-500/12 py-2.5 text-sm font-bold text-emerald-300">
                    <CheckCircle2 size={15} aria-hidden /> You're registered
                  </p>
                )}
                {t.status === "active" && (
                  <p className="mt-4 rounded-2xl bg-secondary/50 p-3 text-center text-xs text-muted-foreground">
                    Bracket is live — {t.roundCount} round{t.roundCount !== 1 ? "s" : ""}. Follow announcements for results.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

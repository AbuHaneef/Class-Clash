"use client";

import React, { useEffect, useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar } from "@/lib/clash/avatars";
import { SubjectIcon, LoadingCard } from "@/components/clash/shared";
import { toast } from "sonner";
import { Swords, Crown, ArrowRight } from "lucide-react";

type Invite = {
  code: string; type: string; active: boolean; status: string;
  challengerName: string; challengerAvatar: string;
  subjectName: string; subjectColor: string; subjectIcon: string;
  gradeName: string; questionCount: number; expiresAt: string; challengeId: string;
};

export default function JoinView({ code }: { code?: string }) {
  const me = useClash((s) => s.me);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    apiGet<{ invite: Invite }>(`/invite/${code.toUpperCase()}`).then((r) => {
      if (r.ok) setInvite((r as unknown as { invite: Invite }).invite);
      else setError(r.error);
      setLoading(false);
    });
  }, [code]);

  const accept = async () => {
    if (!invite) return;
    if (!me) {
      toast("Create an account first — it takes 30 seconds!");
      navigate("/register");
      return;
    }
    setBusy(true);
    const r = await apiSend("POST", `/challenges/${invite.challengeId}/action`, { action: "accept" });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast("Challenge accepted — let's clash!");
    navigate(`/duel/${invite.challengeId}`);
  };

  if (loading) return <LoadingCard label="Opening your invite…" />;
  if (error || !invite)
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-lg font-bold">Invite not found</p>
        <p className="mt-1 text-sm text-muted-foreground">{error ?? "This invite link is invalid or has expired."}</p>
        <button onClick={() => navigate("/")} className="cc-tap mt-5 rounded-xl bg-secondary px-5 py-2.5 font-bold">
          Go home
        </button>
      </div>
    );

  const expired = !invite.active;

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="cc-hero-bg rounded-3xl border border-border/60 p-6 text-center sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-400">
          {invite.type === "champion" ? "Champion Challenge" : "Duel invitation"}
        </p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Avatar avatar={invite.challengerAvatar} size={58} />
          <Swords size={22} className="text-muted-foreground" aria-hidden />
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-border text-2xl" aria-hidden>
            ❔
          </span>
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">
          {invite.challengerName} challenges you!
        </h1>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-secondary/50 p-3.5">
          <SubjectIcon icon={invite.subjectIcon} color={invite.subjectColor} size={22} />
          <div className="text-left">
            <p className="text-sm font-bold">{invite.subjectName} • {invite.gradeName}</p>
            <p className="text-xs text-muted-foreground">
              {invite.questionCount} questions • expires {new Date(invite.expiresAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {expired ? (
          <p className="mt-5 rounded-2xl bg-red-500/12 p-4 text-sm font-semibold text-red-400">
            This invite is no longer active ({invite.status}).
          </p>
        ) : (
          <button
            onClick={accept}
            disabled={busy}
            className="cc-tap mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 font-display font-bold text-yellow-950 active:scale-95 disabled:opacity-50"
          >
            {busy ? (
              <span className="my-3">Accepting…</span>
            ) : (
              <>
                <span className="my-3">{me ? "Accept challenge" : "Join & accept"}</span>
                <ArrowRight size={17} aria-hidden />
              </>
            )}
          </button>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {me ? (
            <>You're signed in as <strong>{me.displayName}</strong> ({me.gradeName ?? "no class"}). You can only accept duels for your own class.</>
          ) : (
            <>New here? Create a free account to accept — pick {invite.gradeName} during setup to be eligible.</>
          )}
        </p>
      </div>
    </div>
  );
}

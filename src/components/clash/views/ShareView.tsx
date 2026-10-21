"use client";

import React, { useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { toast } from "sonner";
import { absoluteUrl } from "@/lib/clash/client/router";
import { Copy, Share2, Swords } from "lucide-react";

export default function ShareView({ token }: { token?: string }) {
  const [copied, setCopied] = useState(false);
  const [data, setData] = React.useState<{
    share: { type: string; title: string; subtitle: string; player: { displayName: string; avatar: string; gradeName: string | null; level: number | null; titles: number } };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    fetch(`/api/clash/share/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
        else setError(d.error);
      })
      .catch(() => setError("Could not load this share card."));
  }, [token]);

  if (!token) return null;
  if (error)
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  if (!data) return <div className="py-10 text-center text-muted-foreground">Loading share card…</div>;

  const s = data.share;
  const url = absoluteUrl(`/share/${token}`);

  return (
    <div className="mx-auto max-w-md space-y-5 py-4">
      {/* the share card */}
      <div className="cc-hero-bg cc-card-glow rounded-3xl border-2 border-yellow-500/40 p-7 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">ClassClash</p>
        <h1 className="mt-2 font-display text-2xl font-bold leading-snug">{s.title}</h1>
        {s.subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{s.subtitle}</p>}
        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="text-4xl" aria-hidden>{s.player.avatar === "robot" ? "🤖" : "🏆"}</span>
          <div className="text-left">
            <p className="font-display font-bold">{s.player.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {s.player.gradeName ?? ""}{s.player.level ? ` • Level ${s.player.level}` : ""}
              {s.player.titles > 0 ? ` • ${s.player.titles} 👑` : ""}
            </p>
          </div>
        </div>
        <p className="mt-6 font-display text-sm font-bold text-yellow-300">
          Learn. Challenge. Climb. Become the Champion.
        </p>
      </div>

      {/* actions */}
      <div className="flex gap-2.5">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              toast("Link copied!");
            });
          }}
          className="cc-tap flex flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-bold hover:bg-secondary/70"
        >
          <Copy size={16} aria-hidden /> {copied ? "Copied!" : "Copy link"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            onClick={() => navigator.share?.({ title: "ClassClash", text: s.title, url })}
            className="cc-tap flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-3 font-display font-bold text-yellow-950"
          >
            <Share2 size={16} aria-hidden /> Share
          </button>
        )}
      </div>

      <button
        onClick={() => navigate("/register")}
        className="cc-tap flex w-full items-center justify-center gap-2 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 font-display font-bold text-yellow-300"
      >
        <Swords size={17} aria-hidden /> Think you can beat this? Join ClassClash
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Share cards show only public info — never emails or private performance data.
      </p>
    </div>
  );
}

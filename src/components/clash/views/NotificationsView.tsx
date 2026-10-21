"use client";

import React, { useEffect, useState, useCallback } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet, apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { LoadingCard, EmptyState } from "@/components/clash/shared";
import { Bell, CheckCheck, Crown, Swords, Medal, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/clash/game";

type Notification = {
  id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string;
};

const TYPE_STYLE: Record<string, { icon: React.ElementType; color: string }> = {
  challenge: { icon: Swords, color: "#f472b6" },
  champion: { icon: Crown, color: "#f5c518" },
  badge: { icon: Medal, color: "#a855f7" },
  level: { icon: Sparkles, color: "#34d399" },
  mission: { icon: Sparkles, color: "#f97316" },
  system: { icon: Info, color: "#94a3b8" },
};

export default function NotificationsView() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchMe = useClash((s) => s.fetchMe);

  const load = useCallback(async () => {
    const r = await apiGet<{ notifications: Notification[] }>("/notifications");
    if (r.ok) setItems((r as unknown as { notifications: Notification[] }).notifications);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    await apiSend("POST", "/notifications", { all: true });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    fetchMe();
  };

  const open = async (n: Notification) => {
    if (!n.read) {
      await apiSend("POST", "/notifications", { ids: [n.id] });
      fetchMe();
    }
    if (n.link) navigate(n.link.replace(/^#/, ""));
  };

  if (loading) return <LoadingCard label="Fetching notifications…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Bell size={22} className="text-yellow-400" aria-hidden /> Notifications
        </h1>
        {items.some((n) => !n.read) && (
          <button
            onClick={markAll}
            className="cc-tap flex items-center gap-1.5 rounded-xl bg-secondary px-3.5 py-2 text-xs font-bold hover:bg-secondary/70"
          >
            <CheckCheck size={14} aria-hidden /> Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Bell} title="All quiet" description="Challenge invites, title defences and badge unlocks will land here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.system;
            const Icon = style.icon;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  n.read ? "border-border/50 bg-secondary/25" : "border-yellow-500/30 bg-yellow-500/6"
                )}
              >
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: style.color + "1f", color: style.color }}
                >
                  <Icon size={17} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", n.read ? "font-semibold" : "font-bold")}>{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-yellow-400" aria-label="Unread" />}
              </button>
            );
          })}
        </div>
      )}

      <p className="rounded-2xl border border-border/50 bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
        We keep notifications minimal and purposeful — no spam, no streak-shaming. Optional in-app reminders only;
        email/push alerts are not enabled in this build.
      </p>
    </div>
  );
}

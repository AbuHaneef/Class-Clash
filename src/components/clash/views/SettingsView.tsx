"use client";

import React, { useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiSend } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { Avatar, AVATAR_LIST } from "@/lib/clash/avatars";
import { toast } from "sonner";
import { Volume2, VolumeX, LogOut, Trash2, Save, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/clash/client/sound";
import { disconnectLive } from "@/lib/clash/client/live";

export default function SettingsView() {
  const { me, setMe, fetchMe, soundOn, setSound } = useClash();
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [avatar, setAvatar] = useState(me?.avatar ?? "fox");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!me)
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-muted-foreground">Sign in to manage your settings.</p>
      </div>
    );

  const save = async () => {
    setBusy(true);
    const r = await apiSend<{ user: unknown }>("PATCH", "/me", { displayName, avatar });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    if ("error" in r && (r as unknown as { error?: string }).error)
      return toast.error((r as unknown as { error: string }).error);
    await fetchMe();
    toast("Profile saved!");
  };

  const logout = async () => {
    await apiSend("POST", "/auth/logout");
    disconnectLive();
    setMe(null);
    toast("Signed out. See you soon!");
    navigate("/");
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSound(next);
    sfx.enabled = next;
    if (next) {
      sfx.init();
      sfx.correct();
    }
    apiSend("PATCH", "/me", { soundEnabled: next });
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings</h1>

      {/* profile */}
      <section className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <h2 className="mb-4 font-display text-lg font-bold">Player identity</h2>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={16}
            className="cc-tap w-full rounded-xl border border-input bg-secondary/40 px-4 py-2.5 text-sm outline-none focus:border-yellow-500/50"
          />
        </label>
        <p className="mb-2 mt-4 text-sm font-semibold">Avatar</p>
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_LIST.map((a) => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              aria-label={`Choose avatar ${a}`}
              className={cn(
                "flex justify-center rounded-2xl border-2 p-1.5 transition-all",
                avatar === a ? "border-yellow-400 bg-yellow-500/10" : "border-transparent hover:border-border"
              )}
            >
              <Avatar avatar={a} size={38} />
            </button>
          ))}
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="cc-tap mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 font-display font-bold text-yellow-950 active:scale-95 disabled:opacity-50"
        >
          <Save size={16} aria-hidden /> <span className="my-2.5">{busy ? "Saving…" : "Save changes"}</span>
        </button>
      </section>

      {/* sound & accessibility */}
      <section className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <h2 className="mb-1 font-display text-lg font-bold">Sound & comfort</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Sound effects are generated locally (no downloads) and are OFF by default.
          Animations respect your system's reduced-motion setting.
        </p>
        <button
          onClick={toggleSound}
          className="cc-tap flex w-full items-center justify-between rounded-2xl bg-secondary/50 px-4 py-3.5"
          role="switch"
          aria-checked={soundOn}
        >
          <span className="flex items-center gap-2.5 font-semibold">
            {soundOn ? <Volume2 size={18} className="text-emerald-400" aria-hidden /> : <VolumeX size={18} className="text-muted-foreground" aria-hidden />}
            Game sounds
          </span>
          <span
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              soundOn ? "bg-emerald-500" : "bg-secondary"
            )}
            aria-hidden
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                soundOn ? "left-[22px]" : "left-0.5"
              )}
            />
          </span>
        </button>
      </section>

      {/* account */}
      <section className="rounded-3xl border border-border/60 bg-card/70 p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Account</h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Signed in as <strong className="text-foreground">{me.email}</strong></p>
          <p>Role: {me.role} • Class: {me.gradeName ?? "not set"}</p>
          <p>Streak policy: local calendar days • Practice XP capped at 120/day (anti-farming)</p>
        </div>
        <button
          onClick={logout}
          className="cc-tap mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-bold hover:bg-secondary/70"
        >
          <LogOut size={16} aria-hidden /> Sign out
        </button>
        <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm font-semibold text-red-300">Danger zone</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleting your account removes your public profile and competitive presence. Admins purge personal data per policy.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="cc-tap mt-3 flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3.5 py-2 text-xs font-bold text-red-400"
            >
              <Trash2 size={13} aria-hidden /> Request account deletion
            </button>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  const r = await apiSend("PATCH", "/me", { requestDeletion: true });
                  if (r.ok) {
                    toast("Deletion requested. You'll be signed out.");
                    setTimeout(() => {
                      setMe(null);
                      navigate("/");
                    }, 1500);
                  }
                }}
                className="cc-tap flex-1 rounded-xl bg-red-500/80 py-2 text-xs font-bold text-white"
              >
                Yes, delete my account
              </button>
              <button onClick={() => setConfirmDelete(false)} className="cc-tap flex-1 rounded-xl bg-secondary py-2 text-xs font-bold">
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Palette size={13} aria-hidden /> ClassClash runs a dark gaming theme optimised for readability.
      </p>
    </div>
  );
}

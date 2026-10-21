"use client";

import { create } from "zustand";
import { apiGet } from "./api";

export type MeState = {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  role: string;
  gradeId: string | null;
  gradeName: string | null;
  onboarded: boolean;
  xp: number;
  rating: number;
  seasonPoints: number;
  streakCount: number;
  longestStreak: number;
  soundEnabled: boolean;
  levelInfo: {
    level: number;
    title: string;
    pct: number;
    intoLevel: number;
    needed: number;
  };
  unread: number;
  titles: number;
};

type Store = {
  me: MeState | null;
  meLoading: boolean;
  soundOn: boolean;
  fetchMe: () => Promise<MeState | null>;
  setMe: (me: MeState | null) => void;
  refreshBadges: () => void;
  setSound: (on: boolean) => void;
};

export const useClash = create<Store>((set, get) => ({
  me: null,
  meLoading: true,
  soundOn: false,
  setMe: (me) => set({ me, meLoading: false }),
  setSound: (on) => {
    set({ soundOn: on });
    if (typeof window !== "undefined") localStorage.setItem("cc-sound", on ? "1" : "0");
  },
  fetchMe: async () => {
    const r = await apiGet<{ user: MeState | null }>("/auth/me");
    const me = r.ok ? r.user : null;
    set({ me, meLoading: false });
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cc-sound") === "1";
      if (stored !== get().soundOn) set({ soundOn: stored });
    }
    return me;
  },
  refreshBadges: () => {},
}));

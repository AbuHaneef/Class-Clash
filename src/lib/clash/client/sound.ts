"use client";

// Tiny WebAudio sound kit — OFF by default, enabled in Settings.
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

export const sfx = {
  enabled: false,
  init() {
    if (typeof window === "undefined") return;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        /* audio unsupported — game stays fully playable silent */
      }
    }
    ctx?.resume?.();
  },
  correct() {
    if (!this.enabled || !ctx) return;
    tone(523, 0, 0.12, "sine", 0.12);
    tone(784, 0.09, 0.16, "sine", 0.1);
  },
  wrong() {
    if (!this.enabled || !ctx) return;
    tone(196, 0, 0.2, "sawtooth", 0.06);
    tone(147, 0.1, 0.25, "sawtooth", 0.05);
  },
  tick() {
    if (!this.enabled || !ctx) return;
    tone(880, 0, 0.04, "square", 0.03);
  },
  win() {
    if (!this.enabled || !ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.18, "triangle", 0.1));
  },
  lose() {
    if (!this.enabled || !ctx) return;
    [392, 330, 262].forEach((f, i) => tone(f, i * 0.13, 0.2, "triangle", 0.08));
  },
  unlock() {
    if (!this.enabled || !ctx) return;
    [659, 880, 1175].forEach((f, i) => tone(f, i * 0.08, 0.14, "sine", 0.09));
  },
};

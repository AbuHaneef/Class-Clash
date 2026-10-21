"use client";

import React from "react";

// Gallery of safe, predefined avatar characters (pure SVG, no external assets).
export type AvatarKey =
  | "fox" | "owl" | "panda" | "lion" | "shark" | "cat"
  | "turtle" | "penguin" | "bee" | "dragon" | "robot" | "alien"
  // guardian bots reuse these shapes with distinct tints
  | "squirrel" | "cheetah" | "dolphin" | "quokka" | "newt" | "antelope"
  | "jaguar" | "crow" | "swan" | "mongoose" | "nyala" | "giraffe"
  | "ibis" | "raven" | "aardvark" | "pangolin" | "egret" | "serval"
  | "gecko" | "bat" | "pelican" | "iguana";

export const AVATAR_LIST: AvatarKey[] = [
  "fox", "owl", "panda", "lion", "shark", "cat",
  "turtle", "penguin", "bee", "dragon", "robot", "alien",
];

const PALETTE: Record<string, [string, string, string]> = {
  // [bg, body, accent]
  fox: ["#f97316", "#fdba74", "#7c2d12"],
  owl: ["#a78bfa", "#ddd6fe", "#4c1d95"],
  panda: ["#334155", "#e2e8f0", "#0f172a"],
  lion: ["#f59e0b", "#fcd34d", "#7c2d12"],
  shark: ["#38bdf8", "#bae6fd", "#0c4a6e"],
  cat: ["#f472b6", "#fbcfe8", "#831843"],
  turtle: ["#22c55e", "#86efac", "#14532d"],
  penguin: ["#1e293b", "#f8fafc", "#f59e0b"],
  bee: ["#eab308", "#fef08a", "#422006"],
  dragon: ["#10b981", "#6ee7b7", "#064e3b"],
  robot: ["#94a3b8", "#e2e8f0", "#ef4444"],
  alien: ["#84cc16", "#d9f99d", "#365314"],
  squirrel: ["#d97706", "#fcd34d", "#7c2d12"],
  cheetah: ["#ea580c", "#fed7aa", "#7c2d12"],
  dolphin: ["#0ea5e9", "#bae6fd", "#0c4a6e"],
  quokka: ["#c2703d", "#fdba74", "#7c2d12"],
  newt: ["#e11d48", "#fecdd3", "#7f1d1d"],
  antelope: ["#a16207", "#fde68a", "#422006"],
  jaguar: ["#d97706", "#fde68a", "#431407"],
  crow: ["#475569", "#94a3b8", "#020617"],
  swan: ["#f1f5f9", "#ffffff", "#475569"],
  mongoose: ["#b45309", "#fde68a", "#57200b"],
  nyala: ["#92400e", "#d6c0a5", "#3f2008"],
  giraffe: ["#d97706", "#fef3c7", "#78350f"],
  ibis: ["#f43f5e", "#fecdd3", "#7f1d1d"],
  raven: ["#312e81", "#a5b4fc", "#1e1b4b"],
  aardvark: ["#bcaaa7", "#efebe9", "#4e342e"],
  pangolin: ["#8d6e63", "#d7ccc8", "#3e2723"],
  egret: ["#e2e8f0", "#ffffff", "#f59e0b"],
  serval: ["#f59e0b", "#fde68a", "#431407"],
  gecko: ["#4ade80", "#bbf7d0", "#14532d"],
  bat: ["#6d28d9", "#c4b5fd", "#2e1065"],
  pelican: ["#60a5fa", "#dbeafe", "#1e3a8a"],
  iguana: ["#65a30d", "#bef264", "#1a2e05"],
};

function AvatarSvg({ k }: { k: AvatarKey }) {
  const [bg, body, accent] = PALETTE[k] ?? PALETTE.fox;
  const id = React.useId();
  switch (k) {
    case "owl":
    case "crow":
    case "raven":
    case "ibis":
    case "egret":
    case "pelican":
    case "swan":
      return (
        <g>
          <circle cx="32" cy="20" r="12" fill={body} />
          <circle cx="27" cy="19" r="2.6" fill="#fff" /><circle cx="37" cy="19" r="2.6" fill="#fff" />
          <circle cx="27" cy="19.7" r="1.2" fill="#111" /><circle cx="37" cy="19.7" r="1.2" fill="#111" />
          <path d="M30 24 L32 27 L34 24 Z" fill={accent} />
          <ellipse cx="32" cy="44" rx="16" ry="12" fill={body} />
          <path d="M18 40 Q10 46 12 54 L20 50 Z" fill={body} />
          <path d="M46 40 Q54 46 52 54 L44 50 Z" fill={body} />
          <ellipse cx="32" cy="52" rx="8" ry="4" fill={accent} opacity="0.5" />
        </g>
      );
    case "panda":
      return (
        <g>
          <circle cx="21" cy="20" r="7" fill={accent} />
          <circle cx="43" cy="20" r="7" fill={accent} />
          <circle cx="32" cy="28" r="16" fill={body} />
          <circle cx="26" cy="25" r="3.4" fill="#0f172a" /><circle cx="38" cy="25" r="3.4" fill="#0f172a" />
          <circle cx="26.8" cy="24" r="1.1" fill="#fff" /><circle cx="38.8" cy="24" r="1.1" fill="#fff" />
          <ellipse cx="32" cy="33" rx="4" ry="3" fill={accent} />
          <path d="M32 36 Q32 40 28 41 M32 36 Q32 40 36 41" stroke="#0f172a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      );
    case "shark":
    case "dolphin":
    case "cat":
    case "lion":
    case "jaguar":
    case "serval":
    case "cheetah":
    case "quokka":
    case "mongoose":
    case "nyala":
    case "giraffe":
    case "antelope":
    case "fox":
    case "squirrel":
      return (
        <g>
          <path d="M14 26 L17 12 L26 20 Z" fill={body} stroke={accent} strokeWidth="1.2" />
          <path d="M50 26 L47 12 L38 20 Z" fill={body} stroke={accent} strokeWidth="1.2" />
          <path d="M16.5 22 L18 15.5 L23 19 Z" fill={accent} opacity="0.65" />
          <path d="M47.5 22 L46 15.5 L41 19 Z" fill={accent} opacity="0.65" />
          <circle cx="32" cy="32" r="16" fill={body} />
          <circle cx="26" cy="29" r="2.7" fill="#1f2937" /><circle cx="38" cy="29" r="2.7" fill="#1f2937" />
          <circle cx="26.9" cy="28.1" r="0.9" fill="#fff" /><circle cx="38.9" cy="28.1" r="0.9" fill="#fff" />
          <path d="M32 34 L30.2 36.4 L33.8 36.4 Z" fill={accent} />
          <path d="M32 37.5 Q32 41 28 42 M32 37.5 Q32 41 36 42" stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {(k === "lion" || k === "jaguar" || k === "serval" || k === "cheetah") && (
            <>
              <circle cx="22" cy="36" r="1.4" fill={accent} opacity="0.7" />
              <circle cx="42" cy="36" r="1.4" fill={accent} opacity="0.7" />
              <circle cx="24" cy="42" r="1.1" fill={accent} opacity="0.7" />
              <circle cx="40" cy="42" r="1.1" fill={accent} opacity="0.7" />
            </>
          )}
        </g>
      );
    case "turtle":
    case "gecko":
    case "iguana":
    case "dragon":
    case "newt":
    case "bee":
      return (
        <g>
          <ellipse cx="32" cy="34" rx="17" ry="15" fill={body} />
          <circle cx="32" cy="22" r="10" fill={body} />
          <circle cx="28" cy="21" r="2.6" fill="#1f2937" /><circle cx="36" cy="21" r="2.6" fill="#1f2937" />
          <circle cx="28.8" cy="20.1" r="0.9" fill="#fff" /><circle cx="36.8" cy="20.1" r="0.9" fill="#fff" />
          <path d="M32 26 Q32 29 29 30 M32 26 Q32 29 35 30" stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {k === "turtle" && (
            <>
              <path d="M20 30 Q32 20 44 30 Q44 42 32 46 Q20 42 20 30 Z" fill={accent} opacity="0.55" />
              <path d="M32 26 L32 46 M24 29 L40 43 M40 29 L24 43" stroke={accent} strokeWidth="1" opacity="0.5" />
            </>
          )}
          {k === "bee" && (
            <>
              <path d="M22 30 Q32 24 42 30" stroke={accent} strokeWidth="2" fill="none" />
              <path d="M22 37 Q32 31 42 37" stroke={accent} strokeWidth="2" fill="none" />
              <ellipse cx="20" cy="26" rx="6" ry="4" fill="#fff" opacity="0.85" transform="rotate(-30 20 26)" />
              <ellipse cx="44" cy="26" rx="6" ry="4" fill="#fff" opacity="0.85" transform="rotate(30 44 26)" />
            </>
          )}
          {(k === "dragon" || k === "gecko" || k === "iguana" || k === "newt") && (
            <>
              <path d="M18 22 Q10 14 8 20 Q10 24 16 25 Z" fill={accent} opacity="0.8" />
              <path d="M46 22 Q54 14 56 20 Q54 24 48 25 Z" fill={accent} opacity="0.8" />
              <circle cx="26" cy="42" r="1.6" fill={accent} opacity="0.6" />
              <circle cx="38" cy="42" r="1.6" fill={accent} opacity="0.6" />
            </>
          )}
        </g>
      );
    case "penguin":
      return (
        <g>
          <ellipse cx="32" cy="34" rx="17" ry="17" fill={body} />
          <ellipse cx="32" cy="38" rx="11" ry="12" fill="#f8fafc" />
          <circle cx="27" cy="26" r="2.6" fill="#0f172a" /><circle cx="37" cy="26" r="2.6" fill="#0f172a" />
          <path d="M29 30 L32 36 L35 30 Q32 32 29 30 Z" fill={accent} />
          <ellipse cx="22" cy="36" rx="4.5" ry="8" fill={body} transform="rotate(20 22 36)" />
          <ellipse cx="42" cy="36" rx="4.5" ry="8" fill={body} transform="rotate(-20 42 36)" />
          <ellipse cx="29" cy="52" rx="5" ry="2.6" fill={accent} />
          <ellipse cx="35" cy="52" rx="5" ry="2.6" fill={accent} />
        </g>
      );
    case "robot":
      return (
        <g>
          <rect x="16" y="18" width="32" height="28" rx="8" fill={body} />
          <rect x="21" y="25" width="9" height="7" rx="2" fill="#1e293b" />
          <rect x="34" y="25" width="9" height="7" rx="2" fill="#1e293b" />
          <circle cx="25.5" cy="28.5" r="1.6" fill={accent} /><circle cx="38.5" cy="28.5" r="1.6" fill={accent} />
          <rect x="26" y="38" width="12" height="2.6" rx="1.3" fill="#1e293b" />
          <line x1="32" y1="18" x2="32" y2="11" stroke={accent} strokeWidth="2" />
          <circle cx="32" cy="10" r="2.4" fill={accent} />
          <line x1="16" y1="30" x2="9" y2="30" stroke={body} strokeWidth="3" strokeLinecap="round" />
          <line x1="48" y1="30" x2="55" y2="30" stroke={body} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "alien":
      return (
        <g>
          <ellipse cx="32" cy="32" rx="15" ry="17" fill={body} />
          <ellipse cx="26" cy="30" rx="4" ry="5.5" fill="#1f2937" transform="rotate(-14 26 30)" />
          <ellipse cx="38" cy="30" rx="4" ry="5.5" fill="#1f2937" transform="rotate(14 38 30)" />
          <circle cx="26.5" cy="29" r="1.4" fill="#fff" /><circle cx="38.5" cy="29" r="1.4" fill="#fff" />
          <path d="M28 40 Q32 43 36 40" stroke={accent} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <line x1="19" y1="24" x2="13" y2="20" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="45" y1="24" x2="51" y2="20" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "bat":
      return (
        <g>
          <path d="M32 26 Q18 18 6 26 Q12 32 10 42 Q20 38 24 44 Q28 38 32 42 Z" fill={body} />
          <path d="M32 26 Q46 18 58 26 Q52 32 54 42 Q44 38 40 44 Q36 38 32 42 Z" fill={body} />
          <circle cx="32" cy="30" r="11" fill={body} />
          <circle cx="28" cy="29" r="2.3" fill="#fff" /><circle cx="36" cy="29" r="2.3" fill="#fff" />
          <circle cx="28" cy="29.6" r="1.1" fill="#111" /><circle cx="36" cy="29.6" r="1.1" fill="#111" />
          <path d="M29 35 L32 38 L35 35 Z" fill={accent} />
        </g>
      );
    case "aardvark":
    case "pangolin":
      return (
        <g>
          <ellipse cx="34" cy="34" rx="16" ry="15" fill={body} />
          <ellipse cx="34" cy="28" rx="12" ry="10" fill={body} />
          <path d="M44 26 Q54 24 52 32 Q48 36 42 34 Z" fill={body} />
          <circle cx="42" cy="28" r="1.8" fill="#1f2937" />
          <circle cx="36" cy="26" r="2" fill="#1f2937" />
          <path d="M20 36 Q12 40 14 48" stroke={body} strokeWidth="4" fill="none" strokeLinecap="round" />
          {k === "pangolin" && (
            <>
              <path d="M24 26 Q34 18 44 26" stroke={accent} strokeWidth="1.6" fill="none" opacity="0.7" />
              <path d="M22 32 Q34 24 46 32" stroke={accent} strokeWidth="1.6" fill="none" opacity="0.7" />
              <path d="M22 38 Q34 30 46 38" stroke={accent} strokeWidth="1.6" fill="none" opacity="0.7" />
            </>
          )}
        </g>
      );
    default:
      return (
        <g>
          <circle cx="32" cy="32" r="16" fill={body} />
          <circle cx="26" cy="29" r="2.6" fill="#1f2937" /><circle cx="38" cy="29" r="2.6" fill="#1f2937" />
          <path d="M32 35 Q32 39 28.5 40 M32 35 Q32 39 35.5 40" stroke={accent} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

export function Avatar({
  avatar,
  size = 40,
  className = "",
  ring,
}: {
  avatar: string;
  size?: number;
  className?: string;
  ring?: string;
}) {
  const key = (avatar in PALETTE ? avatar : "fox") as AvatarKey;
  const [bg] = PALETTE[key];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${bg}, ${bg}cc)`,
        boxShadow: ring ? `0 0 0 2.5px ${ring}` : undefined,
      }}
      role="img"
      aria-label={`${key} avatar`}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} className="rounded-full">
        <AvatarSvg k={key} />
      </svg>
    </span>
  );
}

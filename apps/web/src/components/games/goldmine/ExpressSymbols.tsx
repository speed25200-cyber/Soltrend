'use client';

import { useId } from 'react';
import { BELL, GOLDMINE, GTRAIN, SCATTER, TRAIN, WILD, type TrainColor } from '@/lib/slots/gold-express';

/**
 * The Gold Mine Express symbol set, drawn as layered vector art: each symbol
 * reads instantly at grid size and stays sharp at any resolution. The set
 * mirrors the modern online game — card ranks, prospecting gear, the Wild
 * lantern, Gold Mines with their cash badge, coloured trains, the Bell, the
 * Golden Train and the dynamite Scatter.
 */

export const TRAIN_HEX: Record<TrainColor, { a: string; b: string; glow: string }> = {
  green: { a: '#34d399', b: '#065f46', glow: '#6ee7b7' },
  blue: { a: '#38bdf8', b: '#1e3a8a', glow: '#7dd3fc' },
  purple: { a: '#c084fc', b: '#6b21a8', glow: '#d8b4fe' },
  red: { a: '#fb7185', b: '#9f1239', glow: '#fda4af' },
};

const RANK_COLORS: Record<number, { a: string; b: string; text: string }> = {
  0: { a: '#2dd4bf', b: '#0f766e', text: '#ccfbf1' }, // 10
  1: { a: '#4ade80', b: '#166534', text: '#dcfce7' }, // J
  2: { a: '#60a5fa', b: '#1e40af', text: '#dbeafe' }, // Q
  3: { a: '#a78bfa', b: '#5b21b6', text: '#ede9fe' }, // K
  4: { a: '#f87171', b: '#991b1b', text: '#fee2e2' }, // A
};

const RANK_LABEL = ['10', 'J', 'Q', 'K', 'A'];

function Rank({ sym, uid }: { sym: number; uid: string }) {
  const c = RANK_COLORS[sym];
  return (
    <>
      <defs>
        <linearGradient id={`rk${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.a} />
          <stop offset="1" stopColor={c.b} />
        </linearGradient>
      </defs>
      <rect x="12" y="10" width="76" height="80" rx="14" fill={`url(#rk${uid})`} />
      <rect x="16" y="14" width="68" height="72" rx="10" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="3" />
      <text x="50" y="66" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize={sym === 0 ? 34 : 42} fill={c.text}>
        {RANK_LABEL[sym]}
      </text>
    </>
  );
}

function Gear({ sym, uid }: { sym: number; uid: string }) {
  switch (sym) {
    case 5: // lamp
      return (
        <g>
          <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fcd34d" /><stop offset="1" stopColor="#b45309" /></linearGradient></defs>
          <rect x="30" y="26" width="40" height="52" rx="10" fill={`url(#g${uid})`} />
          <ellipse cx="50" cy="52" rx="13" ry="18" fill="#fffbeb" opacity="0.92" />
          <rect x="26" y="18" width="48" height="10" rx="5" fill="#78350f" />
          <path d="M42 16 C42 6 58 6 58 16" stroke="#92400e" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="24" y="76" width="52" height="9" rx="4" fill="#78350f" />
        </g>
      );
    case 6: // shovel
      return (
        <g>
          <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#cbd5e1" /><stop offset="1" stopColor="#475569" /></linearGradient></defs>
          <rect x="46" y="10" width="9" height="52" rx="4" fill="#92400e" transform="rotate(18 50 40)" />
          <path d="M38 58 L66 70 L56 92 L28 80 Z" fill={`url(#g${uid})`} />
          <path d="M38 58 L66 70 L62 78 L34 66 Z" fill="#ffffff" opacity="0.25" />
          <rect x="40" y="6" width="22" height="10" rx="5" fill="#78350f" transform="rotate(18 50 10)" />
        </g>
      );
    case 7: // hard hat
      return (
        <g>
          <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" /><stop offset="1" stopColor="#ca8a04" /></linearGradient></defs>
          <path d="M20 58 C20 32 36 20 50 20 C64 20 80 32 80 58 Z" fill={`url(#g${uid})`} />
          <rect x="44" y="14" width="12" height="24" rx="5" fill="#eab308" />
          <rect x="12" y="56" width="76" height="10" rx="5" fill="#a16207" />
          <path d="M28 50 C32 36 42 28 50 27" stroke="#fef9c3" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case 8: // money bag
      return (
        <g>
          <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6a45b" /><stop offset="1" stopColor="#7c4a1e" /></linearGradient></defs>
          <path d="M50 24 C68 24 82 46 82 66 C82 82 68 90 50 90 C32 90 18 82 18 66 C18 46 32 24 50 24 Z" fill={`url(#g${uid})`} />
          <path d="M38 22 L62 22 L58 32 L42 32 Z" fill="#78350f" />
          <rect x="36" y="14" width="28" height="9" rx="4" fill="#92400e" />
          <text x="50" y="74" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="30" fill="#fef3c7">$</text>
          <ellipse cx="38" cy="46" rx="7" ry="11" fill="#ffffff" opacity="0.18" transform="rotate(-18 38 46)" />
        </g>
      );
    default: // 9 — gold bars
      return (
        <g>
          <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#b45309" /></linearGradient></defs>
          <path d="M22 62 L34 42 L62 42 L50 62 Z" fill={`url(#g${uid})`} />
          <path d="M50 62 L62 42 L90 42 L78 62 Z" fill={`url(#g${uid})`} />
          <path d="M34 84 L46 64 L74 64 L62 84 Z" fill={`url(#g${uid})`} />
          <path d="M22 62 L50 62 L50 70 L22 70 Z M50 62 L78 62 L78 70 L50 70 Z M34 84 L62 84 L62 90 L34 90 Z" fill="#78350f" opacity="0.55" />
          <path d="M34 42 L62 42 L58 47 L30 47 Z M62 42 L90 42 L86 47 L58 47 Z M46 64 L74 64 L70 69 L42 69 Z" fill="#ffffff" opacity="0.4" />
        </g>
      );
  }
}

function Loco({ hex, uid, golden }: { hex: { a: string; b: string }; uid: string; golden?: boolean }) {
  return (
    <g>
      <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hex.a} /><stop offset="1" stopColor={hex.b} /></linearGradient></defs>
      <rect x="16" y="38" width="56" height="26" rx="6" fill={`url(#g${uid})`} />
      <rect x="22" y="22" width="24" height="20" rx="4" fill={hex.b} />
      <rect x="58" y="16" width="10" height="24" rx="3" fill={hex.b} />
      <rect x="70" y="44" width="12" height="12" rx="3" fill={hex.b} />
      <circle cx="30" cy="70" r="9" fill="#1f2937" />
      <circle cx="62" cy="70" r="9" fill="#1f2937" />
      <circle cx="30" cy="70" r="3.5" fill="#9ca3af" />
      <circle cx="62" cy="70" r="3.5" fill="#9ca3af" />
      <circle cx="24" cy="50" r="5" fill={golden ? '#fffbeb' : '#fde68a'} />
      {golden && <path d="M50 4 L54 14 L64 15 L56 21 L58 31 L50 26 L42 31 L44 21 L36 15 L46 14 Z" fill="#fde68a" />}
    </g>
  );
}

export function ExpressSymbol({
  sym,
  size = 48,
  trainColor,
}: {
  sym: number;
  size?: number;
  trainColor?: TrainColor | null;
}) {
  const uid = useId().replace(/:/g, '');
  let body: React.ReactNode;

  if (sym <= 4) body = <Rank sym={sym} uid={uid} />;
  else if (sym <= 9) body = <Gear sym={sym} uid={uid} />;
  else if (sym === WILD) {
    body = (
      <g>
        <Gear sym={5} uid={uid} />
        <rect x="14" y="74" width="72" height="18" rx="9" fill="#7c2d12" stroke="#fdba74" strokeWidth="2" />
        <text x="50" y="88" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="15" fill="#ffedd5">WILD</text>
      </g>
    );
  } else if (sym === GOLDMINE) {
    body = (
      <g>
        <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#57534e" /><stop offset="1" stopColor="#1c1917" /></linearGradient></defs>
        <path d="M14 88 L14 52 C14 30 32 16 50 16 C68 16 86 30 86 52 L86 88 Z" fill={`url(#g${uid})`} />
        <path d="M30 88 L30 56 C30 42 40 32 50 32 C60 32 70 42 70 56 L70 88 Z" fill="#0c0a09" />
        <circle cx="44" cy="72" r="7" fill="#fcd34d" />
        <circle cx="56" cy="66" r="8" fill="#fde68a" />
        <circle cx="52" cy="78" r="6" fill="#fbbf24" />
        <rect x="10" y="84" width="80" height="6" rx="3" fill="#44403c" />
        <path d="M20 46 C26 32 38 24 50 23" stroke="#a8a29e" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.5" />
      </g>
    );
  } else if (sym === TRAIN) {
    body = <Loco hex={TRAIN_HEX[trainColor ?? 'green']} uid={uid} />;
  } else if (sym === BELL) {
    body = (
      <g>
        <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#b45309" /></linearGradient></defs>
        <path d="M50 18 C66 18 76 34 76 52 L76 62 L24 62 L24 52 C24 34 34 18 50 18 Z" fill={`url(#g${uid})`} />
        <rect x="44" y="10" width="12" height="10" rx="4" fill="#92400e" />
        <rect x="18" y="62" width="64" height="9" rx="4" fill="#78350f" />
        <circle cx="50" cy="76" r="8" fill="#fcd34d" />
        <path d="M34 44 C37 33 44 26 50 25" stroke="#fffbeb" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.65" />
      </g>
    );
  } else if (sym === GTRAIN) {
    body = <Loco hex={{ a: '#fde68a', b: '#b45309' }} uid={uid} golden />;
  } else {
    // SCATTER — dynamite bundle
    body = (
      <g>
        <rect x="26" y="30" width="14" height="46" rx="5" fill="#dc2626" transform="rotate(-8 33 53)" />
        <rect x="43" y="28" width="14" height="48" rx="5" fill="#b91c1c" />
        <rect x="60" y="30" width="14" height="46" rx="5" fill="#dc2626" transform="rotate(8 67 53)" />
        <rect x="24" y="46" width="52" height="10" rx="4" fill="#78350f" />
        <path d="M50 26 C52 18 58 14 64 12" stroke="#a8a29e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="65" cy="11" r="4" fill="#fcd34d" />
        <circle cx="65" cy="11" r="7" fill="#fcd34d" opacity="0.3" />
      </g>
    );
  }

  const glowColor =
    sym === GTRAIN ? '#fde68a' : sym === BELL ? '#fcd34d' : sym === SCATTER ? '#f87171' : sym === TRAIN ? TRAIN_HEX[trainColor ?? 'green'].glow : '#000';

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <g style={{ filter: `drop-shadow(0 2px 6px ${glowColor}55)` }}>{body}</g>
    </svg>
  );
}

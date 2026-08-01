'use client';

import { useId } from 'react';
import { BELL, GOLDMINE, GTRAIN, SCATTER, TRAIN, WILD, type TrainColor } from '@/lib/slots/gold-express';

/**
 * The Gold Mine Express symbol set, drawn the way the reference game draws it:
 * warm, hand-illustrated, full of gold. Golden serif ranks on parchment,
 * prospecting gear, the gold nugget with its cash value, the coloured
 * locomotives, the green wild lantern, the golden bell and the dynamite
 * SCATTER — every symbol a little piece of the canyon.
 */

export const TRAIN_HEX: Record<TrainColor, { a: string; b: string; glow: string }> = {
  green: { a: '#34d399', b: '#065f46', glow: '#6ee7b7' },
  blue: { a: '#38bdf8', b: '#1e3a8a', glow: '#7dd3fc' },
  purple: { a: '#c084fc', b: '#6b21a8', glow: '#d8b4fe' },
  red: { a: '#fb7185', b: '#9f1239', glow: '#fda4af' },
};

const RANK_LABEL = ['10', 'J', 'Q', 'K', 'A'];

/** Golden serif rank letter, like the reference's big gilded cards. */
function RankGlyph({ sym }: { sym: number }) {
  return (
    <>
      <text
        x="50"
        y="63"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="900"
        fontSize={sym === 0 ? 40 : 52}
        fill="url(#rg)"
        stroke="#7c4a12"
        strokeWidth="1.2"
      >
        {RANK_LABEL[sym]}
      </text>
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.45" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#c07f16" />
        </linearGradient>
      </defs>
    </>
  );
}

/** The reference game's side-view locomotive, in any colour. */
function Loco({ hex, uid }: { hex: { a: string; b: string }; uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`lc${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hex.a} />
          <stop offset="1" stopColor={hex.b} />
        </linearGradient>
      </defs>
      {/* boiler */}
      <rect x="18" y="34" width="52" height="24" rx="10" fill={`url(#lc${uid})`} />
      {/* cab */}
      <rect x="52" y="18" width="26" height="26" rx="4" fill={hex.b} />
      <rect x="56" y="22" width="12" height="10" rx="2" fill="#fde68a" opacity="0.9" />
      {/* chimney + dome */}
      <rect x="20" y="24" width="8" height="12" rx="3" fill={hex.b} />
      <ellipse cx="36" cy="32" rx="7" ry="5" fill={hex.b} />
      {/* cowcatcher */}
      <path d="M8 58 L22 58 L14 70 L6 70 Z" fill={hex.b} />
      {/* frame + wheels */}
      <rect x="14" y="56" width="62" height="7" rx="3" fill="#3f2a12" />
      <circle cx="30" cy="70" r="9" fill="#292524" />
      <circle cx="30" cy="70" r="4" fill="#a8a29e" />
      <circle cx="54" cy="70" r="9" fill="#292524" />
      <circle cx="54" cy="70" r="4" fill="#a8a29e" />
      <circle cx="68" cy="71" r="6" fill="#292524" />
      <circle cx="68" cy="71" r="2.5" fill="#a8a29e" />
      {/* headlamp */}
      <circle cx="16" cy="42" r="5" fill="#fff7d6" />
    </g>
  );
}

export function CanyonSymbol({
  sym,
  size = 52,
  cash,
  trainColor,
}: {
  sym: number;
  size?: number;
  cash?: number | null;
  trainColor?: TrainColor | null;
}) {
  const uid = useId().replace(/:/g, '');
  let body: React.ReactNode;

  if (sym <= 4) {
    body = <RankGlyph sym={sym} />;
  } else if (sym === 5) {
    // lamp
    body = (
      <g>
        <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fcd34d" /><stop offset="1" stopColor="#b45309" /></linearGradient></defs>
        <rect x="32" y="26" width="36" height="48" rx="10" fill={`url(#g${uid})`} />
        <ellipse cx="50" cy="50" rx="11" ry="16" fill="#fffbeb" opacity="0.95" />
        <rect x="28" y="18" width="44" height="10" rx="5" fill="#78350f" />
        <path d="M42 16 C42 8 58 8 58 16" stroke="#92400e" strokeWidth="5" fill="none" strokeLinecap="round" />
        <rect x="26" y="74" width="48" height="9" rx="4" fill="#78350f" />
      </g>
    );
  } else if (sym === 6) {
    // shovel
    body = (
      <g transform="rotate(16 50 50)">
        <rect x="45" y="10" width="9" height="52" rx="4" fill="#92400e" />
        <path d="M38 58 L66 68 L56 92 L28 82 Z" fill="#94a3b8" />
        <path d="M38 58 L66 68 L62 76 L34 66 Z" fill="#e2e8f0" />
        <rect x="38" y="6" width="24" height="10" rx="5" fill="#78350f" />
      </g>
    );
  } else if (sym === 7) {
    // hard hat
    body = (
      <g>
        <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" /><stop offset="1" stopColor="#ca8a04" /></linearGradient></defs>
        <path d="M20 58 C20 32 36 20 50 20 C64 20 80 32 80 58 Z" fill={`url(#g${uid})`} />
        <rect x="44" y="14" width="12" height="24" rx="5" fill="#eab308" />
        <rect x="12" y="56" width="76" height="10" rx="5" fill="#a16207" />
        <path d="M28 50 C32 36 42 28 50 27" stroke="#fef9c3" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
      </g>
    );
  } else if (sym === 8) {
    // money bag
    body = (
      <g>
        <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6a45b" /><stop offset="1" stopColor="#7c4a1e" /></linearGradient></defs>
        <path d="M50 24 C68 24 82 46 82 66 C82 82 68 90 50 90 C32 90 18 82 18 66 C18 46 32 24 50 24 Z" fill={`url(#g${uid})`} />
        <path d="M38 22 L62 22 L58 32 L42 32 Z" fill="#78350f" />
        <rect x="36" y="14" width="28" height="9" rx="4" fill="#92400e" />
        <text x="50" y="74" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="30" fill="#fef3c7">$</text>
      </g>
    );
  } else if (sym === 9) {
    // gold bars
    body = (
      <g>
        <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#b45309" /></linearGradient></defs>
        <path d="M22 62 L34 42 L62 42 L50 62 Z" fill={`url(#g${uid})`} />
        <path d="M50 62 L62 42 L90 42 L78 62 Z" fill={`url(#g${uid})`} />
        <path d="M34 84 L46 64 L74 64 L62 84 Z" fill={`url(#g${uid})`} />
        <path d="M34 42 L62 42 L58 47 L30 47 Z M62 42 L90 42 L86 47 L58 47 Z M46 64 L74 64 L70 69 L42 69 Z" fill="#fff7d6" opacity="0.8" />
      </g>
    );
  } else if (sym === WILD) {
    // the green wild lantern
    body = (
      <g>
        <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4ade80" /><stop offset="1" stopColor="#166534" /></linearGradient></defs>
        <rect x="30" y="24" width="40" height="50" rx="10" fill="#1c1917" stroke={`url(#g${uid})`} strokeWidth="4" />
        <ellipse cx="50" cy="50" rx="11" ry="16" fill="#d1fae5" opacity="0.95" />
        <ellipse cx="50" cy="50" rx="6" ry="10" fill="#34d399" opacity="0.7" />
        <rect x="26" y="16" width="48" height="10" rx="5" fill="#14532d" />
        <path d="M42 14 C42 6 58 6 58 14" stroke="#166534" strokeWidth="5" fill="none" strokeLinecap="round" />
        <rect x="24" y="74" width="52" height="9" rx="4" fill="#14532d" />
        <text x="50" y="92" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="13" fill="#4ade80">WILD</text>
      </g>
    );
  } else if (sym === GOLDMINE) {
    // the gold nugget with its cash value
    body = (
      <g>
        <defs><linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#c07f16" /></linearGradient></defs>
        <circle cx="40" cy="52" r="18" fill={`url(#g${uid})`} />
        <circle cx="60" cy="44" r="14" fill={`url(#g${uid})`} />
        <circle cx="56" cy="62" r="12" fill={`url(#g${uid})`} />
        <circle cx="36" cy="46" r="5" fill="#fff7d6" opacity="0.85" />
        <circle cx="57" cy="39" r="4" fill="#fff7d6" opacity="0.85" />
        {cash != null && (
          <>
            <rect x="20" y="72" width="60" height="22" rx="11" fill="#3f2a12" stroke="#fcd34d" strokeWidth="2" />
            <text x="50" y="88" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="16" fill="#fde68a">
              {cash.toFixed(cash < 2 ? 2 : 1)}
            </text>
          </>
        )}
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
    body = <Loco hex={{ a: '#fde68a', b: '#b45309' }} uid={uid} />;
  } else {
    // SCATTER — dynamite bundle + label
    body = (
      <g>
        <rect x="26" y="24" width="14" height="42" rx="5" fill="#dc2626" transform="rotate(-8 33 45)" />
        <rect x="43" y="22" width="14" height="44" rx="5" fill="#b91c1c" />
        <rect x="60" y="24" width="14" height="42" rx="5" fill="#dc2626" transform="rotate(8 67 45)" />
        <rect x="24" y="40" width="52" height="10" rx="4" fill="#78350f" />
        <path d="M50 20 C52 12 58 8 64 6" stroke="#a8a29e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="65" cy="5" r="4" fill="#fcd34d" />
        <circle cx="65" cy="5" r="7" fill="#fcd34d" opacity="0.35" />
        <text x="50" y="90" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="15" fill="#dc2626" letterSpacing="1">SCATTER</text>
      </g>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {body}
    </svg>
  );
}

'use client';

import { useId } from 'react';
import { BELL, GOLDMINE, GTRAIN, SCATTER, TRAIN, WILD, type TrainColor } from '@/lib/slots/gold-express';

/**
 * The Gold Mine Express symbol set — atelier-grade vector art. Every symbol
 * is built from layered gradients, rim lights and hand-placed highlights:
 * gilded serif ranks with a bevel and a shine pass, glass lanterns with a
 * live flame, faceted nuggets with sparkle stars, full-detailed locomotives
 * with boiler bands, spoked counterweighted wheels and a real connecting rod.
 * No flat emoji shapes anywhere.
 */

export const TRAIN_HEX: Record<TrainColor, { a: string; b: string; glow: string }> = {
  green: { a: '#34d399', b: '#065f46', glow: '#6ee7b7' },
  blue: { a: '#38bdf8', b: '#1e3a8a', glow: '#7dd3fc' },
  purple: { a: '#c084fc', b: '#6b21a8', glow: '#d8b4fe' },
  red: { a: '#fb7185', b: '#9f1239', glow: '#fda4af' },
};

const RANK_LABEL = ['10', 'J', 'Q', 'K', 'A'];

/** Tiny four-point sparkle used on gold surfaces. */
function Sparkle({ x, y, s, o = 0.9 }: { x: number; y: number; s: number; o?: number }) {
  return (
    <path
      d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`}
      fill="#fffbe8"
      opacity={o}
    />
  );
}

/* ------------------------------------------------------------------ ranks */

/** Gilded serif rank: dark bevel underneath, gold face, shine streak on top. */
function RankGlyph({ sym, uid }: { sym: number; uid: string }) {
  const size = sym === 0 ? 38 : 52;
  return (
    <g>
      <defs>
        <linearGradient id={`rg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7d6" />
          <stop offset="0.42" stopColor="#fcd34d" />
          <stop offset="0.78" stopColor="#e8a428" />
          <stop offset="1" stopColor="#b06f14" />
        </linearGradient>
        <linearGradient id={`rs${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffbe8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fffbe8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* bevel */}
      <text x="51.5" y="64.5" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="900" fontSize={size} fill="#5b3410">
        {RANK_LABEL[sym]}
      </text>
      {/* face */}
      <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="900" fontSize={size} fill={`url(#rg${uid})`}>
        {RANK_LABEL[sym]}
      </text>
      {/* shine pass over the upper half of the letter */}
      <text x="50" y="62" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="900" fontSize={size} fill={`url(#rs${uid})`} opacity="0.5">
        {RANK_LABEL[sym]}
      </text>
    </g>
  );
}

/* ------------------------------------------------------- full-detail loco */

function Loco({ hex, uid }: { hex: { a: string; b: string }; uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`lb${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hex.a} />
          <stop offset="0.55" stopColor={hex.b} />
          <stop offset="1" stopColor={hex.b} />
        </linearGradient>
        <linearGradient id={`lt${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`lw${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#57534e" />
          <stop offset="1" stopColor="#1c1917" />
        </linearGradient>
      </defs>

      {/* boiler with rim light and banding */}
      <rect x="16" y="32" width="56" height="26" rx="12" fill={`url(#lb${uid})`} />
      <rect x="16" y="32" width="56" height="9" rx="6" fill={`url(#lt${uid})`} />
      {[26, 38, 50, 62].map((x) => (
        <rect key={x} x={x} y="32" width="2.5" height="26" fill="#000" opacity="0.18" />
      ))}
      {/* chimney with cap */}
      <rect x="18" y="20" width="8" height="14" rx="3" fill={hex.b} />
      <ellipse cx="22" cy="19" rx="6.5" ry="3.5" fill={hex.b} />
      <ellipse cx="22" cy="18" rx="6.5" ry="3" fill={hex.a} />
      {/* steam dome */}
      <ellipse cx="38" cy="30" rx="7" ry="5" fill={hex.b} />
      <ellipse cx="36.5" cy="28" rx="3" ry="2" fill="#fff" opacity="0.4" />
      {/* headlamp with glow */}
      <circle cx="15" cy="44" r="5.5" fill="#3f2a12" />
      <circle cx="15" cy="44" r="3.6" fill="#fff3c4" />
      <circle cx="15" cy="44" r="7.5" fill="#fff3c4" opacity="0.25" />
      {/* cab */}
      <rect x="52" y="14" width="28" height="30" rx="5" fill={hex.b} />
      <rect x="52" y="14" width="28" height="10" rx="5" fill={`url(#lt${uid})`} opacity="0.7" />
      <rect x="57" y="20" width="12" height="11" rx="2" fill="#2a1a08" />
      <rect x="58.5" y="21.5" width="9" height="8" rx="1.5" fill="#ffe9b8" opacity="0.9" />
      {/* roof lip */}
      <rect x="50" y="11" width="32" height="5" rx="2.5" fill={hex.b} />
      {/* frame + cowcatcher */}
      <rect x="12" y="56" width="66" height="7" rx="3" fill="#3f2a12" />
      <rect x="12" y="56" width="66" height="2.5" rx="1.2" fill="#000" opacity="0.35" />
      <path d="M8 58 L24 58 L15 72 L5 72 Z" fill={hex.b} />
      <path d="M8 58 L24 58 L21 63 L6.5 63 Z" fill={hex.a} opacity="0.7" />
      <path d="M9.5 61 L19 61 M8 64.5 L17 64.5 M6.5 68 L15 68" stroke="#000" strokeWidth="1.2" opacity="0.3" />
      {/* spoked wheels + counterweights + rods */}
      {[
        { cx: 30, r: 10 },
        { cx: 56, r: 10 },
        { cx: 70, r: 7 },
      ].map((w, i) => (
        <g key={i}>
          <circle cx={w.cx} cy="70" r={w.r} fill={`url(#lw${uid})`} />
          {Array.from({ length: 6 }).map((_, k) => (
            <line
              key={k}
              x1={w.cx}
              y1="70"
              x2={w.cx + w.r * Math.cos((k * Math.PI) / 3)}
              y2={70 + w.r * Math.sin((k * Math.PI) / 3)}
              stroke="#78716c"
              strokeWidth="1.4"
            />
          ))}
          {/* counterweight */}
          <path
            d={`M${w.cx} 70 m ${w.r * 0.55} 0 a ${w.r * 0.45} ${w.r * 0.45} 0 1 0 ${-w.r * 1.1} 0 a ${w.r * 0.45} ${w.r * 0.45} 0 1 0 ${w.r * 1.1} 0`}
            fill="#44403c"
            transform={`rotate(35 ${w.cx} 70)`}
          />
          <circle cx={w.cx} cy="70" r={w.r * 0.38} fill="#a8a29e" />
          <circle cx={w.cx - w.r * 0.15} cy="69.8" r={w.r * 0.12} fill="#e7e5e4" opacity="0.8" />
        </g>
      ))}
      {/* the connecting rod, drive wheel to piston */}
      <rect x="28" y="66.5" width="42" height="3" rx="1.5" fill="#a8a29e" />
      <rect x="28" y="66.5" width="42" height="1.2" rx="0.6" fill="#e7e5e4" opacity="0.7" />
      <circle cx="30" cy="68" r="2.4" fill="#78716c" />
      <circle cx="56" cy="68" r="2.4" fill="#78716c" />
      {/* piston rod into the frame */}
      <rect x="66" y="67" width="10" height="2.4" rx="1.2" fill="#a8a29e" />
    </g>
  );
}

/* ---------------------------------------------------------------- symbols */

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
    body = <RankGlyph sym={sym} uid={uid} />;
  } else if (sym === 5) {
    // the miner's lamp — brass cage, glass chimney, live flame
    body = (
      <g>
        <defs>
          <linearGradient id={`m${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fcd34d" />
            <stop offset="1" stopColor="#b45309" />
          </linearGradient>
          <radialGradient id={`f${uid}`} cx="0.5" cy="0.6" r="0.55">
            <stop offset="0" stopColor="#fffbe8" />
            <stop offset="0.55" stopColor="#ffd76a" />
            <stop offset="1" stopColor="#f08a18" />
          </radialGradient>
        </defs>
        {/* glow behind glass */}
        <ellipse cx="50" cy="52" rx="18" ry="24" fill="#ffd76a" opacity="0.22" />
        {/* cage */}
        <rect x="33" y="27" width="34" height="48" rx="9" fill="none" stroke={`url(#m${uid})`} strokeWidth="4" />
        <rect x="30" y="24" width="40" height="7" rx="3.5" fill={`url(#m${uid})`} />
        <rect x="28" y="73" width="44" height="8" rx="4" fill="#7c4a12" />
        <path d="M41 22 C41 10 59 10 59 22" stroke="#7c4a12" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        {/* glass + flame */}
        <ellipse cx="50" cy="52" rx="11" ry="17" fill={`url(#f${uid})`} opacity="0.96" />
        <path d="M50 60 C45 54 46 47 50 40 C54 47 55 54 50 60 Z" fill="#fff7d6" />
        <path d="M50 57 C47.5 53.5 48 49 50 45 C52 49 52.5 53.5 50 57 Z" fill="#f59e0b" opacity="0.85" />
        {/* cage bars over glass */}
        <line x1="50" y1="29" x2="50" y2="75" stroke={`url(#m${uid})`} strokeWidth="2" opacity="0.65" />
      </g>
    );
  } else if (sym === 6) {
    // shovel — oiled wood shaft, forged blade with edge light
    body = (
      <g transform="rotate(16 50 50)">
        <defs>
          <linearGradient id={`w${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a16207" />
            <stop offset="0.5" stopColor="#d6a45b" />
            <stop offset="1" stopColor="#7c4a12" />
          </linearGradient>
          <linearGradient id={`b${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e2e8f0" />
            <stop offset="0.6" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#475569" />
          </linearGradient>
        </defs>
        <rect x="44" y="8" width="10" height="54" rx="5" fill={`url(#w${uid})`} />
        <rect x="46.5" y="10" width="2" height="50" rx="1" fill="#5b3410" opacity="0.5" />
        <rect x="38" y="5" width="22" height="9" rx="4.5" fill="#6e3a12" />
        <rect x="38" y="5" width="22" height="3.5" rx="1.75" fill="#9c6220" />
        <path d="M36 58 L68 68 L58 94 L26 84 Z" fill={`url(#b${uid})`} />
        <path d="M36 58 L68 68 L64 77 L32 67 Z" fill="#f8fafc" opacity="0.55" />
        <path d="M30 80 L56 88" stroke="#334155" strokeWidth="2" opacity="0.5" />
      </g>
    );
  } else if (sym === 7) {
    // hard hat — gloss dome, ridge, brim, headlamp
    body = (
      <g>
        <defs>
          <linearGradient id={`h${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fef08a" />
            <stop offset="0.6" stopColor="#facc15" />
            <stop offset="1" stopColor="#a16207" />
          </linearGradient>
        </defs>
        <path d="M20 58 C20 31 36 19 50 19 C64 19 80 31 80 58 Z" fill={`url(#h${uid})`} />
        <rect x="44" y="13" width="12" height="25" rx="6" fill="#eab308" />
        <rect x="46.5" y="14" width="3.5" height="22" rx="1.75" fill="#fef9c3" opacity="0.6" />
        <path d="M26 48 C30 33 41 25 50 24" stroke="#fefce8" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.65" />
        <rect x="11" y="56" width="78" height="10" rx="5" fill="#854d0e" />
        <rect x="11" y="56" width="78" height="4" rx="2" fill="#a16207" />
        {/* headlamp */}
        <circle cx="50" cy="42" r="6" fill="#5b3410" />
        <circle cx="50" cy="42" r="4" fill="#fff7d6" />
        <circle cx="50" cy="42" r="8" fill="#fff7d6" opacity="0.25" />
      </g>
    );
  } else if (sym === 8) {
    // money bag — cinched sack with folds, rope, embossed $
    body = (
      <g>
        <defs>
          <radialGradient id={`s${uid}`} cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#e9c98f" />
            <stop offset="0.6" stopColor="#c99b5e" />
            <stop offset="1" stopColor="#8a5a24" />
          </radialGradient>
        </defs>
        <path d="M50 24 C68 24 82 46 82 66 C82 82 68 90 50 90 C32 90 18 82 18 66 C18 46 32 24 50 24 Z" fill={`url(#s${uid})`} />
        <path d="M33 38 C28 50 28 66 34 78" stroke="#7c4a1e" strokeWidth="2.5" fill="none" opacity="0.5" />
        <path d="M67 38 C72 50 72 66 66 78" stroke="#7c4a1e" strokeWidth="2.5" fill="none" opacity="0.5" />
        <ellipse cx="40" cy="42" rx="7" ry="12" fill="#fff" opacity="0.18" transform="rotate(-16 40 42)" />
        <path d="M38 22 L62 22 L58 33 L42 33 Z" fill="#8a5a24" />
        <rect x="35" y="13" width="30" height="9" rx="4.5" fill="#a16207" />
        <path d="M35 17.5 L65 17.5" stroke="#5b3410" strokeWidth="2" opacity="0.6" />
        <text x="50" y="75" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="30" fill="#5b3410" opacity="0.55">$</text>
        <text x="49" y="74" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="30" fill="#fef3c7">$</text>
      </g>
    );
  } else if (sym === 9) {
    // gold bars — beveled ingots, deep shine, sparkle
    body = (
      <g>
        <defs>
          <linearGradient id={`gb${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fef3c7" />
            <stop offset="0.5" stopColor="#fcd34d" />
            <stop offset="1" stopColor="#c07f16" />
          </linearGradient>
        </defs>
        {[
          { x: 18, y: 46, w: 36 },
          { x: 48, y: 46, w: 36 },
          { x: 33, y: 66, w: 36 },
        ].map((b, i) => (
          <g key={i}>
            <path d={`M${b.x} ${b.y + 18} L${b.x + 10} ${b.y} L${b.x + b.w} ${b.y} L${b.x + b.w - 10} ${b.y + 18} Z`} fill={`url(#gb${uid})`} />
            <path d={`M${b.x + 10} ${b.y} L${b.x + b.w} ${b.y} L${b.x + b.w - 5} ${b.y + 4} L${b.x + 15} ${b.y + 4} Z`} fill="#fffbe8" opacity="0.75" />
            <path d={`M${b.x + b.w - 10} ${b.y + 18} L${b.x + b.w} ${b.y} L${b.x + b.w} ${b.y + 5} L${b.x + b.w - 10} ${b.y + 23} Z`} fill="#8a5a10" opacity="0.7" />
          </g>
        ))}
        <Sparkle x={30} y={40} s={6} />
        <Sparkle x={68} y={62} s={5} o={0.8} />
      </g>
    );
  } else if (sym === WILD) {
    // the green wild lantern — emerald glass, lit core, brass fittings
    body = (
      <g>
        <defs>
          <linearGradient id={`wm${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4ade80" />
            <stop offset="1" stopColor="#14532d" />
          </linearGradient>
          <radialGradient id={`wg${uid}`} cx="0.5" cy="0.55" r="0.6">
            <stop offset="0" stopColor="#ecfdf5" />
            <stop offset="0.55" stopColor="#6ee7b7" />
            <stop offset="1" stopColor="#059669" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="50" rx="19" ry="25" fill="#34d399" opacity="0.2" />
        <rect x="29" y="22" width="42" height="54" rx="10" fill="#101a13" stroke={`url(#wm${uid})`} strokeWidth="4" />
        <ellipse cx="50" cy="50" rx="12" ry="18" fill={`url(#wg${uid})`} />
        <ellipse cx="50" cy="50" rx="6" ry="10" fill="#d1fae5" opacity="0.85" />
        <rect x="25" y="15" width="50" height="9" rx="4.5" fill={`url(#wm${uid})`} />
        <rect x="25" y="15" width="50" height="3.5" rx="1.75" fill="#86efac" opacity="0.6" />
        <path d="M41 13 C41 5 59 5 59 13" stroke="#166534" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <rect x="23" y="76" width="54" height="8" rx="4" fill="#14532d" />
        <rect x="26" y="84" width="48" height="12" rx="6" fill="#052e16" stroke="#34d399" strokeWidth="1.5" />
        <text x="50" y="94" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="11" fill="#6ee7b7" letterSpacing="2">WILD</text>
      </g>
    );
  } else if (sym === GOLDMINE) {
    // the gold nugget — faceted lumps with edge lights, sparkle, value plaque
    body = (
      <g>
        <defs>
          <linearGradient id={`n${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fef3c7" />
            <stop offset="0.5" stopColor="#fcd34d" />
            <stop offset="1" stopColor="#c07f16" />
          </linearGradient>
        </defs>
        <path d="M28 62 L24 46 L38 32 L56 34 L62 50 L52 66 L36 68 Z" fill={`url(#n${uid})`} />
        <path d="M38 32 L56 34 L50 44 L34 46 Z" fill="#fffbe8" opacity="0.6" />
        <path d="M52 66 L62 50 L62 56 L56 68 Z" fill="#8a5a10" opacity="0.6" />
        <path d="M52 50 L50 34 L64 28 L78 38 L74 56 L58 60 Z" fill={`url(#n${uid})`} />
        <path d="M64 28 L78 38 L68 44 L54 40 Z" fill="#fffbe8" opacity="0.65" />
        <path d="M36 68 L52 66 L60 74 L44 80 Z" fill={`url(#n${uid})`} opacity="0.95" />
        <Sparkle x={33} y={38} s={5.5} />
        <Sparkle x={70} y={46} s={4.5} o={0.8} />
        {cash != null && (
          <>
            <rect x="18" y="74" width="64" height="20" rx="10" fill="#3f2a12" stroke="#fcd34d" strokeWidth="2" />
            <rect x="18" y="74" width="64" height="8" rx="5" fill="#fff" opacity="0.12" />
            <text x="50" y="89" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="15" fill="#fde68a">
              {cash.toFixed(cash < 2 ? 2 : 1)}
            </text>
          </>
        )}
      </g>
    );
  } else if (sym === TRAIN) {
    body = <Loco hex={TRAIN_HEX[trainColor ?? 'green']} uid={uid} />;
  } else if (sym === BELL) {
    // golden bell — polished dome, skirt, clapper, long shine
    body = (
      <g>
        <defs>
          <linearGradient id={`be${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fef3c7" />
            <stop offset="0.5" stopColor="#fcd34d" />
            <stop offset="1" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <rect x="44" y="8" width="12" height="11" rx="5" fill="#92400e" />
        <path d="M50 16 C67 16 77 33 77 52 L77 62 L23 62 L23 52 C23 33 33 16 50 16 Z" fill={`url(#be${uid})`} />
        <path d="M31 46 C33 33 41 24 50 22" stroke="#fffbe8" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
        <rect x="17" y="60" width="66" height="10" rx="5" fill="#92400e" />
        <rect x="17" y="60" width="66" height="4" rx="2" fill="#d4922a" />
        <circle cx="50" cy="74" r="8" fill="#fcd34d" />
        <circle cx="50" cy="74" r="8" fill="none" stroke="#92400e" strokeWidth="2" />
        <circle cx="48" cy="72" r="2.5" fill="#fffbe8" opacity="0.8" />
      </g>
    );
  } else if (sym === GTRAIN) {
    body = (
      <g>
        <Loco hex={{ a: '#fde68a', b: '#b45309' }} uid={uid} />
        <Sparkle x={30} y={18} s={6} />
        <Sparkle x={62} y={10} s={5} o={0.8} />
      </g>
    );
  } else {
    // SCATTER — waxed dynamite, taped, sparking fuse, embossed label
    body = (
      <g>
        <defs>
          <linearGradient id={`d${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ef4444" />
            <stop offset="0.5" stopColor="#b91c1c" />
            <stop offset="1" stopColor="#7f1d1d" />
          </linearGradient>
        </defs>
        {[
          { x: 27, r: -8 },
          { x: 43, r: 0 },
          { x: 59, r: 8 },
        ].map((s, i) => (
          <g key={i} transform={`rotate(${s.r} ${s.x + 7} 44)`}>
            <rect x={s.x} y="22" width="14" height="44" rx="5" fill={`url(#d${uid})`} />
            <rect x={s.x + 2} y="24" width="3" height="40" rx="1.5" fill="#fca5a5" opacity="0.5" />
          </g>
        ))}
        <rect x="22" y="38" width="56" height="11" rx="4" fill="#92400e" />
        <rect x="22" y="38" width="56" height="4" rx="2" fill="#b45309" />
        <path d="M50 22 C52 14 58 9 65 7" stroke="#d6d3d1" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <Sparkle x={66} y={6} s={7} o={1} />
        <Sparkle x={61} y={11} s={4} o={0.7} />
        <text x="50" y="92" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="14" fill="#7f1d1d" letterSpacing="1.5" opacity="0.8">SCATTER</text>
        <text x="50" y="91" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="900" fontSize="14" fill="#ef4444" letterSpacing="1.5">SCATTER</text>
      </g>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {body}
    </svg>
  );
}

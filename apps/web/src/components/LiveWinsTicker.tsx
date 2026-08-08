'use client';

import { useEffect, useState } from 'react';
import { CATALOG, ACCENT_HEX } from '@/lib/catalog';
import { fmtMult } from '@/lib/format';
import { Icon, type IconName } from './Icon';

interface Win {
  id: number;
  user: string;
  game: string;
  icon: IconName;
  color: string;
  mult: number;
  amount: number;
}

const NAMES = ['degenape', '0xVela', 'moonboy', 'satoshdivk', 'pixel', 'gm_wagmi', 'solmaxi', 'frenzy', 'zkNova', 'luna'];

/**
 * Social proof ticker. Deterministic pseudo-stream (seeded counter, not
 * Math.random on first paint) so hydration is stable, then it animates live.
 */
export function LiveWinsTicker() {
  const [wins, setWins] = useState<Win[]>(() =>
    Array.from({ length: 12 }, (_, i) => synth(i)),
  );

  useEffect(() => {
    let n = 12;
    const t = setInterval(() => {
      setWins((prev) => [synth(n++), ...prev].slice(0, 16));
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
        <span className="h-2 w-2 animate-pulse-glow rounded-full bg-win" />
        <span className="text-xs font-semibold text-slate-400">Live wins</span>
      </div>
      <div
        className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-label="Live wins"
        tabIndex={0}
      >
        {wins.map((w) => (
          <div
            key={w.id}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-void-900/60 px-3 py-2 animate-float-up"
          >
            <span style={{ color: w.color }}>
              <Icon name={w.icon} size={18} />
            </span>
            <div className="leading-tight">
              <div className="text-xs font-semibold text-slate-300">{w.user}</div>
              <div className="text-[0.65rem] text-slate-500">{w.game}</div>
            </div>
            <div className="ml-1 text-right leading-tight">
              <div className="font-mono text-xs font-bold text-win">{fmtMult(w.mult)}</div>
              <div className="font-mono text-[0.65rem] text-slate-400">◎{w.amount.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Cheap deterministic hash → avoids Math.random (SSR-safe) & gives variety.
function synth(seed: number): Win {
  const h = (seed * 2654435761) >>> 0;
  const game = CATALOG[h % CATALOG.length];
  // Unsigned shifts (>>>) — a signed >> can go negative for h ≥ 2^31.
  const mult = 1.2 + ((h >>> 3) % 900) / 100;
  const amount = 0.05 + ((h >>> 7) % 500) / 100;
  return {
    id: seed,
    user: NAMES[(h >>> 5) % NAMES.length],
    game: game.name,
    icon: game.icon,
    color: ACCENT_HEX[game.accent],
    mult: Math.round(mult * 100) / 100,
    amount,
  };
}

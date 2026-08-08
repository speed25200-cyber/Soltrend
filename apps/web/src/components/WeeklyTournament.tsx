'use client';

import { useEffect, useState } from 'react';
import { useCasino } from '@/lib/store';
import { Icon } from './Icon';
import { fmtSol, fmtCompact } from '@/lib/format';

const NAMES = ['DegenKing', '0xVela', 'moonboy', 'satosh', 'GemHunter', 'solmaxi', 'frenzy', 'zkNova', 'CryptoWizard'];
const PRIZE_POOL = 250;
const PRIZES = [0.4, 0.25, 0.15, 0.1, 0.05]; // share of pool for ranks 1..5

// Deterministic rival wagered volumes (no Math.random on first paint → SSR-safe).
const RIVALS = NAMES.map((name, i) => {
  const h = ((i + 3) * 2654435761) >>> 0;
  return { name, wagered: 40 + (h % 900) };
}).sort((a, b) => b.wagered - a.wagered);

function msToWeekEnd(now: number): number {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // days since Monday
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 7, 0, 0, 0);
  return end - now;
}

export function WeeklyTournament() {
  const wagered = useCasino((s) => s.progress.wageredTotal);
  const [left, setLeft] = useState<string>('—');

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, msToWeekEnd(Date.now()));
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setLeft(`${d}d ${h}h ${m}m`);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  const board = [...RIVALS, { name: 'You', wagered, you: true } as any].sort((a, b) => b.wagered - a.wagered);
  const myRank = board.findIndex((b) => (b as any).you) + 1;
  const top = board.slice(0, 5);

  return (
    <section className="glass relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-neon-violet/20 blur-3xl" />
      <div className="relative z-10 flex flex-wrap items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-neon-violet to-neon-magenta text-void-950">
          <Icon name="crown" size={24} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold text-white">Weekly tournament</h3>
            <span className="chip !border-neon-violet/40 !text-neon-violet">Live</span>
          </div>
          <p className="text-xs text-slate-500">Wager the most this week to win. Resets in {left}.</p>
        </div>
        <div className="text-right">
          <div className="label-eyebrow">Prize pool</div>
          <div className="font-display text-2xl font-bold text-gold">◎{PRIZE_POOL}</div>
        </div>
      </div>

      <div className="relative z-10 mt-4 divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
        {top.map((b: any, i) => {
          const prize = PRIZES[i] ? PRIZE_POOL * PRIZES[i] : 0;
          return (
            <div key={b.name} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${b.you ? 'bg-neon-violet/[0.08]' : ''}`}>
              <span className={`w-6 font-display font-bold ${i < 3 ? 'text-gold' : 'text-slate-500'}`}>{i + 1}</span>
              <span className={`flex-1 font-semibold ${b.you ? 'text-neon-violet' : 'text-white'}`}>{b.name}</span>
              <span className="font-mono text-xs text-slate-400">◎{fmtCompact(b.wagered)} wagered</span>
              {prize > 0 && <span className="w-16 text-right font-mono text-xs font-bold text-gold">◎{fmtSol(prize, 1)}</span>}
            </div>
          );
        })}
        {myRank > 5 && (
          <div className="flex items-center gap-3 bg-neon-violet/[0.08] px-4 py-2.5 text-sm">
            <span className="w-6 font-display font-bold text-slate-500">{myRank}</span>
            <span className="flex-1 font-semibold text-neon-violet">You</span>
            <span className="font-mono text-xs text-slate-400">◎{fmtSol(wagered, 2)} wagered</span>
          </div>
        )}
      </div>
      <p className="relative z-10 mt-3 text-[0.68rem] text-slate-600">
        Illustrative pool funded by the community treasury. Top 5 share the prize each week.
      </p>
    </section>
  );
}

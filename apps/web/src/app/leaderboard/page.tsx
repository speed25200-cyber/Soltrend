'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useCasino } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { fmtCompact } from '@/lib/format';
import { ACCENT_HEX } from '@/lib/catalog';

export default function LeaderboardPage() {
  const ugc = useCasino((s) => s.ugc);
  const [tab, setTab] = useState<'games' | 'creators'>('games');

  const games = [...ugc].sort((a, b) => b.volume - a.volume);
  const creators = useMemo(() => {
    const map = new Map<string, { name: string; volume: number; games: number; players: number }>();
    for (const g of ugc) {
      const e = map.get(g.creator) ?? { name: g.creator, volume: 0, games: 0, players: 0 };
      e.volume += g.volume;
      e.games += 1;
      e.players += g.players;
      map.set(g.creator, e);
    }
    // Creator royalty ≈ 30% of the house edge on their games' volume (illustrative).
    return [...map.values()]
      .map((c) => ({ ...c, royalties: c.volume * 0.02 * 0.3 }))
      .sort((a, b) => b.volume - a.volume);
  }, [ugc]);

  return (
    <div className="space-y-6">
      <SectionHead eyebrow="Play · Ranks" title="Leaderboards" sub="Ranked by real wagered volume — players and the creators they play" />

      <div className="flex gap-1 rounded-xl bg-void-900/80 p-1 max-w-xs">
        {(['games', 'creators'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
              tab === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'games' ? (
        <div className="glass divide-y divide-white/[0.05] overflow-hidden">
          {games.map((g, i) => {
            const hex = ACCENT_HEX[(g.theme.accent as keyof typeof ACCENT_HEX) ?? 'violet'];
            return (
              <Link key={g.id} href={`/play/ugc?id=${g.id}`} className="flex items-center gap-4 p-4 transition hover:bg-white/[0.02]">
                <Rank i={i} />
                <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ color: hex, background: `${hex}22` }}>
                  <Icon name={g.theme.icon} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-bold text-white">{g.name}</div>
                  <div className="text-xs text-slate-500">by {g.creator} · {g.template}</div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="text-xs text-slate-500">Players</div>
                  <div className="font-mono text-sm text-slate-300">{fmtCompact(g.players)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Volume</div>
                  <div className="font-mono text-sm font-bold text-white">◎{fmtCompact(g.volume)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="glass divide-y divide-white/[0.05] overflow-hidden">
          {creators.map((c, i) => (
            <div key={c.name} className="flex items-center gap-4 p-4">
              <Rank i={i} />
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-neon-violet to-neon-magenta font-display font-bold text-void-950">
                {c.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display font-bold text-white">{c.name}</div>
                <div className="text-xs text-slate-500">{c.games} game{c.games > 1 ? 's' : ''}</div>
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-xs text-slate-500">Volume</div>
                <div className="font-mono text-sm text-slate-300">◎{fmtCompact(c.volume)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Royalties</div>
                <div className="font-mono text-sm font-bold text-gold">◎{c.royalties.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MEDALS = [
  'linear-gradient(135deg,#fde68a,#f59e0b)',
  'linear-gradient(135deg,#e2e8f0,#94a3b8)',
  'linear-gradient(135deg,#fbbf9c,#c2703f)',
];
function Rank({ i }: { i: number }) {
  if (i < 3) {
    return (
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-display text-xs font-bold text-void-950"
        style={{ background: MEDALS[i], boxShadow: `0 4px 14px -4px rgba(0,0,0,0.6)` }}
      >
        {i + 1}
      </span>
    );
  }
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center font-display text-sm font-bold text-slate-500">
      {i + 1}
    </span>
  );
}

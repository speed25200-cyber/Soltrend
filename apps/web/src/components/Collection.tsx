'use client';

import Link from 'next/link';
import { useCasino } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { ACCENT_HEX } from '@/lib/catalog';
import { tierFor, nextTier, TIERS } from '@/lib/journeys';

/**
 * The player's game collection — a cosmetic showcase of the games they've played
 * and the decorative tier reached on each. No wagering incentive beyond the play
 * that already happened; purely a "look what I've explored" wall.
 */
export function Collection() {
  const ugc = useCasino((s) => s.ugc);
  const journeys = useCasino((s) => s.journeys);

  const played = Object.entries(journeys)
    .map(([id, plays]) => ({ game: ugc.find((g) => g.id === id), plays }))
    .filter((x): x is { game: NonNullable<typeof x.game>; plays: number } => !!x.game)
    .sort((a, b) => b.plays - a.plays);

  if (played.length === 0) {
    return (
      <div className="glass grid place-items-center gap-2 p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-neon-violet/15 text-neon-violet"><Icon name="star" size={24} /></span>
        <p className="text-sm text-slate-400">Your collection is empty. Play community games to earn emblems.</p>
        <Link href="/discover" className="btn-ghost mt-1">Discover games</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-white">Your collection</h3>
        <span className="text-xs text-slate-500">{played.length} game{played.length === 1 ? '' : 's'} explored</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {played.map(({ game, plays }) => {
          const tier = tierFor(plays);
          const { next, progress } = nextTier(plays);
          const hex = ACCENT_HEX[(game.theme.accent as keyof typeof ACCENT_HEX)] ?? ACCENT_HEX.violet;
          return (
            <Link key={game.id} href={`/play/ugc?id=${game.id}`} className="glass glass-hover flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${hex}1a`, color: hex }}>
                  <Icon name={game.theme.icon} size={18} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{game.name}</div>
                  {tier && <div className="text-[0.62rem] font-bold" style={{ color: tier.color }}>{tier.label}</div>}
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-void-900">
                <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: tier?.color ?? '#94a3b8' }} />
              </div>
              <div className="flex items-center justify-between text-[0.6rem] text-slate-500">
                <span>{plays} rounds</span>
                <span>{next ? `${next.at - plays} to ${next.label}` : 'Maxed'}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Compact journey chip for a single game (used on the play screen). */
export function JourneyChip({ gameId }: { gameId: string }) {
  const plays = useCasino((s) => s.journeys[gameId] ?? 0);
  if (plays === 0) return null;
  const tier = tierFor(plays);
  const { next } = nextTier(plays);
  return (
    <span className="chip" title={next ? `${next.at - plays} rounds to ${next.label}` : 'Top tier'}>
      {tier && <b style={{ color: tier.color }}>{tier.label}</b>} · {plays} rounds
    </span>
  );
}

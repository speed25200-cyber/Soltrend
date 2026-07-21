'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCasino } from '@/lib/store';
import { GameScreen } from '@/components/games/GameScreen';
import { GameStakePanel } from '@/components/GameStakePanel';
import { JourneyChip } from '@/components/Collection';
import { maxBetFor } from '@/lib/economics';
import type { GameMeta } from '@/lib/catalog';

export default function UgcPlayPage() {
  return (
    <Suspense fallback={<div className="glass p-16 text-center text-slate-500">Loading…</div>}>
      <UgcInner />
    </Suspense>
  );
}

function UgcInner() {
  const id = useSearchParams().get('id') ?? '';
  const ugc = useCasino((s) => s.ugc);
  const game = ugc.find((g) => g.id === id);
  const parent = game?.parentId ? ugc.find((g) => g.id === game.parentId) : undefined;
  const remixCount = game ? ugc.filter((g) => g.parentId === game.id).length : 0;

  if (!game) {
    return (
      <div className="glass grid place-items-center p-16 text-center">
        <p className="text-slate-400">This community game could not be found.</p>
        <Link href="/discover" className="btn-ghost mt-4">
          Back to Discover
        </Link>
      </div>
    );
  }

  const meta: GameMeta = {
    slug: game.id,
    name: game.name,
    icon: game.theme.icon,
    tagline: `Community game by ${game.creator}`,
    template: game.template,
    tier: 2,
    accent: (game.theme.accent as GameMeta['accent']) ?? 'violet',
    aura: game.theme.aura,
    presentation: game.theme.presentation as GameMeta['presentation'],
    background: game.theme.background as GameMeta['background'],
    soundPack: game.theme.soundPack as GameMeta['soundPack'],
    winEffect: game.theme.winEffect as GameMeta['winEffect'],
    seedKey: game.specHash || game.id,
    symbols: game.theme.symbols,
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link href={`/creator?name=${encodeURIComponent(game.creator)}`} className="chip hover:border-neon-violet/50">
            by <b className="text-slate-200">{game.creator}</b>
          </Link>
          {parent && (
            <Link href={`/play/ugc?id=${parent.id}`} className="chip hover:border-neon-violet/50">
              Remixed from <b className="text-slate-200">{parent.name}</b>
            </Link>
          )}
          {remixCount > 0 && <span className="chip">{remixCount} remix{remixCount === 1 ? '' : 'es'} · original earns royalties</span>}
          <JourneyChip gameId={game.id} />
        </div>
        <GameScreen
          config={{ meta, edge: game.edge, gameId: game.id, gameName: game.name, params: game.params, maxBet: maxBetFor(game.tvl ?? 0, game.maxWin ?? 100) }}
        />
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <GameStakePanel gameId={game.id} />
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCasino } from '@/lib/store';
import { GameScreen } from '@/components/games/GameScreen';
import type { GameMeta } from '@/lib/catalog';

export default function UgcPlayPage() {
  const { id } = useParams<{ id: string }>();
  const game = useCasino((s) => s.ugc.find((g) => g.id === id));

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
    emoji: game.theme.emoji,
    tagline: `Community game by ${game.creator}`,
    template: game.template,
    tier: 2,
    accent: (game.theme.accent as GameMeta['accent']) ?? 'violet',
  };

  return (
    <GameScreen
      config={{ meta, edge: game.edge, gameId: game.id, gameName: game.name, params: game.params }}
    />
  );
}

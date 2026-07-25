'use client';

import Link from 'next/link';
import { useCasino } from '@/lib/store';
import { worldFromParams } from '@/lib/forge/world';
import { BOARD_SKINS } from '@/lib/forge/board';
import { fmtCompact } from '@/lib/format';
import { SectionHead } from './SectionHead';
import { Icon } from './Icon';

/**
 * The 3D shelf — community worlds surfaced on their own, since a flat card grid
 * badly undersells them. Each card previews the world's skin palette and says
 * which spatial mechanic it plays as, so the two feel like distinct genres.
 */
export function WorldsRow() {
  const ugc = useCasino((s) => s.ugc);
  const worlds = ugc
    .filter((g) => g.template === 'board')
    .map((g) => ({ game: g, spec: worldFromParams(g.params) }))
    .sort((a, b) => b.game.volume - a.game.volume)
    .slice(0, 6);

  if (worlds.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between">
        <SectionHead eyebrow="3D" title="Worlds" sub="Spatial games you play inside — built by creators" />
        <Link href="/studio?mode=world" className="mb-4 text-sm font-semibold text-neon-cyan hover:text-neon-violet">
          Build one →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {worlds.map(({ game, spec }) => {
          const skin = BOARD_SKINS[spec.board.skin];
          const ascent = spec.mode === 'ascent';
          return (
            <Link
              key={game.id}
              href={`/play/ugc?id=${game.id}`}
              className="glass glass-hover group relative overflow-hidden p-4"
            >
              {/* depth cue — a soft horizon that reads as "space" */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-50 transition group-hover:opacity-80"
                style={{ background: `radial-gradient(120% 90% at 50% 120%, ${skin.gem}55, transparent 70%)` }}
              />
              <div className="relative z-10">
                <span className="chip !border-white/10 !text-[0.6rem]" style={{ color: skin.gemGlow }}>
                  {ascent ? 'Ascent' : 'Board'}
                </span>
                <div className="mt-3" style={{ color: skin.gem, filter: `drop-shadow(0 6px 18px ${skin.gem}88)` }}>
                  <Icon name={skin.icon} size={34} strokeWidth={1.5} />
                </div>
                <h3 className="mt-2 truncate font-display font-bold text-white">{game.name}</h3>
                <p className="truncate text-xs text-slate-500">by {game.creator}</p>
                <div className="mt-2 flex items-center justify-between text-[0.66rem] text-slate-500">
                  <span>{ascent ? `${spec.board.rows} floors` : `${spec.board.rows}×${spec.board.cols}`}</span>
                  <span className="font-mono">◎{fmtCompact(game.volume)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

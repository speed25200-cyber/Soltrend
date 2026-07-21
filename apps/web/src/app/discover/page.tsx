'use client';

import Link from 'next/link';
import { useCasino } from '@/lib/store';
import { UgcCard } from '@/components/UgcRow';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { ACCENT_HEX } from '@/lib/catalog';
import { fmtCompact } from '@/lib/format';

export default function DiscoverPage() {
  const ugc = useCasino((s) => s.ugc);
  const trending = [...ugc].sort((a, b) => b.volume - a.volume);
  const fresh = [...ugc].sort((a, b) => b.createdAt - a.createdAt);
  const gotw = trending.find((g) => g.featured) ?? trending[0];

  // Top creators by total wagered across their catalog.
  const byCreator = new Map<string, { volume: number; games: number }>();
  for (const g of ugc) {
    const c = byCreator.get(g.creator) ?? { volume: 0, games: 0 };
    c.volume += g.volume;
    c.games += 1;
    byCreator.set(g.creator, c);
  }
  const creators = [...byCreator.entries()].sort((a, b) => b[1].volume - a[1].volume).slice(0, 8);
  const hex = gotw ? ACCENT_HEX[(gotw.theme.accent as keyof typeof ACCENT_HEX) ?? 'violet'] : '#a855f7';

  return (
    <div className="space-y-10">
      <SectionHead eyebrow="Discover" title="Made by the community" sub="Trending games, fresh drops and the creators behind them" />

      {gotw && (
        <Link
          href={`/play/ugc?id=${gotw.id}`}
          className="glass glass-hover relative block overflow-hidden p-8 md:p-10"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl" style={{ background: `${hex}44` }} />
          <div className="relative z-10 flex flex-col items-start gap-4 md:flex-row md:items-center">
            <span className="grid h-20 w-20 place-items-center rounded-2xl" style={{ color: hex, background: `${hex}22`, boxShadow: `0 0 40px -10px ${hex}` }}>
              <Icon name={gotw.theme.icon} size={44} strokeWidth={1.4} />
            </span>
            <div className="flex-1">
              <span className="chip !border-gold/40 !bg-gold/10 !text-gold"><Icon name="star" size={11} /> Game of the Week</span>
              <h2 className="mt-2 font-display text-3xl font-bold text-white">{gotw.name}</h2>
              <p className="text-slate-400">by {gotw.creator} · {fmtCompact(gotw.players)} players · ◎{fmtCompact(gotw.volume)} wagered</p>
            </div>
            <span className="btn-primary">Play now →</span>
          </div>
        </Link>
      )}

      <section>
        <SectionHead eyebrow="Hot" title="Trending now" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {trending.map((g) => (
            <UgcCard key={g.id} game={g} />
          ))}
        </div>
      </section>

      <section>
        <SectionHead eyebrow="New" title="Fresh drops" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {fresh.map((g) => (
            <UgcCard key={g.id} game={g} />
          ))}
        </div>
      </section>

      {creators.length > 0 && (
        <section>
          <SectionHead eyebrow="Creators" title="Top creators" sub="The builders behind the community's games" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {creators.map(([name, c]) => (
              <Link key={name} href={`/creator?name=${encodeURIComponent(name)}`} className="glass glass-hover flex items-center gap-3 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-neon-violet/15 font-display text-sm font-bold text-neon-violet">
                  {name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{name}</div>
                  <div className="text-xs text-slate-500">{c.games} game{c.games === 1 ? '' : 's'} · ◎{fmtCompact(c.volume)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-display text-xl font-bold text-white">Got an idea for a game?</p>
          <p className="max-w-md text-sm text-slate-400">
            Publish it in minutes and start earning royalties the moment people play.
          </p>
          <Link href="/studio" className="btn-primary">Open the Studio</Link>
        </div>
        <div className="glass relative flex flex-col items-center gap-3 overflow-hidden p-8 text-center">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-win/15 blur-3xl" />
          <p className="font-display text-xl font-bold text-white">Don’t just play — <span className="text-win">be the house</span></p>
          <p className="max-w-md text-sm text-slate-400">
            Stake SOL into a game’s bankroll and earn a share of its edge on every bet.
          </p>
          <Link href="/vault" className="btn-primary btn-win">Open the Vaults</Link>
        </div>
      </div>
    </div>
  );
}

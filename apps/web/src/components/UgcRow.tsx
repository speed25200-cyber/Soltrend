'use client';

import Link from 'next/link';
import { useCasino, type UgcGame } from '@/lib/store';
import { fmtCompact } from '@/lib/format';
import { ACCENT_HEX } from '@/lib/catalog';
import { SectionHead } from './SectionHead';
import { Icon } from './Icon';

export function UgcRow() {
  const ugc = useCasino((s) => s.ugc);
  const trending = [...ugc].sort((a, b) => b.volume - a.volume).slice(0, 6);

  return (
    <section>
      <div className="flex items-end justify-between">
        <SectionHead eyebrow="Community" title="Trending games" sub="Made by creators, curated by volume" />
        <Link href="/discover" className="mb-4 text-sm font-semibold text-neon-violet hover:text-neon-magenta">
          View all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {trending.map((g) => (
          <UgcCard key={g.id} game={g} />
        ))}
      </div>
    </section>
  );
}

export function UgcCard({ game }: { game: UgcGame }) {
  const hex = ACCENT_HEX[(game.theme.accent as keyof typeof ACCENT_HEX)] ?? ACCENT_HEX.violet;
  return (
    <Link
      href={`/play/ugc?id=${game.id}`}
      className="glass glass-hover group relative w-52 shrink-0 overflow-hidden p-4"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
        style={{ background: hex }}
      />
      {game.featured && (
        <span className="absolute right-2.5 top-2.5 chip !border-gold/40 !bg-gold/10 !text-gold">
          <Icon name="star" size={11} /> Featured
        </span>
      )}
      <span style={{ color: hex, filter: `drop-shadow(0 6px 18px ${hex}88)` }}>
        <Icon name={game.theme.icon} size={38} strokeWidth={1.5} />
      </span>
      <h3 className="mt-3 font-display font-bold text-white">{game.name}</h3>
      <p className="text-xs text-slate-500">by {game.creator}</p>
      <div className="mt-3 flex items-center justify-between text-[0.68rem]">
        <span className="chip !capitalize">{game.template}</span>
        <span className="font-mono text-slate-400">◎{fmtCompact(game.volume)}</span>
      </div>
    </Link>
  );
}

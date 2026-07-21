'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCasino } from '@/lib/store';
import { UgcCard } from '@/components/UgcRow';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { fmtCompact } from '@/lib/format';

export default function CreatorPage() {
  return (
    <Suspense fallback={<div className="glass p-16 text-center text-slate-500">Loading…</div>}>
      <CreatorInner />
    </Suspense>
  );
}

function CreatorInner() {
  const name = useSearchParams().get('name') ?? '';
  const ugc = useCasino((s) => s.ugc);
  const games = ugc.filter((g) => g.creator === name);

  if (!name || games.length === 0) {
    return (
      <div className="glass grid place-items-center p-16 text-center">
        <p className="text-slate-400">No games found for this creator.</p>
        <Link href="/discover" className="btn-ghost mt-4">Back to Discover</Link>
      </div>
    );
  }

  const volume = games.reduce((s, g) => s + g.volume, 0);
  const players = games.reduce((s, g) => s + g.players, 0);
  const plays = games.reduce((s, g) => s + g.plays, 0);
  const rated = games.filter((g) => g.rating > 0);
  const avgRating = rated.length ? rated.reduce((s, g) => s + g.rating, 0) / rated.length : 0;
  // How many times other creators have remixed this creator's games (royalty reach).
  const remixReach = ugc.filter((g) => g.parentId && games.some((mine) => mine.id === g.parentId)).length;
  const top = [...games].sort((a, b) => b.volume - a.volume);

  return (
    <div className="space-y-8">
      <div className="glass relative overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-neon-violet/20 blur-3xl" />
        <div className="relative z-10 flex flex-col items-start gap-4 md:flex-row md:items-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-neon-violet/15 font-display text-2xl font-bold text-neon-violet">
            {name.slice(0, 2).toUpperCase()}
          </span>
          <div className="flex-1">
            <span className="label-eyebrow">Creator</span>
            <h1 className="font-display text-3xl font-bold text-white">{name}</h1>
            <p className="text-slate-400">{games.length} game{games.length === 1 ? '' : 's'} · ◎{fmtCompact(volume)} wagered</p>
          </div>
          <Link href="/studio" className="btn-ghost"><Icon name="pencil" size={14} /> Open Studio</Link>
        </div>
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total wagered" value={`◎${fmtCompact(volume)}`} />
          <Stat label="Players" value={fmtCompact(players)} />
          <Stat label="Rounds" value={fmtCompact(plays)} />
          <Stat label="Avg rating" value={avgRating ? avgRating.toFixed(1) : '—'} />
        </div>
        {remixReach > 0 && (
          <p className="relative z-10 mt-3 text-xs text-slate-500">
            <Icon name="spark" size={11} /> {remixReach} remix{remixReach === 1 ? '' : 'es'} built on this creator&apos;s games — each pays them a royalty share.
          </p>
        )}
      </div>

      <section>
        <SectionHead eyebrow="Catalog" title="Games by this creator" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {top.map((g) => (
            <UgcCard key={g.id} game={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className="font-mono text-lg font-bold text-white">{value}</div>
    </div>
  );
}

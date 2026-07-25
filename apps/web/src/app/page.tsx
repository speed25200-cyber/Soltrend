'use client';

import Link from 'next/link';
import { CATALOG } from '@/lib/catalog';
import { GameCard } from '@/components/GameCard';
import { Hero } from '@/components/Hero';
import { LiveWinsTicker } from '@/components/LiveWinsTicker';
import { UgcRow } from '@/components/UgcRow';
import { WorldsRow } from '@/components/WorldsRow';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';

export default function LobbyPage() {
  return (
    <div className="space-y-10">
      <Hero />
      <LiveWinsTicker />

      <section>
        <SectionHead
          eyebrow="Originals"
          title="House games"
          sub="Instant, provably fair, built for micro-betting"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {CATALOG.map((g, i) => (
            <GameCard key={g.slug} meta={g} index={i} />
          ))}
        </div>
      </section>

      <UgcRow />
      <WorldsRow />

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/duel" className="glass glass-hover flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon-violet/15 text-neon-violet"><Icon name="target" size={20} /></span>
          <div><div className="font-display text-sm font-bold text-white">Play PvP</div><div className="text-xs text-slate-500">Duel 1v1 or join the shared jackpot</div></div>
        </Link>
        <Link href="/live" className="glass glass-hover flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon-pink/15 text-neon-pink"><Icon name="trend" size={20} /></span>
          <div><div className="font-display text-sm font-bold text-white">Live Crash</div><div className="text-xs text-slate-500">3D rocket, solo or shared rooms</div></div>
        </Link>
        <Link href="/market" className="glass glass-hover flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold"><Icon name="star" size={20} /></span>
          <div><div className="font-display text-sm font-bold text-white">Asset market</div><div className="text-xs text-slate-500">Symbol packs + node modules</div></div>
        </Link>
      </section>

      <section className="glass overflow-hidden p-8 md:p-10">
        <div className="relative z-10 max-w-2xl">
          <span className="chip !border-neon-magenta/40 !text-neon-magenta">Creator economy</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
            Build a casino game. <span className="neon-text">Earn on every bet.</span>
          </h2>
          <p className="mt-3 text-slate-400">
            Assemble a game from audited primitives — no smart contract, no code. Publish it, climb the
            trending feed, and collect a design royalty on the house edge it generates.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/studio" className="btn-primary">
              Open the Studio
            </Link>
            <Link href="/leaderboard" className="btn-ghost">
              See top creators
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-neon-magenta/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-64 w-64 rounded-full bg-neon-violet/20 blur-3xl" />
      </section>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { CATALOG } from '@/lib/catalog';
import { GameCard } from '@/components/GameCard';
import { Hero } from '@/components/Hero';
import { DailyBanner } from '@/components/DailyBanner';
import { LiveWinsTicker } from '@/components/LiveWinsTicker';
import { UgcRow } from '@/components/UgcRow';
import { WorldsRow } from '@/components/WorldsRow';
import { SectionHead } from '@/components/SectionHead';

export default function LobbyPage() {
  return (
    <div className="space-y-10">
      <Hero />
      <DailyBanner />
      <LiveWinsTicker />

      <section>
        <SectionHead
          eyebrow="Originals"
          title="House games"
          sub="Instant, provably fair, built for micro-betting"
        />
        {/* Nine games on a five-column grid leaves one empty slot — the flagship
            slot takes a double-width card instead, which fills the row exactly
            and gives the newest game the visual weight it deserves. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {CATALOG.map((g, i) => (
            <GameCard key={g.slug} meta={g} index={i} wide={g.slug === 'goldmine'} />
          ))}
        </div>
      </section>

      <UgcRow />
      <WorldsRow />

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

'use client';

import Link from 'next/link';
import { useCasino } from '@/lib/store';
import { fmtSol } from '@/lib/format';

export function JackpotPill() {
  const jackpot = useCasino((s) => s.jackpot);
  return (
    <Link
      href="/rewards"
      className="hidden items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/[0.08] px-2.5 py-1.5 lg:flex"
      title="Community jackpot — grows with every bet"
    >
      <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-gold" />
      <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-gold/80">Jackpot</span>
      <span className="font-mono text-xs font-bold text-gold">◎{fmtSol(jackpot, 2)}</span>
    </Link>
  );
}

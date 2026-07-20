'use client';

import Link from 'next/link';
import { useCasino } from '@/lib/store';
import { levelFromXp } from '@/lib/progression';

export function LevelChip() {
  const xp = useCasino((s) => s.progress.xp);
  const info = levelFromXp(xp);
  return (
    <Link
      href="/rewards"
      className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-void-900/70 px-2.5 py-1.5 transition hover:border-neon-violet/40 sm:flex"
      title={`Level ${info.level} · ${Math.round(info.pct * 100)}% to next`}
    >
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-neon-violet to-neon-magenta text-[0.7rem] font-bold text-void-950">
        {info.level}
      </span>
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-void-700">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-all"
          style={{ width: `${Math.max(6, info.pct * 100)}%` }}
        />
      </span>
    </Link>
  );
}

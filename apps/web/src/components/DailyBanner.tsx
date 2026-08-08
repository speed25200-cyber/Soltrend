'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useCasino } from '@/lib/store';
import { dayKey, dayNumber, msUntilNextDay } from '@/lib/daily';

/**
 * The hook. A free daily run with a streak on the line is the cheapest reason to
 * come back, and the only thing on the site that produces something worth
 * pasting to a friend — so it gets the top of the lobby.
 */
export function DailyBanner() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const runs = useCasino((s) => s.dailyRuns);
  const streak = useCasino((s) => s.dailyStreak);

  if (now === null) return null;
  const key = dayKey(now);
  const done = runs[key];
  const left = msUntilNextDay(now);
  const hours = Math.floor(left / 3_600_000);
  const mins = Math.floor((left % 3_600_000) / 60_000);

  return (
    <Link
      href="/daily"
      className="glass glass-hover relative flex items-center gap-4 overflow-hidden p-5"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
        <Icon name="orbit" size={24} />
      </span>
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display font-bold text-white">Daily Nexus #{dayNumber(now)}</span>
          <span className="chip !border-gold/40 !bg-gold/10 !text-gold">free</span>
          {streak > 0 && <span className="chip">{streak} day streak</span>}
        </div>
        <p className="truncate text-sm text-slate-400">
          {done
            ? done.banked
              ? `You banked ${done.multiplier.toFixed(2)}x today — new map in ${hours}h ${mins}m`
              : `You fell at room ${done.rooms + 1} today — new map in ${hours}h ${mins}m`
            : 'One map, everyone on earth, one free run. How deep do you dare go?'}
        </p>
      </div>
      <span className="relative z-10 hidden shrink-0 sm:block">
        <span className="btn-primary">{done ? 'See your card' : 'Play today'}</span>
      </span>
    </Link>
  );
}

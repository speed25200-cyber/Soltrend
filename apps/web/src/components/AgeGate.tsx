'use client';

import { useEffect, useState } from 'react';
import { useCasino } from '@/lib/store';

/**
 * 18+ verification gate (§ compliance / responsible gaming). Blocking, shown
 * before any play. Hydration-safe: renders nothing until mounted so the
 * persisted flag is read client-side.
 */
export function AgeGate() {
  const [mounted, setMounted] = useState(false);
  const ageVerified = useCasino((s) => s.ageVerified);
  const setAgeVerified = useCasino((s) => s.setAgeVerified);
  useEffect(() => setMounted(true), []);
  if (!mounted || ageVerified) return null;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-void-950/95 p-6 backdrop-blur-md">
      <div className="glass w-full max-w-md p-8 text-center animate-float-up">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-neon-violet to-neon-magenta shadow-glow-violet">
          <span className="font-display text-2xl font-bold text-void-950">18+</span>
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold text-white">Welcome to Soltrend</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          You must be of legal age (18+) to enter. Gambling involves risk — never wager more than you
          can afford to lose. Access is restricted in prohibited jurisdictions.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button className="btn-primary w-full" onClick={() => setAgeVerified(true)}>
            I am 18 or older — Enter
          </button>
          <a
            className="btn-ghost w-full"
            href="https://www.begambleaware.org"
            target="_blank"
            rel="noreferrer"
          >
            I am under 18 — Exit
          </a>
        </div>
        <p className="mt-4 text-[0.68rem] text-slate-600">
          Provably fair · Licensed operator model · Self-exclusion tools available in Profile
        </p>
      </div>
    </div>
  );
}

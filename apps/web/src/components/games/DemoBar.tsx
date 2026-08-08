'use client';

import { motion } from 'framer-motion';
import { Icon } from '@/components/Icon';
import { useDemo, demoRtp, DEMO_CREDITS } from '@/lib/demo';
import { sfx } from '@/lib/sound';

/**
 * The test-drive strip that sits above a live preview or a demo session.
 *
 * A creator's first question about their own game is never "what is the
 * theoretical RTP" — the builder already tells them that. It is "does it feel
 * right", and the only way to answer that is to play it. So this shows what a
 * real session actually did: credits left, how many rounds, the observed return
 * against the theoretical one, and the best multiplier that landed.
 */
export function DemoBar({ theoreticalRtp, compact }: { theoreticalRtp?: number; compact?: boolean }) {
  const s = useDemo();
  const rtp = demoRtp(s);
  const low = s.balance < DEMO_CREDITS * 0.2;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neon-cyan/25 bg-neon-cyan/[0.06] px-3 py-2">
      <span className="flex items-center gap-1.5 rounded-md bg-neon-cyan/20 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-neon-cyan">
        <Icon name="spark" size={11} /> Demo
      </span>

      <motion.span key={s.balance} initial={{ scale: 1.12 }} animate={{ scale: 1 }} className="font-mono text-sm font-bold text-white">
        ◎ {s.balance.toFixed(3)}
        <span className="ml-1 text-[0.6rem] font-normal text-slate-500">credits</span>
      </motion.span>

      <Stat label="Rounds" value={String(s.spins)} />
      <Stat label="Hit rate" value={s.spins ? `${((s.wins / s.spins) * 100).toFixed(0)}%` : '—'} />
      <Stat
        label="Return"
        value={rtp === null ? '—' : `${(rtp * 100).toFixed(0)}%`}
        hint={theoreticalRtp ? `target ${(theoreticalRtp * 100).toFixed(0)}%` : undefined}
      />
      <Stat label="Best" value={s.best ? `${s.best.toFixed(2)}x` : '—'} />

      <button
        onClick={() => { s.reset(); sfx.click(); }}
        className={`ml-auto btn-ghost !py-1 text-xs ${low ? 'ring-1 ring-gold/50 text-gold' : ''}`}
      >
        Reset credits
      </button>
      {!compact && (
        <p className="w-full text-[0.6rem] leading-snug text-slate-500">
          Pretend credits, real maths — same seed chain and paytable as the live game. Nothing here touches
          your wallet, your history or the jackpot.{' '}
          {s.spins > 0 && s.spins < 200 ? 'A few hundred rounds are needed before the observed return means much.' : ''}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <span className="leading-tight">
      <span className="block text-[0.55rem] uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <span className="block font-mono text-xs font-semibold text-slate-200">
        {value}
        {hint && <span className="ml-1 font-sans text-[0.55rem] font-normal text-slate-600">{hint}</span>}
      </span>
    </span>
  );
}

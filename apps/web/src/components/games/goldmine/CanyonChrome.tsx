'use client';

import { motion } from 'framer-motion';
import { JACKPOTS } from '@/lib/slots/gold-express';
import { TRAIN_HEX } from './CanyonSymbols';
import { SolMark } from '@/components/BalanceWidget';
import { fmtSol, SOL_USD } from '@/lib/format';

/**
 * The DOM chrome around the 3D machine — the glossy jackpot ladder and the
 * Balance/Bet/WIN bar with the big round spin. The set itself (sky, canyon,
 * viaduct, cabinet) lives in the WebGL stage next door in Goldmine3D.
 */

/* --------------------------------------------------------- jackpot ladder */

export function JackpotLadder({ payScale }: { payScale: number }) {
  return (
    <div className="flex flex-wrap gap-1.5 sm:flex-col sm:gap-2">
      {JACKPOTS.map((j) => (
        <div
          key={j.tier}
          className="relative flex items-center gap-1.5 overflow-hidden rounded-lg border-2 px-1.5 py-0.5"
          style={{
            borderColor: TRAIN_HEX[j.color].a,
            background: `linear-gradient(120deg, ${TRAIN_HEX[j.color].b}, ${TRAIN_HEX[j.color].a} 140%)`,
            boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.45), 0 4px 10px rgba(0,0,0,0.45)',
          }}
        >
          {/* gloss */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-md bg-white/15" />
          <span className="relative font-display text-[0.52rem] font-black uppercase tracking-wider text-white/95" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.65)' }}>
            {j.tier}
          </span>
          <span className="relative font-mono text-[0.72rem] font-black text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.65), 0 0 10px rgba(255,255,255,0.3)' }}>
            {(j.value * payScale).toFixed(0)}×
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- bottom bar */

export function BottomBar({
  balance,
  bet,
  win,
  spinLocked,
  canSpin,
  onBet,
  onSpin,
}: {
  balance: number;
  bet: number;
  win: number | null;
  spinLocked: boolean;
  canSpin: boolean;
  onBet: (v: number) => void;
  onSpin: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 sm:gap-3">
      {/* balance */}
      <div className="hidden flex-col rounded-xl border border-amber-300/30 bg-black/45 px-3 py-1.5 backdrop-blur sm:flex">
        <span className="text-[0.55rem] font-black uppercase tracking-widest text-amber-300/90" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>Balance</span>
        <span className="flex items-center gap-1 font-mono text-sm font-black text-amber-100">
          <SolMark size={12} />{fmtSol(balance, 3)}
        </span>
      </div>

      {/* bet */}
      <div className="flex items-center gap-1 rounded-xl border border-amber-300/30 bg-black/45 px-1.5 py-1 backdrop-blur">
        <button
          onClick={() => onBet(Math.max(0.01, Math.round(bet * 50) / 100))}
          disabled={spinLocked}
          className="grid h-8 w-8 place-items-center rounded-lg border border-amber-300/40 bg-amber-500/15 font-mono text-lg font-black text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-30"
          aria-label="Lower bet"
        >
          −
        </button>
        <div className="min-w-[4.6rem] text-center">
          <div className="text-[0.55rem] font-black uppercase tracking-widest text-amber-300/90">Bet</div>
          <div className="flex items-center justify-center gap-1 font-mono text-sm font-black text-white">
            <SolMark size={12} />{fmtSol(bet)}
          </div>
          <div className="font-mono text-[0.55rem] text-amber-200/60">≈ ${(bet * SOL_USD).toFixed(2)}</div>
        </div>
        <button
          onClick={() => onBet(Math.round(bet * 200) / 100)}
          disabled={spinLocked}
          className="grid h-8 w-8 place-items-center rounded-lg border border-amber-300/40 bg-amber-500/15 font-mono text-lg font-black text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-30"
          aria-label="Raise bet"
        >
          +
        </button>
      </div>

      {/* win */}
      <div className="flex min-w-[5.5rem] flex-col items-center rounded-xl border border-amber-300/30 bg-black/45 px-3 py-1.5 backdrop-blur">
        <span className="text-[0.55rem] font-black uppercase tracking-widest text-amber-300/90">Win</span>
        <motion.span
          key={win ?? -1}
          initial={win ? { scale: 1.3 } : false}
          animate={{ scale: 1 }}
          className={`font-mono text-base font-black ${win ? 'text-gold' : 'text-amber-100/50'}`}
          style={win ? { textShadow: '0 0 14px rgba(255,210,95,0.8)' } : undefined}
        >
          {win === null ? '0.00' : win.toFixed(2)}
        </motion.span>
      </div>

      <div className="flex-1" />

      {/* the big round spin button */}
      <motion.button
        onClick={onSpin}
        disabled={spinLocked || !canSpin}
        whileTap={{ scale: 0.92 }}
        className="group relative grid h-16 w-16 place-items-center rounded-full font-display text-[0.62rem] font-black uppercase tracking-widest text-white disabled:opacity-40 sm:h-[4.5rem] sm:w-[4.5rem]"
        style={{
          background: 'radial-gradient(circle at 35% 30%, #ffcf7a, #f08a1c 55%, #a83c0a)',
          boxShadow:
            '0 0 0 3px rgba(255,220,150,0.8), 0 0 0 6px rgba(168,60,10,0.95), 0 10px 26px -6px rgba(240,138,28,0.85), inset 0 2px 3px rgba(255,255,255,0.55), inset 0 -4px 8px rgba(120,40,5,0.65)',
        }}
        aria-label="Spin"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:rotate-180">
          <path d="M4 12a8 8 0 018-8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M20 12a8 8 0 01-8 8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16 4l-1 4 4 .5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 20l1-4-4-.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/25 to-transparent opacity-0 transition group-hover:opacity-100" />
      </motion.button>
    </div>
  );
}

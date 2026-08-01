'use client';

import { motion } from 'framer-motion';
import { JACKPOTS } from '@/lib/slots/gold-express';
import { TRAIN_HEX } from './CanyonSymbols';
import { SolMark } from '@/components/BalanceWidget';
import { fmtSol, SOL_USD } from '@/lib/format';

/**
 * The canyon chrome — everything that makes the machine read as the reference
 * game at a glance: the golden desert sky and rock walls, the ore train parked
 * above the reels, the jackpot ladder on the left, the big logo, and the
 * Balance / Bet / WIN bar with the big round spin button.
 */

/* ------------------------------------------------------------- backdrop */

export function CanyonBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* warm desert sky */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg,#ffe9b8 0%,#ffd394 22%,#f2a96b 48%,#c97a4a 72%,#8a4a32 100%)',
        }}
      />
      {/* sun glow */}
      <div
        className="absolute -top-1/4 left-1/2 h-[80%] w-[90%] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(255,246,200,0.9),rgba(255,220,140,0.35) 45%,transparent 70%)' }}
      />
      {/* distant mesas */}
      <svg className="absolute inset-x-0 bottom-[30%] h-[46%] w-full" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden>
        <path d="M0 400 L0 260 L120 250 L160 190 L300 190 L340 250 L520 240 L560 300 L720 290 L760 220 L900 220 L940 280 L1200 270 L1200 400 Z" fill="#c98a5e" opacity="0.55" />
        <path d="M0 400 L0 320 L180 310 L240 260 L380 260 L420 310 L640 300 L700 340 L900 330 L960 290 L1200 300 L1200 400 Z" fill="#a96643" opacity="0.75" />
        <path d="M0 400 L0 360 L260 350 L320 320 L520 320 L580 355 L820 350 L900 325 L1200 340 L1200 400 Z" fill="#7c4630" />
      </svg>
      {/* near rock walls */}
      <div className="absolute inset-y-0 left-0 w-[10%]" style={{ background: 'linear-gradient(90deg,#6e3a26 0%,#a35c3a 70%,transparent 100%)' }} />
      <div className="absolute inset-y-0 right-0 w-[10%]" style={{ background: 'linear-gradient(270deg,#6e3a26 0%,#a35c3a 70%,transparent 100%)' }} />
      {/* canyon floor shadow */}
      <div className="absolute inset-x-0 bottom-0 h-[16%]" style={{ background: 'linear-gradient(180deg,transparent,rgba(46,24,12,0.75))' }} />
    </div>
  );
}

/* --------------------------------------------------------- the ore train */

function OreCart({ uid }: { uid: string }) {
  return (
    <svg width="98" height="70" viewBox="0 0 120 86" aria-hidden>
      <defs>
        <linearGradient id={`oc${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3b93f" />
          <stop offset="1" stopColor="#b06f14" />
        </linearGradient>
        <linearGradient id={`og${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#c07f16" />
        </linearGradient>
      </defs>
      {/* gold heap */}
      <circle cx="30" cy="30" r="16" fill={`url(#og${uid})`} />
      <circle cx="52" cy="22" r="18" fill={`url(#og${uid})`} />
      <circle cx="76" cy="28" r="16" fill={`url(#og${uid})`} />
      <circle cx="92" cy="36" r="12" fill={`url(#og${uid})`} />
      <circle cx="20" cy="40" r="12" fill={`url(#og${uid})`} />
      <circle cx="48" cy="18" r="4" fill="#fff7d6" opacity="0.9" />
      <circle cx="70" cy="24" r="3.5" fill="#fff7d6" opacity="0.9" />
      {/* cart body */}
      <path d="M8 44 L112 44 L102 66 L18 66 Z" fill={`url(#oc${uid})`} />
      <rect x="8" y="44" width="104" height="7" fill="#7c4a12" />
      {/* wheels */}
      <circle cx="34" cy="72" r="9" fill="#292524" />
      <circle cx="34" cy="72" r="3.5" fill="#a8a29e" />
      <circle cx="84" cy="72" r="9" fill="#292524" />
      <circle cx="84" cy="72" r="3.5" fill="#a8a29e" />
    </svg>
  );
}

function GoldenLoco({ uid }: { uid: string }) {
  return (
    <svg width="132" height="86" viewBox="0 0 170 110" aria-hidden>
      <defs>
        <linearGradient id={`gl${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd76a" />
          <stop offset="0.55" stopColor="#e8a428" />
          <stop offset="1" stopColor="#a86a10" />
        </linearGradient>
      </defs>
      {/* boiler */}
      <rect x="30" y="42" width="96" height="34" rx="15" fill={`url(#gl${uid})`} />
      {/* cab */}
      <rect x="104" y="14" width="44" height="40" rx="6" fill={`url(#gl${uid})`} />
      <rect x="112" y="20" width="20" height="14" rx="3" fill="#5b3a10" />
      {/* chimney + dome + lamp */}
      <rect x="36" y="24" width="12" height="20" rx="4" fill="#b06f14" />
      <ellipse cx="38" cy="22" rx="9" ry="5" fill="#d4922a" />
      <ellipse cx="66" cy="40" rx="10" ry="7" fill="#d4922a" />
      <circle cx="28" cy="56" r="8" fill="#fff7d6" />
      <circle cx="28" cy="56" r="12" fill="#fff7d6" opacity="0.3" />
      {/* cowcatcher */}
      <path d="M8 76 L30 76 L18 96 L4 96 Z" fill="#b06f14" />
      {/* frame + wheels */}
      <rect x="22" y="74" width="134" height="10" rx="4" fill="#3f2a12" />
      <circle cx="52" cy="92" r="13" fill="#292524" />
      <circle cx="52" cy="92" r="5" fill="#a8a29e" />
      <circle cx="86" cy="92" r="13" fill="#292524" />
      <circle cx="86" cy="92" r="5" fill="#a8a29e" />
      <circle cx="122" cy="94" r="10" fill="#292524" />
      <circle cx="122" cy="94" r="4" fill="#a8a29e" />
      {/* trim */}
      <rect x="30" y="46" width="96" height="4" fill="#fff3c4" opacity="0.6" />
    </svg>
  );
}

export function OreTrain({ running }: { running?: boolean }) {
  return (
    <div className="relative h-[52px] w-full sm:h-[64px]">
      {/* bridge beam */}
      <div className="absolute inset-x-0 bottom-[14px] h-[10px] rounded-sm" style={{ background: 'linear-gradient(180deg,#5b3a1c,#33200e)' }} />
      <div className="absolute inset-x-0 bottom-[24px] h-[3px]" style={{ background: 'rgba(255,220,150,0.35)' }} />
      <motion.div
        className="absolute bottom-[22px] flex items-end"
        animate={running ? { x: ['-30%', '110%'] } : { x: '22%' }}
        transition={running ? { repeat: Infinity, duration: 6, ease: 'linear' } : { duration: 0.8 }}
      >
        <motion.div
          className="flex items-end"
          animate={{ y: [0, -1.5, 0] }}
          transition={{ repeat: Infinity, duration: 0.55 }}
        >
          <GoldenLoco uid="l1" />
          <OreCart uid="c1" />
          <OreCart uid="c2" />
        </motion.div>
        {/* smoke */}
        <motion.span
          className="absolute -top-4 left-10 h-4 w-4 rounded-full bg-white/70 blur-[3px]"
          animate={{ y: [-4, -22], x: [0, 10, 18], opacity: [0.7, 0.4, 0], scale: [0.6, 1.4, 2] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
        />
        <motion.span
          className="absolute -top-3 left-10 h-3 w-3 rounded-full bg-white/60 blur-[2px]"
          animate={{ y: [-2, -18], x: [0, 8, 14], opacity: [0.6, 0.35, 0], scale: [0.5, 1.2, 1.8] }}
          transition={{ repeat: Infinity, duration: 1.6, delay: 0.55, ease: 'easeOut' }}
        />
      </motion.div>
    </div>
  );
}

/* --------------------------------------------------------- jackpot ladder */

export function JackpotLadder({ payScale }: { payScale: number }) {
  return (
    <div className="flex gap-1.5 sm:flex-col sm:gap-2">
      {JACKPOTS.map((j) => (
        <div
          key={j.tier}
          className="flex items-center gap-1.5 rounded-lg border-2 px-1.5 py-0.5"
          style={{
            borderColor: TRAIN_HEX[j.color].a,
            background: `linear-gradient(120deg, ${TRAIN_HEX[j.color].b}, ${TRAIN_HEX[j.color].a} 140%)`,
            boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.4), 0 4px 10px rgba(0,0,0,0.4)',
          }}
        >
          <span className="font-display text-[0.52rem] font-black uppercase tracking-wider text-white/90" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            {j.tier}
          </span>
          <span className="font-mono text-[0.72rem] font-black text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            {(j.value * payScale).toFixed(0)}×
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ logo */

export function CanyonLogo() {
  return (
    <div className="select-none text-right leading-none">
      <div
        className="font-display text-xl font-black uppercase tracking-wide sm:text-2xl"
        style={{
          color: '#ffd76a',
          textShadow: '0 2px 0 #a85a10, 0 4px 0 #7c3a08, 0 6px 14px rgba(0,0,0,0.55)',
        }}
      >
        Gold<span style={{ color: '#fff3c4' }}>Mine</span>
      </div>
      <div
        className="font-display text-2xl font-black uppercase tracking-[0.12em] sm:text-3xl"
        style={{
          color: '#ff9d3c',
          textShadow: '0 2px 0 #b34a0e, 0 4px 0 #7c2808, 0 6px 16px rgba(0,0,0,0.55)',
        }}
      >
        Express
      </div>
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
          background: 'radial-gradient(circle at 35% 30%, #ffb85c, #e8791c 55%, #a83c0a)',
          boxShadow:
            '0 0 0 3px rgba(255,220,150,0.7), 0 0 0 6px rgba(168,60,10,0.9), 0 10px 26px -6px rgba(232,121,28,0.8), inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -4px 8px rgba(120,40,5,0.6)',
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

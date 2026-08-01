'use client';

import { motion } from 'framer-motion';
import { JACKPOTS } from '@/lib/slots/gold-express';
import { TRAIN_HEX } from './CanyonSymbols';
import { SolMark } from '@/components/BalanceWidget';
import { fmtSol, SOL_USD } from '@/lib/format';

/**
 * The canyon chrome — the premium frame around the machine. A warm painted
 * desert sky with drifting clouds, layered mesas, a full-detail golden ore
 * train with faceted nuggets and turning wheels, the glossy jackpot ladder,
 * the gilded logo, and the Balance/Bet/WIN bar with the big round spin.
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
            'linear-gradient(180deg,#fff3cf 0%,#ffdf9e 20%,#f7b878 46%,#d98a55 70%,#96543a 100%)',
        }}
      />
      {/* sun glow */}
      <div
        className="absolute -top-1/4 left-1/2 h-[80%] w-[90%] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(255,248,214,0.95),rgba(255,224,150,0.4) 45%,transparent 72%)' }}
      />
      {/* drifting clouds */}
      {[
        { top: '7%', delay: 0, dur: 46, w: 300, o: 0.55 },
        { top: '16%', delay: -18, dur: 60, w: 220, o: 0.4 },
      ].map((c, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white blur-xl"
          style={{ top: c.top, width: c.w, height: 34, opacity: c.o }}
          animate={{ x: ['-30%', '115%'] }}
          transition={{ repeat: Infinity, duration: c.dur, delay: c.delay, ease: 'linear' }}
        />
      ))}
      {/* distant mesas */}
      <svg className="absolute inset-x-0 bottom-[30%] h-[46%] w-full" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden>
        <path d="M0 400 L0 260 L120 250 L160 190 L300 190 L340 250 L520 240 L560 300 L720 290 L760 220 L900 220 L940 280 L1200 270 L1200 400 Z" fill="#d99a6b" opacity="0.5" />
        <path d="M0 400 L0 320 L180 310 L240 260 L380 260 L420 310 L640 300 L700 340 L900 330 L960 290 L1200 300 L1200 400 Z" fill="#b8724c" opacity="0.72" />
        <path d="M0 400 L0 360 L260 350 L320 320 L520 320 L580 355 L820 350 L900 325 L1200 340 L1200 400 Z" fill="#8a4e35" />
        {/* strata lines on the nearest mesa */}
        <path d="M0 372 L1200 372 M0 384 L1200 384" stroke="#6e3a26" strokeWidth="2" opacity="0.35" />
      </svg>
      {/* birds */}
      <motion.g animate={{ x: ['-10%', '110%'], y: [0, -8, 0, 6, 0] }} transition={{ repeat: Infinity, duration: 26, ease: 'linear' }}>
        <svg className="absolute left-0 top-[12%] h-4 w-10" viewBox="0 0 40 16" aria-hidden>
          <path d="M2 10 Q8 4 14 10 M14 10 Q20 4 26 10 M26 10 Q32 6 38 10" stroke="#5b3410" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.6" />
        </svg>
      </motion.g>
      {/* near rock walls */}
      <div className="absolute inset-y-0 left-0 w-[10%]" style={{ background: 'linear-gradient(90deg,#6e3a26 0%,#a35c3a 70%,transparent 100%)' }} />
      <div className="absolute inset-y-0 right-0 w-[10%]" style={{ background: 'linear-gradient(270deg,#6e3a26 0%,#a35c3a 70%,transparent 100%)' }} />
      {/* canyon floor shadow + warm vignette */}
      <div className="absolute inset-x-0 bottom-0 h-[16%]" style={{ background: 'linear-gradient(180deg,transparent,rgba(46,24,12,0.78))' }} />
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 90px rgba(122,58,20,0.35)' }} />
    </div>
  );
}

/* --------------------------------------------------------- the ore train */

function GoldHeap({ uid }: { uid: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`gh${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.5" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#c07f16" />
        </linearGradient>
      </defs>
      <path d="M18 46 L26 26 L44 18 L64 20 L76 30 L88 28 L100 42 L96 50 L24 50 Z" fill={`url(#gh${uid})`} />
      <path d="M26 26 L44 18 L40 28 L22 34 Z" fill="#fffbe8" opacity="0.55" />
      <path d="M44 18 L64 20 L58 30 L40 28 Z" fill="#fffbe8" opacity="0.45" />
      <path d="M76 30 L88 28 L100 42 L84 44 Z" fill="#fffbe8" opacity="0.35" />
      <path d="M70 20 L74 15 L78 20 L74 25 Z" fill="#fffbe8" opacity="0.9" />
    </g>
  );
}

function OreCart({ uid }: { uid: string }) {
  return (
    <svg width="98" height="70" viewBox="0 0 120 86" aria-hidden>
      <defs>
        <linearGradient id={`oc${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3b93f" />
          <stop offset="0.55" stopColor="#d4922a" />
          <stop offset="1" stopColor="#96590e" />
        </linearGradient>
      </defs>
      <GoldHeap uid={uid} />
      {/* cart body with rim and strapping */}
      <path d="M8 44 L112 44 L102 66 L18 66 Z" fill={`url(#oc${uid})`} />
      <rect x="8" y="44" width="104" height="6" fill="#5b3410" />
      {[30, 52, 74, 96].map((x) => (
        <rect key={x} x={x} y="50" width="3" height="16" fill="#7c4a12" opacity="0.7" />
      ))}
      <path d="M8 44 L112 44 L109 50 L11 50 Z" fill="#ffe9a8" opacity="0.35" />
      {/* wheels */}
      {[34, 84].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="72" r="9" fill="#292524" />
          {Array.from({ length: 6 }).map((_, k) => (
            <line key={k} x1={cx} y1="72" x2={cx + 9 * Math.cos((k * Math.PI) / 3)} y2={72 + 9 * Math.sin((k * Math.PI) / 3)} stroke="#78716c" strokeWidth="1.2" />
          ))}
          <circle cx={cx} cy="72" r="3.5" fill="#a8a29e" />
        </g>
      ))}
    </svg>
  );
}

function GoldenLoco({ uid }: { uid: string }) {
  return (
    <svg width="132" height="86" viewBox="0 0 170 110" aria-hidden>
      <defs>
        <linearGradient id={`gl${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.5" stopColor="#f3b93f" />
          <stop offset="1" stopColor="#a86a10" />
        </linearGradient>
        <linearGradient id={`gt${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* boiler */}
      <rect x="30" y="42" width="96" height="34" rx="15" fill={`url(#gl${uid})`} />
      <rect x="30" y="42" width="96" height="11" rx="7" fill={`url(#gt${uid})`} />
      {[44, 62, 80, 98, 116].map((x) => (
        <rect key={x} x={x} y="42" width="3" height="34" fill="#7c4a12" opacity="0.35" />
      ))}
      {/* cab */}
      <rect x="104" y="14" width="44" height="40" rx="6" fill={`url(#gl${uid})`} />
      <rect x="104" y="14" width="44" height="13" rx="6" fill={`url(#gt${uid})`} opacity="0.8" />
      <rect x="112" y="20" width="20" height="14" rx="3" fill="#2a1a08" />
      <rect x="114" y="22" width="16" height="10" rx="2" fill="#ffe9b8" opacity="0.92" />
      <rect x="100" y="10" width="52" height="7" rx="3.5" fill="#a86a10" />
      {/* chimney, cap, dome */}
      <rect x="36" y="24" width="12" height="20" rx="4" fill="#a86a10" />
      <ellipse cx="42" cy="22" rx="10" ry="5" fill="#c07f16" />
      <ellipse cx="42" cy="20.5" rx="10" ry="4" fill="#f3b93f" />
      <ellipse cx="66" cy="40" rx="10" ry="7" fill="#c07f16" />
      <ellipse cx="64" cy="37" rx="4" ry="2.5" fill="#fff" opacity="0.5" />
      {/* headlamp */}
      <circle cx="27" cy="56" r="8" fill="#3f2a12" />
      <circle cx="27" cy="56" r="5.5" fill="#fff3c4" />
      <circle cx="27" cy="56" r="11" fill="#fff3c4" opacity="0.3" />
      {/* cowcatcher */}
      <path d="M8 76 L30 76 L18 96 L4 96 Z" fill="#a86a10" />
      <path d="M8 76 L30 76 L26 82 L6.5 82 Z" fill="#f3b93f" opacity="0.7" />
      {/* frame, wheels, rods */}
      <rect x="22" y="74" width="134" height="10" rx="4" fill="#3f2a12" />
      {[{ cx: 52, r: 13 }, { cx: 86, r: 13 }, { cx: 122, r: 10 }].map((w, i) => (
        <g key={i}>
          <circle cx={w.cx} cy="92" r={w.r} fill="#292524" />
          {Array.from({ length: 8 }).map((_, k) => (
            <line key={k} x1={w.cx} y1="92" x2={w.cx + w.r * Math.cos((k * Math.PI) / 4)} y2={92 + w.r * Math.sin((k * Math.PI) / 4)} stroke="#78716c" strokeWidth="1.4" />
          ))}
          <circle cx={w.cx} cy="92" r={w.r * 0.4} fill="#a8a29e" />
        </g>
      ))}
      <rect x="52" y="88" width="70" height="4" rx="2" fill="#78716c" />
    </svg>
  );
}

export function OreTrain({ running }: { running?: boolean }) {
  return (
    <div className="relative h-[52px] w-full sm:h-[64px]">
      {/* bridge beam + ties */}
      <div className="absolute inset-x-0 bottom-[14px] h-[10px] rounded-sm" style={{ background: 'linear-gradient(180deg,#5b3a1c,#33200e)' }} />
      <div className="absolute inset-x-0 bottom-[24px] h-[3px]" style={{ background: 'rgba(255,220,150,0.35)' }} />
      <div
        className="absolute inset-x-0 bottom-[14px] h-[10px]"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg,rgba(0,0,0,0.35) 0 3px,transparent 3px 22px)' }}
      />
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
        {/* smoke puffs */}
        {[0, 0.55, 1.1].map((d, i) => (
          <motion.span
            key={i}
            className="absolute -top-4 left-10 rounded-full bg-white/70 blur-[3px]"
            style={{ width: 12 + i * 3, height: 12 + i * 3 }}
            animate={{ y: [-4, -24], x: [0, 12, 22], opacity: [0.65, 0.35, 0], scale: [0.6, 1.5, 2.1] }}
            transition={{ repeat: Infinity, duration: 1.7, delay: d, ease: 'easeOut' }}
          />
        ))}
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

/* ------------------------------------------------------------------ logo */

export function CanyonLogo() {
  return (
    <div className="select-none text-right leading-none">
      <div
        className="font-display text-xl font-black uppercase tracking-wide sm:text-2xl"
        style={{
          color: '#ffd76a',
          textShadow: '0 1px 0 #fff3c4, 0 3px 0 #a85a10, 0 5px 0 #7c3a08, 0 8px 18px rgba(0,0,0,0.6)',
        }}
      >
        Gold<span style={{ color: '#fff3c4' }}>Mine</span>
      </div>
      <div
        className="font-display text-2xl font-black uppercase tracking-[0.12em] sm:text-3xl"
        style={{
          color: '#ff9d3c',
          textShadow: '0 1px 0 #ffe9a8, 0 3px 0 #b34a0e, 0 5px 0 #7c2808, 0 8px 20px rgba(0,0,0,0.6)',
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

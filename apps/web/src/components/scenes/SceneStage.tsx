'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { fmtMult } from '@/lib/format';
import { Icon, type IconName } from '@/components/Icon';
import type { Palette, PresentationId } from '@/lib/presentation';

export interface SceneProps {
  presentation: PresentationId;
  mult: number | null;
  win: boolean | null;
  rolling: boolean;
  palette: Palette;
  round: number; // increments each result to retrigger animation
  compact?: boolean;
}

const SCENES: Record<string, (p: SceneProps) => JSX.Element> = {
  orb: Orb,
  rocket: Rocket,
  reel: Reel,
  burst: Burst,
  wheel: WheelScene,
  cards: Cards,
  shatter: Shatter,
  pulse: Pulse,
};

export function SceneStage(props: SceneProps) {
  const { presentation, compact } = props;
  const Scene = SCENES[presentation] ?? Pulse;
  return (
    <div className={`grid place-items-center ${compact ? 'h-full scale-[0.62]' : 'h-full min-h-[280px]'}`}>
      <Scene {...props} />
    </div>
  );
}

const winColor = (win: boolean | null, p: Palette) => (win === null ? '#94a3b8' : win ? '#10f5a0' : '#ff3b6b');

function Label({ mult, win, p }: { mult: number | null; win: boolean | null; p: Palette }) {
  return (
    <div className="mt-3 h-6 text-center text-sm font-semibold" style={{ color: winColor(win, p) }}>
      {win === true ? `Paid ${fmtMult(mult!)}` : win === false ? 'No win' : 'Ready'}
    </div>
  );
}

/* ------------------------------------------------------------------- Pulse */
function Pulse({ mult, win, rolling, palette, round }: SceneProps) {
  return (
    <div className="text-center">
      <motion.div
        key={round}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={rolling ? { scale: [1, 1.05, 1], opacity: 0.6 } : { scale: 1, opacity: 1 }}
        transition={rolling ? { repeat: Infinity, duration: 0.5 } : { type: 'spring', stiffness: 300, damping: 16 }}
        className="font-display text-7xl font-bold tabular-nums md:text-8xl"
        style={{ color: winColor(win, palette), textShadow: `0 0 50px ${winColor(win, palette)}88` }}
      >
        {rolling ? '…' : mult === null ? '—' : fmtMult(mult)}
      </motion.div>
      <Label mult={mult} win={win} p={palette} />
    </div>
  );
}

/* --------------------------------------------------------------------- Orb */
function Orb({ mult, win, rolling, palette, round }: SceneProps) {
  const c = win === null ? palette.primary : winColor(win, palette);
  return (
    <div className="text-center">
      <div className="relative mx-auto grid h-44 w-44 place-items-center">
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={rolling ? { scale: [0.85, 1.05, 0.85], opacity: [0.6, 1, 0.6] } : { scale: 1, opacity: 0.9 }}
          transition={rolling ? { repeat: Infinity, duration: 0.7 } : { duration: 0.3 }}
          style={{ background: `radial-gradient(circle at 40% 35%, ${palette.secondary}, ${c} 70%)`, boxShadow: `0 0 60px -8px ${c}` }}
        />
        <motion.div
          key={round}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 15 }}
          className="relative z-10 font-display text-4xl font-bold text-void-950"
        >
          {rolling ? '' : mult === null ? '' : fmtMult(mult)}
        </motion.div>
      </div>
      <Label mult={mult} win={win} p={palette} />
    </div>
  );
}

/* ------------------------------------------------------------------ Rocket */
function Rocket({ mult, win, rolling, palette, round }: SceneProps) {
  const h = mult ? Math.min(1, Math.log2(mult + 1) / Math.log2(51)) : 0;
  const c = winColor(win, palette);
  return (
    <div className="w-full max-w-md">
      <div className="relative mx-auto h-52 w-full overflow-hidden rounded-xl border border-white/[0.06]" style={{ background: `linear-gradient(180deg, ${palette.primary}14, transparent)` }}>
        {[20, 40, 60, 80].map((y) => (
          <div key={y} className="absolute inset-x-0 h-px bg-white/[0.05]" style={{ top: `${y}%` }} />
        ))}
        <motion.div
          key={round}
          className="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full"
          initial={{ bottom: '4%' }}
          animate={rolling ? { bottom: ['8%', '16%', '8%'] } : { bottom: `${4 + h * 88}%` }}
          transition={rolling ? { repeat: Infinity, duration: 0.6 } : { type: 'spring', stiffness: 120, damping: 14 }}
          style={{ background: c, boxShadow: `0 0 20px ${c}` }}
        />
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-display text-5xl font-bold" style={{ color: c, textShadow: `0 0 40px ${c}88` }}>
            {rolling ? '' : mult === null ? '—' : fmtMult(mult)}
          </span>
        </div>
      </div>
      <Label mult={mult} win={win} p={palette} />
    </div>
  );
}

/* -------------------------------------------------------------------- Reel */
const SLOT_SYMS: IconName[] = ['gem', 'coin', 'star', 'clover', 'crown', 'flame'];
const REEL_H = 56;

function ReelCol({ finalIdx, rolling, round, ri, c }: { finalIdx: number; rolling: boolean; round: number; ri: number; c: string }) {
  const n = SLOT_SYMS.length;
  // A short strip of fillers ending on the landing symbol.
  const strip = [...Array(5)].map((_, k) => SLOT_SYMS[(finalIdx + k + 1) % n]);
  strip.push(SLOT_SYMS[finalIdx]);
  const rest = -(strip.length - 1) * REEL_H;
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-void-950/70" style={{ height: REEL_H, width: REEL_H }}>
      <motion.div
        key={round}
        animate={{ y: rolling ? [rest, 0, rest] : rest }}
        transition={rolling ? { repeat: Infinity, duration: 0.32 + ri * 0.06, ease: 'linear' } : { type: 'spring', stiffness: 120, damping: 13, delay: ri * 0.12 }}
      >
        {strip.map((s, k) => (
          <div key={k} className="grid place-items-center" style={{ height: REEL_H, color: k === strip.length - 1 ? c : '#475569' }}>
            <Icon name={s} size={26} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function Reel({ mult, win, rolling, palette, round }: SceneProps) {
  const c = winColor(win, palette);
  const base = round % SLOT_SYMS.length;
  // Win → three of a kind; loss → a deliberately non-matching line.
  const finals = win === true ? [base, base, base] : [base, (base + 2) % SLOT_SYMS.length, (base + 4) % SLOT_SYMS.length];
  return (
    <div className="text-center">
      <div className="mx-auto flex w-fit gap-2 rounded-xl border-2 p-2" style={{ borderColor: `${c}66`, boxShadow: `0 0 40px -10px ${c}` }}>
        {finals.map((f, ri) => (
          <ReelCol key={ri} finalIdx={f} rolling={rolling} round={round} ri={ri} c={c} />
        ))}
      </div>
      <Label mult={mult} win={win} p={palette} />
    </div>
  );
}

/* ------------------------------------------------------------------ Burst */
function Burst({ mult, win, rolling, palette, round }: SceneProps) {
  const c = winColor(win, palette);
  return (
    <div className="text-center">
      <div className="relative mx-auto grid h-44 w-44 place-items-center">
        <AnimatePresence>
          {!rolling && win !== null && (
            <motion.div key={round} className="absolute inset-0" initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.7 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="absolute left-1/2 top-1/2 h-16 w-1 origin-top" style={{ background: `linear-gradient(${c}, transparent)`, transform: `rotate(${i * 30}deg)` }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          className="absolute inset-6 rounded-full"
          animate={rolling ? { scale: [0.9, 1.1, 0.9] } : { scale: 1 }}
          transition={rolling ? { repeat: Infinity, duration: 0.6 } : { duration: 0.3 }}
          style={{ background: `radial-gradient(circle, ${palette.secondary}44, transparent 70%)` }}
        />
        <motion.span key={round} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="relative z-10 font-display text-4xl font-bold" style={{ color: c, textShadow: `0 0 30px ${c}` }}>
          {rolling ? '' : mult === null ? '—' : fmtMult(mult)}
        </motion.span>
      </div>
      <Label mult={mult} win={win} p={palette} />
    </div>
  );
}

/* ------------------------------------------------------------------- Wheel */
function WheelScene({ mult, win, rolling, palette, round }: SceneProps) {
  const c = winColor(win, palette);
  const conic = `conic-gradient(${palette.primary} 0deg 60deg, ${palette.secondary} 60deg 120deg, ${palette.primary} 120deg 180deg, ${palette.secondary} 180deg 240deg, ${palette.primary} 240deg 300deg, ${palette.secondary} 300deg 360deg)`;
  return (
    <div className="text-center">
      <div className="relative mx-auto h-44 w-44">
        <div className="absolute left-1/2 top-[-4px] z-20 h-0 w-0 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent border-t-white" />
        <motion.div
          key={round}
          className="h-full w-full rounded-full"
          animate={{ rotate: rolling ? 360 * 3 : 360 * 5 + 33 }}
          transition={rolling ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 2.4, ease: [0.15, 0.85, 0.2, 1] }}
          style={{ background: conic, boxShadow: `0 0 50px -14px ${c}`, opacity: 0.9 }}
        />
        <div className="absolute left-1/2 top-1/2 z-10 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-void-900/90">
          <span className="font-display text-xl font-bold" style={{ color: c }}>{rolling ? '' : mult === null ? '—' : fmtMult(mult)}</span>
        </div>
      </div>
      <Label mult={mult} win={win} p={palette} />
    </div>
  );
}

/* ------------------------------------------------------------------- Cards */
function Cards({ mult, win, rolling, palette, round }: SceneProps) {
  const c = winColor(win, palette);
  const revealed = !rolling && mult !== null;
  return (
    <div className="text-center">
      <div className="mx-auto h-44 w-32" style={{ perspective: 800 }}>
        <motion.div
          key={round}
          className="relative h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: rolling ? [0, 180, 360] : revealed ? 180 : 0 }}
          transition={rolling ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0.6 }}
        >
          <div className="absolute inset-0 grid place-items-center rounded-2xl border border-white/10" style={{ backfaceVisibility: 'hidden', background: `linear-gradient(160deg, ${palette.primary}, ${palette.secondary})` }}>
            <div className="h-10 w-10 rounded-full border-2 border-white/40" />
          </div>
          <div className="absolute inset-0 grid place-items-center rounded-2xl border-2 bg-void-900" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderColor: `${c}88` }}>
            <span className="font-display text-2xl font-bold" style={{ color: c }}>{mult === null ? '' : fmtMult(mult)}</span>
          </div>
        </motion.div>
      </div>
      <Label mult={mult} win={win} p={palette} />
    </div>
  );
}

/* ----------------------------------------------------------------- Shatter */
function Shatter({ mult, win, rolling, palette, round }: SceneProps) {
  const c = winColor(win, palette);
  return (
    <div className="text-center">
      <div className="relative mx-auto grid h-44 w-44 place-items-center">
        <motion.svg
          key={round}
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          animate={rolling ? { rotate: [0, 6, -6, 0], scale: [1, 1.03, 1] } : { scale: [0.9, 1] }}
          transition={rolling ? { repeat: Infinity, duration: 0.5 } : { duration: 0.3 }}
        >
          <defs>
            <linearGradient id="cryst" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={palette.primary} />
              <stop offset="1" stopColor={palette.secondary} />
            </linearGradient>
          </defs>
          <polygon points="50,6 82,32 68,86 32,86 18,32" fill="url(#cryst)" opacity={0.85} stroke={c} strokeWidth={1.5} />
          {!rolling && win !== null && (
            <g stroke="#05060f" strokeWidth={1}>
              <line x1="50" y1="6" x2="50" y2="86" />
              <line x1="18" y1="32" x2="82" y2="32" />
              <line x1="32" y1="86" x2="68" y2="32" />
            </g>
          )}
        </motion.svg>
        <span className="relative z-10 font-display text-3xl font-bold text-void-950" style={{ textShadow: `0 1px 6px rgba(255,255,255,0.4)` }}>
          {rolling ? '' : mult === null ? '' : fmtMult(mult)}
        </span>
      </div>
      <Label mult={mult} win={win} p={palette} />
    </div>
  );
}

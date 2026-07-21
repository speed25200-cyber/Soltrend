'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { fmtMult } from '@/lib/format';
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

export function SceneStage(props: SceneProps) {
  const { presentation, compact } = props;
  const Scene =
    presentation === 'orb' ? Orb : presentation === 'rocket' ? Rocket : presentation === 'reel' ? Reel : presentation === 'burst' ? Burst : Pulse;
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
function Reel({ mult, win, rolling, palette, round }: SceneProps) {
  const c = winColor(win, palette);
  const strip = [0.2, 5, 1.1, 0, 2.4, 0.5, mult ?? 0];
  const rowH = 64;
  return (
    <div className="text-center">
      <div className="relative mx-auto h-[64px] w-40 overflow-hidden rounded-xl border-2" style={{ borderColor: `${c}66`, boxShadow: `0 0 40px -10px ${c}` }}>
        <div className="pointer-events-none absolute inset-0 z-10" style={{ background: 'linear-gradient(180deg,#05060f, transparent 30%, transparent 70%, #05060f)' }} />
        <motion.div
          key={round}
          initial={{ y: -(strip.length - 1) * rowH - (rolling ? 0 : 0) }}
          animate={{ y: rolling ? [-(strip.length - 1) * rowH, 0, -(strip.length - 1) * rowH] : -(strip.length - 1) * rowH }}
          transition={rolling ? { repeat: Infinity, duration: 0.4, ease: 'linear' } : { type: 'spring', stiffness: 90, damping: 14 }}
        >
          {strip.map((v, i) => (
            <div key={i} className="grid font-display text-3xl font-bold tabular-nums" style={{ height: rowH, placeItems: 'center', color: i === strip.length - 1 ? c : '#64748b' }}>
              {fmtMult(v)}
            </div>
          ))}
        </motion.div>
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

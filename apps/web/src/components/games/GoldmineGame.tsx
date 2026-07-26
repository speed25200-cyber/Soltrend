'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { round2, DEFAULT_EDGE } from '@/lib/games';
import { floatStream } from '@/lib/provably-fair';
import { Icon } from '@/components/Icon';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import { MineSymbol } from './goldmine/MineSymbol';
import { ReelWindow, Cabinet, reelPlan } from './goldmine/ReelMachine';
import {
  REELS, ROWS, BERTHS, WAGON, SYMBOLS, MAX_WIN,
  playRound, slotFromParams, type RoundResult, type SlotConfig, type WagonCargo,
} from '@/lib/slots/goldmine';
import type { GameConfig } from './types';

type Phase = 'idle' | 'spinning' | 'base' | 'boarding' | 'express' | 'done';

const STEP_MS = 950;

/**
 * GOLDMINE EXPRESS — the train hold-and-win.
 *
 * The whole round is resolved by the engine the instant you spin, so the outcome
 * is fixed by the reserved seed and nothing on screen can move it. The board
 * then replays it: the bands travel and brake one reel at a time, hanging on the
 * last ones while the wagons are still on pace, and if enough land the rig
 * converts into a train — wagons lock into berths holding their gold, and each
 * respin is a step down the track that only ends when three go by empty.
 */
export function GoldmineGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params, maxBet, demo}: GameConfig) {
  const cfg: SlotConfig = useMemo(() => slotFromParams(params), [params]);
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);
  const recordBest = useCasino((s) => s.recordBest);

  const [bet, setBet] = useState(0.1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<RoundResult | null>(null);
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [spinKey, setSpinKey] = useState(0);
  const [plan, setPlan] = useState(() => reelPlan(null, cfg.trigger));
  const timers = useRef<number[]>([]);
  const busy = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms) as unknown as number);
  };

  const g = guard(bet);
  const bonus = result?.bonus ?? null;
  const step = bonus?.steps[stepIdx];
  const onTrain = phase === 'boarding' || phase === 'express';

  const spin = () => {
    if (busy.current || !g.ok) return;
    busy.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const seeds = reserveSeeds();
    const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
    const round = playRound(() => stream.next(), cfg);

    // The braking schedule is derived from the grid the engine just produced, so
    // the reels hang exactly when the wagons really were still on pace.
    const rp = reelPlan(round.base.grid, cfg.trigger);
    setResult(round);
    setGrid(round.base.grid);
    setStepIdx(0);
    setPlan(rp);
    setSpinKey((k) => k + 1);
    setPhase('spinning');
    sfx.bet();
    rp.stops.forEach((t, r) => {
      if (rp.antic[r]) after(Math.max(0, t - 820), () => sfx.anticipate(820));
      after(t, () => sfx.reelStop(r));
    });

    // Settle now — the seed decided this, not the replay.
    settle(
      {
        game: gameName ?? meta.name,
        template: 'slots',
        bet,
        multiplier: round.total,
        payout: round2(bet * round.total),
        win: round.total > 0,
        meta: { wagons: round.base.wagons, express: !!round.bonus, filled: !!round.bonus?.filled },
        seeds,
      },
      { quiet: true },
    );
    if (gameId) bumpUgc(gameId, bet);
    if (round.total > 0) recordBest(gameId ?? meta.slug, round.total);

    after(rp.total, () => {
      setPhase('base');
      if (round.base.won > 0) sfx.tick(round.base.wins.length);

      if (round.bonus) {
        // The rig converts into a train.
        after(1200, () => {
          setPhase('boarding');
          sfx.jackpot();
          after(1100, () => runSteps(1, round));
        });
      } else {
        after(round.base.won > 0 ? 1000 : 500, () => finish(round));
      }
    });
  };

  const runSteps = (i: number, round: RoundResult) => {
    const b = round.bonus!;
    if (i >= b.steps.length) {
      finish(round);
      return;
    }
    setStepIdx(i);
    setPhase('express');
    const s = b.steps[i];
    if (s.landed.length > 0) sfx.tick(s.landed.length + 2);
    if (s.events.some((e) => e.kind === 'locomotive')) sfx.win(3);
    after(STEP_MS, () => runSteps(i + 1, round));
  };

  const finish = (round: RoundResult) => {
    setPhase('done');
    if (round.total > 0) {
      sfx.win(round.total);
      burstWin(round.total, { colors: ['#fcd34d', '#fb923c', '#ffffff'] });
    } else {
      sfx.loss();
    }
    busy.current = false;
  };

  const train = step?.train ?? null;
  const haulNow = bonus ? (step?.haul ?? 0) * (bonus.multiplier || 1) : 0;

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl sm:min-h-[480px]">
          {/* the shaft */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#2a1d0d_0%,#0e0a06_55%,#05060f_100%)]" />
          <MineDust running={onTrain} />

          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 p-3 pb-14">
            <AnimatePresence mode="wait">
              {onTrain && train ? (
                <motion.div
                  key="train"
                  initial={{ opacity: 0, x: 90 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -90 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                  className="flex w-full justify-center"
                >
                  <Cabinet title="Express Run" lit>
                    <div className="rounded-xl bg-[#06040a] p-2">
                      <TrainBoard train={train} landed={step?.landed ?? []} />
                    </div>
                  </Cabinet>
                </motion.div>
              ) : (
                <motion.div
                  key="reels"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  className="flex w-full justify-center"
                >
                  <ReelWindow
                    grid={grid}
                    weights={cfg.weights}
                    plan={plan}
                    spinning={phase === 'spinning'}
                    spinKey={spinKey}
                    wins={result?.base.wins ?? []}
                    showWins={phase === 'base' || phase === 'done'}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* the rail */}
            <Rail running={phase === 'express'} />

            {/* readout */}
            <div className="flex min-h-[2rem] items-center gap-3">
              {onTrain && (
                <>
                  <span className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-1 font-mono text-sm font-black text-gold">
                    {step?.respinsLeft ?? 0} respins
                  </span>
                  <motion.span key={haulNow} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="font-mono text-2xl font-black text-white" style={{ textShadow: '0 0 22px #fcd34d66' }}>
                    {haulNow.toFixed(2)}×
                  </motion.span>
                  {bonus && bonus.multiplier > 1 && (
                    <span className="rounded-lg border border-orange-400/50 bg-orange-500/10 px-2 py-0.5 font-mono text-xs font-bold text-orange-300">
                      ×{bonus.multiplier} dynamite
                    </span>
                  )}
                </>
              )}
              {!onTrain && (phase === 'base' || phase === 'done') && result && result.base.wins.length > 0 && (
                <>
                  {result.base.wins.map((w) => (
                    <motion.span
                      key={w.sym}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1 rounded-lg border border-gold/25 bg-gold/[0.07] px-2 py-0.5"
                    >
                      <MineSymbol sym={w.sym} size={16} />
                      <span className="font-mono text-[0.62rem] text-amber-200">
                        {w.length}× · {w.ways} ways · {w.pay.toFixed(2)}
                      </span>
                    </motion.span>
                  ))}
                  <motion.span key={result.base.won} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="font-mono text-xl font-black text-white">
                    {result.base.won.toFixed(2)}×
                  </motion.span>
                </>
              )}
            </div>
          </div>

          {/* banners */}
          <AnimatePresence>
            {phase === 'boarding' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 grid place-items-center"
              >
                <span className="rounded-2xl border border-gold/50 bg-void-950/90 px-6 py-3 font-display text-2xl font-black uppercase tracking-widest text-gold backdrop-blur">
                  Express Run
                </span>
              </motion.div>
            )}
            {phase === 'done' && result && result.total > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute inset-x-0 bottom-3 z-20 flex justify-center"
              >
                <span className="rounded-2xl border border-gold/40 bg-void-950/85 px-5 py-2 font-display text-xl font-black text-gold backdrop-blur">
                  {result.bonus?.filled ? 'FULL TRAIN · ' : ''}{result.total.toFixed(2)}× · ◎{(bet * result.total).toFixed(4)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      controls={
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-void-900/50 p-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/15 text-gold"><Icon name="gem" size={16} /></span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Goldmine Express</div>
              <div className="text-[0.68rem] text-slate-500">{REELS}×{ROWS} ways · {cfg.trigger} wagons start the train</div>
            </div>
          </div>

          <BetAmount value={bet} onChange={setBet} disabled={phase !== 'idle' && phase !== 'done'} />
          <BetButton guard={g} onClick={spin} busy={phase !== 'idle' && phase !== 'done'}>
            Dig ◎{bet}
          </BetButton>

          <Paytable cfg={cfg} />
        </div>
      }
    />
  );
}

/** The train: five wagons, four berths each, pulled by the locomotive. */
function TrainBoard({ train, landed }: { train: (WagonCargo | null)[]; landed: number[] }) {
  return (
    <div className="flex items-end justify-center gap-1.5 sm:gap-2">
      <Locomotive />
      {Array.from({ length: REELS }).map((_, r) => (
        <div key={r} className="flex flex-col gap-1.5 rounded-lg border border-white/[0.07] bg-black/30 p-1 sm:gap-2">
          {Array.from({ length: ROWS }).map((_, row) => {
            const b = r * ROWS + row;
            const cargo = train[b];
            const isNew = landed.includes(b);
            return <Berth key={row} cargo={cargo} isNew={isNew} />;
          })}
          <div className="flex justify-around px-1">
            <Wheel /><Wheel />
          </div>
        </div>
      ))}
    </div>
  );
}

function Berth({ cargo, isNew }: { cargo: WagonCargo | null; isNew: boolean }) {
  const tone =
    cargo?.kind === 'locomotive' ? { ring: '#22d3ee', text: '#a5f3fc' }
      : cargo?.kind === 'payer' ? { ring: '#34d399', text: '#6ee7b7' }
        : cargo?.kind === 'dynamite' ? { ring: '#ff5a3c', text: '#ff8a5c' }
          : { ring: '#fcd34d', text: '#fde68a' };

  return (
    <div className="relative grid h-10 w-11 place-items-center rounded-lg border border-white/[0.06] bg-void-950/70 sm:h-12 sm:w-14">
      <AnimatePresence>
        {cargo && (
          <motion.div
            initial={isNew ? { y: -40, opacity: 0, scale: 0.6 } : false}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="absolute inset-0 grid place-items-center rounded-lg"
            style={{ boxShadow: `inset 0 0 0 1.5px ${tone.ring}66, 0 0 18px -6px ${tone.ring}` }}
          >
            {cargo.kind === 'dynamite' ? (
              <span className="font-mono text-xs font-black" style={{ color: tone.text }}>×{cargo.value}</span>
            ) : cargo.kind === 'locomotive' ? (
              <span className="text-[0.55rem] font-black uppercase" style={{ color: tone.text }}>Loco</span>
            ) : cargo.kind === 'payer' ? (
              <span className="text-[0.55rem] font-black uppercase" style={{ color: tone.text }}>Payer</span>
            ) : null}
            {cargo.kind !== 'dynamite' && (
              <span className="absolute bottom-0.5 font-mono text-[0.6rem] font-bold" style={{ color: tone.text }}>
                {cargo.value.toFixed(2)}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {isNew && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-lg ring-2"
          style={{ borderColor: tone.ring }}
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.6 }}
        />
      )}
    </div>
  );
}

function Locomotive() {
  return (
    <div className="relative mr-1 hidden flex-col items-center sm:flex">
      <motion.div
        animate={{ y: [0, -1.5, 0] }}
        transition={{ repeat: Infinity, duration: 0.6 }}
        className="grid h-24 w-16 place-items-end rounded-l-2xl rounded-r-lg border border-white/10 bg-gradient-to-b from-[#3f2a12] to-[#160d05] p-1"
      >
        <svg width="52" height="72" viewBox="0 0 52 72" aria-hidden>
          <rect x="6" y="26" width="40" height="30" rx="4" fill="#78350f" />
          <rect x="10" y="10" width="18" height="18" rx="3" fill="#92400e" />
          <rect x="30" y="4" width="10" height="24" rx="3" fill="#b45309" />
          <circle cx="20" cy="40" r="7" fill="#fde68a" opacity="0.9" />
          <rect x="4" y="54" width="44" height="6" rx="2" fill="#451a03" />
        </svg>
      </motion.div>
      <div className="flex w-full justify-around px-1">
        <Wheel big /><Wheel big />
      </div>
    </div>
  );
}

function Wheel({ big }: { big?: boolean }) {
  return (
    <motion.span
      className={`mt-0.5 block rounded-full border-2 border-slate-600 bg-slate-800 ${big ? 'h-5 w-5' : 'h-3 w-3'}`}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: big ? 1.1 : 0.8, ease: 'linear' }}
    />
  );
}

/** Track that scrolls under the train — the sense of actually moving. */
function Rail({ running }: { running: boolean }) {
  return (
    <div className="relative h-3 w-full max-w-[38rem] overflow-hidden rounded-full border-y border-white/[0.06] bg-black/40">
      <motion.div
        className="absolute inset-0"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg,#78350f 0 6px,transparent 6px 22px)' }}
        animate={running ? { x: [0, -22] } : { x: 0 }}
        transition={running ? { repeat: Infinity, duration: 0.35, ease: 'linear' } : { duration: 0.3 }}
      />
    </div>
  );
}

/** Drifting mine dust — depth, at almost no cost. */
function MineDust({ running }: { running: boolean }) {
  const motes = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 0.5, size: 1 + (i % 3) })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-amber-200/25"
          style={{ left: `${m.left}%`, width: m.size, height: m.size }}
          animate={{ y: ['110%', '-10%'], opacity: [0, 0.7, 0] }}
          transition={{ repeat: Infinity, duration: running ? 4 : 7, delay: m.delay, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

function Paytable({ cfg }: { cfg: SlotConfig }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">Ways pay</span>
        <span className="text-[0.6rem] text-slate-600">3 / 4 / 5 from the left</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {SYMBOLS.filter((s) => s.id <= 6).slice().reverse().map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <MineSymbol sym={s.id} size={20} />
            <span className="font-mono text-[0.6rem] text-slate-400">
              {(cfg.pays[s.id][0] * cfg.payScale).toFixed(2)} / {(cfg.pays[s.id][2] * cfg.payScale).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 space-y-1 border-t border-white/[0.05] pt-2 text-[0.62rem] text-slate-400">
        <div className="flex items-center gap-1.5">
          <MineSymbol sym={WAGON} size={20} />
          <span>{cfg.trigger}+ wagons start the Express Run — {cfg.startRespins} respins, reset by every new wagon</span>
        </div>
        <p><b className="text-cyan-300">Loco</b> sweeps every value aboard into itself. <b className="text-emerald-300">Payer</b> gives its value to every wagon. <b className="text-orange-300">Dynamite</b> multiplies the haul.</p>
        <p>Fill all {BERTHS} berths for a {(cfg.grand * cfg.payScale).toFixed(0)}× grand haul. Max win {MAX_WIN}×.</p>
      </div>
    </div>
  );
}

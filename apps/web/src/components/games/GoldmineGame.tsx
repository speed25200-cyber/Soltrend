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
import { Cabinet } from './goldmine/ReelMachine';
import { ExpressReels, reelPlan } from './goldmine/ExpressReels';
import { ExpressSymbol, TRAIN_HEX } from './goldmine/ExpressSymbols';
import {
  CART_CAPACITY, JACKPOTS, MAX_WIN, SYMBOLS,
  playRound, slotFromParams,
  type Carriage, type GXSpin, type RoundResult, type SlotConfig,
} from '@/lib/slots/gold-express';
import type { GameConfig } from './types';

type Phase = 'idle' | 'spinning' | 'base' | 'collect' | 'train' | 'free' | 'done';

/**
 * GOLD MINE EXPRESS — the modern online game, rebuilt for Soltrend: 5×4 reels,
 * 20 fixed paylines, Gold Mines collected by the Bell and the Golden Train,
 * coloured trains that run the Train Bonus, dynamite Free Games, and the mine
 * cart that drops what it gathered back onto the reels. RTP 97%, like the
 * reference game.
 */
export function GoldmineGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params, maxBet, demo }: GameConfig) {
  const cfg: SlotConfig = useMemo(() => slotFromParams(params), [params]);
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);
  const recordBest = useCasino((s) => s.recordBest);

  const [bet, setBet] = useState(0.1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState<RoundResult | null>(null);
  const [view, setView] = useState<GXSpin | null>(null); // the spin on the reels
  const [spinKey, setSpinKey] = useState(0);
  const [plan, setPlan] = useState(() => reelPlan(null));
  const [cart, setCart] = useState(0);
  const [cartDropLive, setCartDropLive] = useState(false);
  const [freeIdx, setFreeIdx] = useState(0);
  const [fsBank, setFsBank] = useState(0);
  const [trainStep, setTrainStep] = useState(0);
  const [trainBank, setTrainBank] = useState(0);
  const [reelsMoving, setReelsMoving] = useState(false);
  const [fsBanner, setFsBanner] = useState(false);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms) as unknown as number);
  };

  const g = guard(bet);
  const base = round?.spins[0] ?? null;
  const bonus = base?.trainBonus ?? null;

  const finish = (r: RoundResult) => {
    setPhase('done');
    if (r.total > 0) {
      sfx.win(r.total);
      burstWin(r.total, { colors: ['#fcd34d', '#fb923c', '#ffffff'] });
    } else {
      sfx.loss();
    }
    busy.current = false;
  };

  /** Free games, replayed one spin at a time with the fast braking schedule. */
  const runFreeSpin = (r: RoundResult, i: number) => {
    const spin = r.spins[i];
    setFreeIdx(i);
    setPhase('free');
    const p = reelPlan(spin, true);
    setPlan(p);
    setView(spin);
    setSpinKey((k) => k + 1);
    setReelsMoving(true);
    sfx.bet();
    after(p.total, () => setReelsMoving(false));
    after(p.total + 500, () => {
      setFsBank((b) => b + spin.total);
      if (spin.total > 0) sfx.tick(3);
      if (i + 1 < r.spins.length) runFreeSpin(r, i + 1);
      else finish(r);
    });
  };

  /** The Train Bonus, carriage by carriage. */
  const runTrain = (r: RoundResult) => {
    const tb = r.spins[0].trainBonus!;
    setPhase('train');
    setTrainStep(0);
    setTrainBank(tb.collect); // the multiplier applies to the whole haul, collect included
    sfx.jackpot();
    const stepThrough = (i: number) => {
      if (i >= tb.carriages.length) {
        after(1400, () => {
          if (r.freeGames > 0) startFreeGames(r);
          else finish(r);
        });
        return;
      }
      setTrainStep(i + 1);
      const c = tb.carriages[i];
      if (c.jackpot) {
        sfx.jackpot();
        burstWin(12, { colors: ['#fcd34d', TRAIN_HEX[tb.color].glow] });
      } else if (c.multiplier > 1) {
        sfx.win(c.multiplier * 2);
      } else {
        sfx.tick(i + 2);
      }
      if (c.jackpot) setTrainBank((b) => b + c.award);
      else if (c.multiplier > 1) setTrainBank((b) => b * c.multiplier);
      else setTrainBank((b) => b + c.award);
      after(820, () => stepThrough(i + 1));
    };
    after(900, () => stepThrough(0));
  };

  const spin = () => {
    if (busy.current || !g.ok) return;
    busy.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // A full mine cart tips over onto this spin.
    const drop = cart >= CART_CAPACITY;
    setCartDropLive(drop);
    if (drop) setCart(0);

    const seeds = reserveSeeds();
    const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
    const r = playRound(() => stream.next(), cfg, { cartDrop: drop ? 1 : 0 });

    const p = reelPlan(r.spins[0]);
    setRound(r);
    setView(r.spins[0]);
    setPlan(p);
    setSpinKey((k) => k + 1);
    setFsBank(0);
    setFreeIdx(0);
    setPhase('spinning');
    setReelsMoving(true);
    sfx.bet();
    if (drop) sfx.jackpot();

    // Settle now — the seed decided this round, not the replay.
    settle(
      {
        game: gameName ?? meta.name,
        template: 'slots',
        bet,
        multiplier: r.total,
        payout: round2(bet * r.total),
        win: r.total > 0,
        meta: {
          lines: r.spins[0].linesTotal,
          collect: r.spins[0].collect?.total ?? 0,
          train: r.spins[0].trainBonus?.total ?? 0,
          freeGames: r.freeGames,
          cartDrop: drop,
        },
        seeds,
      },
      { quiet: true },
    );
    if (gameId) bumpUgc(gameId, bet);
    if (r.total > 0) recordBest(gameId ?? meta.slug, r.total);

    // The mine cart gathers whatever gold was never collected.
    setCart((c) => Math.min(CART_CAPACITY * 1.6, (drop ? 0 : c) + r.spins.reduce((s, x) => s + x.cartFeed, 0)));

    after(p.total, () => {
      setReelsMoving(false);
      setPhase('base');
      const b0 = r.spins[0];
      if (b0.linesTotal > 0) sfx.tick(b0.lineWins.length);
      after(b0.linesTotal > 0 ? 1100 : 500, () => {
        if (b0.collect) {
          setPhase('collect');
          sfx.cashout();
          after(1300, () => {
            if (b0.trainBonus) runTrain(r);
            else if (r.freeGames > 0) startFreeGames(r);
            else finish(r);
          });
        } else if (r.freeGames > 0) {
          startFreeGames(r);
        } else {
          finish(r);
        }
      });
    });
  };

  const startFreeGames = (r: RoundResult) => {
    setFsBanner(true);
    after(1400, () => setFsBanner(false));
    runFreeSpin(r, 1);
  };

  const cartPct = Math.min(100, (cart / CART_CAPACITY) * 100);
  const showWins = phase === 'base' || phase === 'collect' || phase === 'done' || phase === 'train';
  const collecting = phase === 'collect' || phase === 'train';

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative h-full min-h-[460px] overflow-hidden rounded-2xl sm:min-h-[520px]">
          {/* the shaft — canyon rock, lantern glow, drifting dust */}
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#33200c_0%,#120b06_55%,#05060f_100%)]" />
          <MineDust running={phase === 'train' || phase === 'free'} />

          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2.5 p-3 pb-4">
            {/* jackpots */}
            <div className="flex gap-1.5 sm:gap-2">
              {JACKPOTS.map((j) => (
                <span
                  key={j.tier}
                  className="rounded-lg border px-2 py-0.5 font-mono text-[0.58rem] font-black uppercase tracking-wider sm:text-[0.66rem]"
                  style={{
                    color: TRAIN_HEX[j.color].glow,
                    borderColor: `${TRAIN_HEX[j.color].a}55`,
                    background: `${TRAIN_HEX[j.color].b}33`,
                    textShadow: `0 0 10px ${TRAIN_HEX[j.color].glow}`,
                  }}
                >
                  {j.tier} {(j.value * cfg.payScale).toFixed(0)}×
                </span>
              ))}
            </div>

            {/* the mine cart meter */}
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between text-[0.6rem] font-bold uppercase tracking-wider text-amber-200/70">
                <span>Mine cart</span>
                <span>{cart >= CART_CAPACITY ? 'FULL — drops next spin' : `${cart.toFixed(1)} / ${CART_CAPACITY}`}</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full border border-amber-900/60 bg-black/50">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg,#b45309,#fcd34d)', boxShadow: '0 0 12px rgba(252,211,77,0.6)' }}
                  animate={{ width: `${cartPct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
            </div>

            {/* the machine */}
            <Cabinet title="Gold Mine Express" lit={showWins && (view?.total ?? 0) > 0} spinning={phase === 'spinning'}>
              <ExpressReels
                spin={view}
                plan={plan}
                spinning={reelsMoving}
                spinKey={spinKey}
                free={phase === 'free'}
                showWins={showWins && phase !== 'train'}
                collected={collecting}
              />
            </Cabinet>

            {/* readout */}
            <div className="flex min-h-[2rem] flex-wrap items-center justify-center gap-2">
              {phase === 'collect' && base?.collect && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-xl border border-gold/50 bg-gold/15 px-4 py-1.5 font-mono text-lg font-black text-gold"
                  style={{ textShadow: '0 0 18px rgba(255,210,95,0.7)' }}
                >
                  {base.collect.kind === 'gtrain' ? `GOLDEN TRAIN ×${base.collect.multiplier} · ` : 'BELL COLLECTS · '}
                  {base.collect.total.toFixed(2)}×
                </motion.span>
              )}
              {phase === 'free' && (
                <>
                  <span className="rounded-xl border border-red-400/50 bg-red-500/10 px-3 py-1 font-mono text-sm font-black text-red-300">
                    FREE GAME {freeIdx}/{round?.freeGames}
                  </span>
                  <motion.span key={fsBank} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-mono text-xl font-black text-white">
                    {fsBank.toFixed(2)}×
                  </motion.span>
                </>
              )}
              {phase === 'base' && base && base.linesTotal > 0 && !base.collect && (
                <motion.span key={base.linesTotal} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="font-mono text-xl font-black text-white">
                  {base.linesTotal.toFixed(2)}×
                </motion.span>
              )}
            </div>
          </div>

          {/* banners */}
          <AnimatePresence>
            {cartDropLive && phase === 'spinning' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 top-1/3 z-20 flex justify-center"
              >
                <span className="rounded-2xl border border-amber-400/60 bg-void-950/90 px-6 py-3 font-display text-2xl font-black uppercase tracking-widest text-amber-300 backdrop-blur">
                  Cart drop!
                </span>
              </motion.div>
            )}
            {fsBanner && phase === 'free' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 top-1/3 z-20 flex justify-center"
              >
                <span className="rounded-2xl border border-red-400/60 bg-void-950/90 px-6 py-3 font-display text-2xl font-black uppercase tracking-widest text-red-300 backdrop-blur">
                  {round?.freeGames} Free Games
                </span>
              </motion.div>
            )}
            {phase === 'done' && round && round.total > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 bottom-3 z-20 flex justify-center"
              >
                <span className="rounded-2xl border border-gold/40 bg-void-950/85 px-5 py-2 font-display text-xl font-black text-gold backdrop-blur">
                  {round.total.toFixed(2)}× · ◎{(bet * round.total).toFixed(4)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* the Train Bonus */}
          <AnimatePresence>
            {phase === 'train' && bonus && (
              <TrainOverlay
                color={bonus.color}
                carriages={bonus.carriages}
                step={trainStep}
                bank={trainBank}
                collect={bonus.collect}
              />
            )}
          </AnimatePresence>
        </div>
      }
      controls={
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-void-900/50 p-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/15 text-gold"><Icon name="gem" size={16} /></span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Gold Mine Express</div>
              <div className="text-[0.68rem] text-slate-500">5×4 · 20 lines · RTP 97% · max {MAX_WIN}×</div>
            </div>
          </div>

          <BetAmount value={bet} onChange={setBet} disabled={phase !== 'idle' && phase !== 'done'} />
          <BetButton guard={g} onClick={spin} busy={phase !== 'idle' && phase !== 'done'}>
            Spin ◎{bet}
          </BetButton>

          <Paytable />
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------- train bonus */

function TrainOverlay({
  color, carriages, step, bank, collect,
}: {
  color: keyof typeof TRAIN_HEX;
  carriages: Carriage[];
  step: number;
  bank: number;
  collect: number;
}) {
  const hex = TRAIN_HEX[color];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-void-950/85 p-4 backdrop-blur-md"
    >
      <div className="text-center">
        <div className="font-display text-2xl font-black uppercase tracking-[0.25em]" style={{ color: hex.glow, textShadow: `0 0 24px ${hex.glow}` }}>
          {color} Train Bonus
        </div>
        <div className="mt-1 font-mono text-sm text-amber-200">
          collected {collect.toFixed(2)}× aboard
        </div>
      </div>

      {/* the train */}
      <div className="flex w-full max-w-2xl items-end justify-start gap-1.5 overflow-hidden px-2">
        <motion.div
          animate={{ y: [0, -2, 0] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className="shrink-0"
        >
          <ExpressSymbol sym={12} size={54} trainColor={color} />
        </motion.div>
        {carriages.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 40, scale: 0.7 }}
            animate={i < step ? { opacity: 1, x: 0, scale: 1 } : {}}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border sm:h-[4.5rem] sm:w-[4.5rem]"
            style={{
              borderColor: `${hex.a}66`,
              background: `linear-gradient(160deg, ${hex.b}cc, #0c0a09)`,
              boxShadow: i < step ? `0 0 22px -6px ${hex.a}` : 'none',
            }}
          >
            {i < step && (
              <div className="text-center">
                {c.jackpot ? (
                  <>
                    <div className="text-[0.5rem] font-black uppercase tracking-wider" style={{ color: hex.glow }}>{c.jackpot.tier}</div>
                    <div className="font-mono text-sm font-black text-white">{c.award.toFixed(0)}×</div>
                  </>
                ) : c.multiplier > 1 ? (
                  <div className="font-mono text-lg font-black text-white">×{c.multiplier}</div>
                ) : (
                  <div className="font-mono text-sm font-black text-amber-200">+{c.award.toFixed(2)}</div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* rail */}
      <div className="relative h-2 w-full max-w-2xl overflow-hidden rounded-full border-y border-white/10 bg-black/50">
        <motion.div
          className="absolute inset-0"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg,#78350f 0 6px,transparent 6px 22px)' }}
          animate={{ x: [0, -22] }}
          transition={{ repeat: Infinity, duration: 0.3, ease: 'linear' }}
        />
      </div>

      <motion.div
        key={bank}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        className="font-mono text-4xl font-black text-white"
        style={{ textShadow: `0 0 30px ${hex.glow}` }}
      >
        {bank.toFixed(2)}×
      </motion.div>
    </motion.div>
  );
}

/* ----------------------------------------------------------------- pieces */

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

function Paytable() {
  const lows = SYMBOLS.slice(0, 5);
  const highs = SYMBOLS.slice(5, 10);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">20 fixed lines</span>
        <span className="text-[0.6rem] text-slate-600">3 / 4 / 5 from the left</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {[...highs, ...lows].map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <ExpressSymbol sym={s.id} size={20} />
            <span className="font-mono text-[0.6rem] text-slate-400">
              {s.pays[0]} / {s.pays[1]} / {s.pays[2]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 space-y-1 border-t border-white/[0.05] pt-2 text-[0.62rem] leading-relaxed text-slate-400">
        <p>
          <b className="text-amber-300">Gold Mines</b> hold cash on reels 1–4. The <b className="text-amber-300">Bell</b> collects
          it all; the <b className="text-amber-300">Golden Train</b> collects with a multiplier. Both land on reel 5.
        </p>
        <p>
          <b className="text-emerald-300">Coloured trains</b> + a collector run the <b className="text-white">Train Bonus</b> — every
          carriage pays, the last can drop a multiplier or the colour&apos;s jackpot.
        </p>
        <p>
          <b className="text-red-300">Dynamite</b> on reels 1, 3 and 5 triggers 8 Free Games. Uncollected gold fills
          the <b className="text-amber-300">mine cart</b> — full cart drops back onto the reels.
        </p>
      </div>
    </div>
  );
}

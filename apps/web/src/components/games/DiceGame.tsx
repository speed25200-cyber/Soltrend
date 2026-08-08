'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { AutoBet } from './AutoBet';
import { ModeTabs } from './ModeTabs';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { playDice, diceMultiplier, DEFAULT_EDGE } from '@/lib/games';
import { fmtMult } from '@/lib/format';
import type { GameConfig } from './types';

// Ambience only — the readout stays DOM-crisp on top of it.
const CrystalScene3D = dynamic(() => import('./CrystalScene3D'), { ssr: false, loading: () => null });

export function DiceGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params , maxBet, demo}: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [target, setTarget] = useState((params?.target as number) ?? 50);
  const [over, setOver] = useState(((params?.over ?? 1) as number) === 1);
  const [roll, setRoll] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const winChance = over ? 100 - target : target;
  const mult = diceMultiplier(target, over, edge);
  const g = guard(bet);

  const playRound = (amount: number, quiet: boolean) => {
    const seeds = reserveSeeds();
    const res = playDice(amount, target, over, seeds, edge);
    setRoll(res.roll);
    setLastWin(res.win);
    settle(
      {
        game: gameName ?? meta.name,
        template: 'dice',
        bet: amount,
        multiplier: res.multiplier,
        payout: res.payout,
        win: res.win,
        meta: { roll: res.roll, target, over },
        seeds,
      },
      { quiet },
    );
    if (gameId) bumpUgc(gameId, amount);
    return { win: res.win, payout: res.payout };
  };

  const doBet = () => {
    setBusy(true);
    setRolling(true);
    // The tumble is theatre — the outcome is settled instantly by the seed.
    timers.current.push(window.setTimeout(() => {
      playRound(bet, false);
      setRolling(false);
      setBusy(false);
    }, 620));
  };

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative flex h-full flex-col justify-center overflow-hidden">
          {/* the oracle crystal tumbles behind the number while the roll is live */}
          <div className="pointer-events-none absolute inset-0">
            <CrystalScene3D spin={rolling} verdict={roll === null ? null : lastWin ? 'win' : 'loss'} />
          </div>
          {/* Result number */}
          <div className="relative z-10 mb-8 text-center">
            {rolling ? (
              <Scramble />
            ) : roll === null ? (
              // Before the first roll there is no number — "00.00" reads like a
              // broken result, so show an explicit resting state instead.
              <div>
                <div className="font-mono text-6xl font-bold tabular-nums text-slate-800">--.--</div>
                <div className="mt-2 text-[0.65rem] uppercase tracking-[0.3em] text-slate-600">Set your target, then roll</div>
              </div>
            ) : (
              <motion.div
                key={roll + '' + (lastWin ? 'w' : 'l')}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className={`font-display text-6xl font-bold ${lastWin ? 'text-win' : 'text-loss'}`}
                style={{ textShadow: lastWin ? '0 0 40px rgba(16,245,160,0.6)' : '0 0 40px rgba(255,59,107,0.5)' }}
              >
                {roll.toFixed(2)}
              </motion.div>
            )}
          </div>

          {/* Track — a glass gauge with tick marks and a glowing read-head */}
          <div className="relative z-10 mx-auto w-full max-w-xl">
            <div
              className="relative h-4 overflow-visible rounded-full border border-white/[0.08]"
              style={{ background: 'linear-gradient(180deg,#10142c,#080a18)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7)' }}
            >
              <div
                className="absolute inset-y-[3px] left-[3px] rounded-full"
                style={{
                  width: `calc(${target}% - 6px)`,
                  background: over ? 'rgba(255,59,107,0.18)' : 'linear-gradient(90deg,#10f5a0cc,#059669cc)',
                  boxShadow: over ? 'none' : '0 0 14px rgba(16,245,160,0.35)',
                }}
              />
              <div
                className="absolute inset-y-[3px] right-[3px] rounded-full"
                style={{
                  width: `calc(${100 - target}% - 6px)`,
                  background: over ? 'linear-gradient(90deg,#10f5a0cc,#059669cc)' : 'rgba(255,59,107,0.18)',
                  boxShadow: over ? '0 0 14px rgba(16,245,160,0.35)' : 'none',
                }}
              />
              {/* tick marks */}
              {Array.from({ length: 21 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white/20"
                  style={{ left: `${i * 5}%`, width: 1, height: i % 5 === 0 ? 10 : 5 }}
                />
              ))}
              {/* threshold needle */}
              <div
                className="absolute -top-1.5 h-7 w-[3px] -translate-x-1/2 rounded-full bg-white"
                style={{ left: `${target}%`, boxShadow: '0 0 10px rgba(255,255,255,0.7)' }}
              />
              {/* roll marker */}
              {roll !== null && !rolling && (
                <motion.div
                  className="absolute -top-2.5 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-lg border-2 border-white"
                  initial={{ left: '50%', scale: 0.6 }}
                  animate={{ left: `${roll}%`, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                  style={{
                    background: 'linear-gradient(180deg,#1c2044,#0d1024)',
                    boxShadow: lastWin ? '0 0 20px #10f5a0' : '0 0 20px #ff3b6b',
                  }}
                >
                  <span className={`h-2 w-2 rounded-full ${lastWin ? 'bg-win' : 'bg-loss'}`} />
                </motion.div>
              )}
            </div>
            {/* threshold slider */}
            <input
              type="range"
              min={2}
              max={98}
              step={1}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value))}
              className="mt-5 w-full accent-neon-violet"
            />
            <div className="mt-1 flex justify-between font-mono text-xs text-slate-600">
              <span>0</span>
              <span className="text-slate-400">Threshold {target}</span>
              <span>100</span>
            </div>
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <ModeTabs mode={mode} setMode={setMode} />

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Multiplier" value={fmtMult(mult)} />
            <Stat label="Win chance" value={`${winChance.toFixed(0)}%`} />
          </div>

          <div className="flex gap-1 rounded-xl bg-void-900/80 p-1">
            {[
              { k: false, label: `Under ${target}` },
              { k: true, label: `Over ${target}` },
            ].map((o) => (
              <button
                key={String(o.k)}
                onClick={() => setOver(o.k)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  over === o.k ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {mode === 'manual' ? (
            <>
              <BetAmount value={bet} onChange={setBet} disabled={busy} />
              <div className="rounded-xl border border-white/[0.06] bg-void-900/50 px-4 py-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payout on win</span>
                  <span className="font-mono font-semibold text-win">◎ {(bet * mult).toFixed(4)}</span>
                </div>
              </div>
              <BetButton guard={g} onClick={doBet} busy={busy}>
                Bet {bet > 0 ? `◎${bet}` : ''}
              </BetButton>
            </>
          ) : (
            <AutoBet baseBet={bet} setBaseBet={setBet} guard={guard} playRound={playRound} />
          )}
        </div>
      }
    />
  );
}

/** Rapidly cycling digits while the die is "in the air". */
function Scramble() {
  const [text, setText] = useState('00.00');
  useEffect(() => {
    const t = setInterval(() => setText((Math.random() * 100).toFixed(2)), 50);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ repeat: Infinity, duration: 0.28 }}
      className="font-display text-6xl font-bold text-slate-400 tabular-nums"
      style={{ textShadow: '0 0 30px rgba(168,85,247,0.5)' }}
    >
      {text}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className="font-mono text-lg font-bold text-white">{value}</div>
    </div>
  );
}

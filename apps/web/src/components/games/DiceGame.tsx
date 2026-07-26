'use client';

import { useState } from 'react';
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

export function DiceGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params , maxBet, demo}: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [target, setTarget] = useState((params?.target as number) ?? 50);
  const [over, setOver] = useState(((params?.over ?? 1) as number) === 1);
  const [roll, setRoll] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

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
    playRound(bet, false);
    setBusy(false);
  };

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="flex h-full flex-col justify-center">
          {/* Result number */}
          <div className="mb-10 text-center">
            {roll === null ? (
              <div className="font-display text-6xl font-bold text-slate-700">00.00</div>
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

          {/* Track */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="relative h-3 overflow-hidden rounded-full bg-void-900">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${target}%`,
                  background: over ? '#ff3b6b33' : 'linear-gradient(90deg,#10f5a0,#059669)',
                }}
              />
              <div
                className="absolute inset-y-0 right-0 rounded-full"
                style={{
                  width: `${100 - target}%`,
                  background: over ? 'linear-gradient(90deg,#10f5a0,#059669)' : '#ff3b6b33',
                }}
              />
            </div>
            {/* roll marker */}
            {roll !== null && (
              <motion.div
                className="absolute -top-2 h-7 w-7 -translate-x-1/2 rounded-lg border-2 border-white bg-void-800"
                initial={{ left: '50%' }}
                animate={{ left: `${roll}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                style={{ boxShadow: lastWin ? '0 0 16px #10f5a0' : '0 0 16px #ff3b6b' }}
              />
            )}
            {/* threshold slider */}
            <input
              type="range"
              min={2}
              max={98}
              step={1}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value))}
              className="mt-4 w-full accent-neon-violet"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className="font-mono text-lg font-bold text-white">{value}</div>
    </div>
  );
}

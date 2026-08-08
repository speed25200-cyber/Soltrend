'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { SceneLoader } from './SceneLoader';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { AutoBet } from './AutoBet';
import { ModeTabs } from './ModeTabs';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { playCoinflip, clampEdge, DEFAULT_EDGE } from '@/lib/games';
import { fmtMult } from '@/lib/format';
import { Icon } from '@/components/Icon';
import type { GameConfig } from './types';

// The WebGL coin — leaps, tumbles, lands on the seed's answer.
const CoinflipScene3D = dynamic(() => import('./CoinflipScene3D'), {
  ssr: false,
  loading: () => <SceneLoader label="Minting the coin…" />,
});

export function CoinflipGame({ meta, edge = DEFAULT_EDGE, gameId, gameName , maxBet, demo}: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay(maxBet, demo);
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [pickHeads, setPickHeads] = useState(true);
  const [spinKey, setSpinKey] = useState(0);
  const [flipHeads, setFlipHeads] = useState<boolean | null>(null);
  const [heads, setHeads] = useState<boolean | null>(null);
  const [win, setWin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  const mult = 2 * (1 - clampEdge(edge));
  const g = guard(bet);

  const settleFlip = (amount: number, res: ReturnType<typeof playCoinflip>, seeds: any, quiet: boolean) => {
    setHeads(res.heads);
    setWin(res.win);
    settle(
      {
        game: gameName ?? meta.name,
        template: 'coinflip',
        bet: amount,
        multiplier: res.multiplier,
        payout: res.payout,
        win: res.win,
        meta: { heads: res.heads, pickHeads },
        seeds,
      },
      { quiet },
    );
    if (gameId) bumpUgc(gameId, amount);
  };

  // Auto mode: no 1.1s coin animation wait — resolve immediately, quietly.
  const playRound = (amount: number, quiet: boolean) => {
    const seeds = reserveSeeds();
    const res = playCoinflip(amount, pickHeads, seeds, edge);
    setFlipHeads(res.heads);
    setSpinKey((k) => k + 1);
    settleFlip(amount, res, seeds, quiet);
    return { win: res.win, payout: res.payout };
  };

  const doBet = async () => {
    setBusy(true);
    setWin(null);
    const seeds = reserveSeeds();
    const res = playCoinflip(bet, pickHeads, seeds, edge);
    setFlipHeads(res.heads);
    setSpinKey((k) => k + 1);
    setTimeout(() => {
      settleFlip(bet, res, seeds, false);
      setBusy(false);
    }, 1100);
  };

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative flex h-full min-h-[380px] flex-col overflow-hidden rounded-2xl">
          <div className="absolute inset-0">
            <CoinflipScene3D spinKey={spinKey} resultHeads={flipHeads} win={busy ? null : win} />
          </div>
          <div className="relative z-10 mt-auto pb-4 text-center font-semibold">
            {win === true && (
              <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-win" style={{ textShadow: '0 0 18px rgba(16,245,160,0.6)' }}>
                {heads ? 'Heads' : 'Tails'} — you win!
              </motion.span>
            )}
            {win === false && (
              <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-loss">
                {heads ? 'Heads' : 'Tails'} — not this time.
              </motion.span>
            )}
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <ModeTabs mode={mode} setMode={setMode} />
          <div className="flex gap-1 rounded-xl bg-void-900/80 p-1">
            {[
              { k: true, label: 'Heads', e: 'moon' as const },
              { k: false, label: 'Tails', e: 'bolt' as const },
            ].map((o) => (
              <button
                key={String(o.k)}
                onClick={() => setPickHeads(o.k)}
                disabled={busy}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
                  pickHeads === o.k ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon name={o.e} size={15} /> {o.label}
              </button>
            ))}
          </div>

          {mode === 'manual' ? (
            <>
              <BetAmount value={bet} onChange={setBet} disabled={busy} />
              <div className="rounded-xl border border-white/[0.06] bg-void-900/50 px-4 py-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payout ({fmtMult(mult)})</span>
                  <span className="font-mono font-semibold text-win">◎ {(bet * mult).toFixed(4)}</span>
                </div>
              </div>
              <BetButton guard={g} onClick={doBet} busy={busy}>
                Flip ◎{bet}
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


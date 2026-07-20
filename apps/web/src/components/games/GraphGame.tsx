'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { AutoBet } from './AutoBet';
import { ModeTabs } from './ModeTabs';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { round2, DEFAULT_EDGE } from '@/lib/games';
import { floatStream } from '@/lib/provably-fair';
import { runGraph, type ForgeGraph } from '@/lib/forge/model';
import { fmtMult } from '@/lib/format';
import type { GameConfig } from './types';

/** Runtime for a node-graph ("Forge") game — same interpreter as the editor. */
export function GraphGame({ meta, gameId, gameName, params }: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay();
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const graph = useMemo<ForgeGraph | null>(() => {
    try {
      const raw = params?.graph;
      return raw ? (JSON.parse(String(raw)) as ForgeGraph) : null;
    } catch {
      return null;
    }
  }, [params]);

  const [bet, setBet] = useState(0.1);
  const [mult, setMult] = useState<number | null>(null);
  const [win, setWin] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  const playRound = (amount: number, quiet: boolean) => {
    if (!graph) return { win: false, payout: 0 };
    const seeds = reserveSeeds();
    const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
    const m = round2(runGraph(graph, () => stream.next()));
    const didWin = m >= 1;
    const payout = didWin ? round2(amount * m) : 0;
    setMult(m);
    setWin(didWin);
    settle(
      {
        game: gameName ?? meta.name,
        template: 'graph',
        bet: amount,
        multiplier: m,
        payout,
        win: didWin,
        meta: { mult: m },
        seeds,
      },
      { quiet },
    );
    if (gameId) bumpUgc(gameId, amount);
    return { win: didWin, payout };
  };

  const g = guard(bet);

  if (!graph) {
    return (
      <div className="glass p-16 text-center text-slate-400">This forge game is missing its graph.</div>
    );
  }

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="grid h-full place-items-center">
          <div className="text-center">
            <motion.div
              key={mult ?? 'idle'}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              className={`font-display text-7xl font-bold tabular-nums md:text-8xl ${
                win === null ? 'text-slate-400' : win ? 'text-win' : 'text-loss'
              }`}
              style={{ textShadow: win ? '0 0 50px rgba(16,245,160,0.55)' : win === false ? '0 0 50px rgba(255,59,107,0.45)' : 'none' }}
            >
              {mult === null ? '—' : fmtMult(mult)}
            </motion.div>
            <div className="mt-2 h-6 font-semibold">
              {win === true && <span className="text-win">Custom game paid {fmtMult(mult!)}</span>}
              {win === false && <span className="text-loss">No win this round</span>}
            </div>
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <ModeTabs mode={mode} setMode={setMode} />
          {mode === 'manual' ? (
            <>
              <BetAmount value={bet} onChange={setBet} />
              <BetButton guard={g} onClick={() => playRound(bet, false)}>
                Play ◎{bet}
              </BetButton>
            </>
          ) : (
            <AutoBet baseBet={bet} setBaseBet={setBet} guard={guard} playRound={playRound} />
          )}
          <p className="text-center text-[0.68rem] text-slate-600">Built in the node Forge · provably fair</p>
        </div>
      }
    />
  );
}

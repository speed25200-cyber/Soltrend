'use client';

import { useMemo, useRef, useState } from 'react';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { AutoBet } from './AutoBet';
import { ModeTabs } from './ModeTabs';
import { SceneStage } from '@/components/scenes/SceneStage';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { round2 } from '@/lib/games';
import { floatStream } from '@/lib/provably-fair';
import { runGraph, type ForgeGraph } from '@/lib/forge/model';
import { paletteFromSeed, type PresentationId } from '@/lib/presentation';
import { ACCENT_HEX } from '@/lib/catalog';
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
  const [rolling, setRolling] = useState(false);
  const [round, setRound] = useState(0);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const revealTimer = useRef<number>();

  const presentation: PresentationId = (meta.presentation as PresentationId) || 'pulse';
  const accentHex = ACCENT_HEX[(meta.accent as keyof typeof ACCENT_HEX)] ?? '#a855f7';
  const palette = useMemo(() => paletteFromSeed(meta.seedKey || meta.name, accentHex), [meta.seedKey, meta.name, accentHex]);

  const commit = (amount: number, m: number, didWin: boolean, payout: number, seeds: any, quiet: boolean) => {
    setMult(m);
    setWin(didWin);
    setRound((r) => r + 1);
    settle(
      { game: gameName ?? meta.name, template: 'graph', bet: amount, multiplier: m, payout, win: didWin, meta: { mult: m }, seeds },
      { quiet },
    );
    if (gameId) bumpUgc(gameId, amount);
  };

  const playRound = (amount: number, quiet: boolean) => {
    if (!graph) return { win: false, payout: 0 };
    const seeds = reserveSeeds();
    const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
    const m = round2(runGraph(graph, () => stream.next()));
    const didWin = m >= 1;
    const payout = didWin ? round2(amount * m) : 0;
    if (quiet) {
      commit(amount, m, didWin, payout, seeds, true);
    } else {
      // Suspense reveal for the scene.
      window.clearTimeout(revealTimer.current);
      setRolling(true);
      setWin(null);
      revealTimer.current = window.setTimeout(() => {
        setRolling(false);
        commit(amount, m, didWin, payout, seeds, false);
      }, 650);
    }
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
      stage={<SceneStage presentation={presentation} mult={mult} win={win} rolling={rolling} palette={palette} round={round} />}
      controls={
        <div className="space-y-4">
          <ModeTabs mode={mode} setMode={setMode} />
          {mode === 'manual' ? (
            <>
              <BetAmount value={bet} onChange={setBet} disabled={rolling} />
              <BetButton guard={g} onClick={() => playRound(bet, false)} busy={rolling}>
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

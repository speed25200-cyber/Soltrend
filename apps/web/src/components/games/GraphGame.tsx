'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { AutoBet } from './AutoBet';
import { ModeTabs } from './ModeTabs';
import { SceneStage } from '@/components/scenes/SceneStage';
import { SceneBackground } from '@/components/scenes/SceneBackground';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { round2 } from '@/lib/games';
import { floatStream } from '@/lib/provably-fair';
import { runGraph, type ForgeGraph } from '@/lib/forge/model';
import { paletteFromSeed, type PresentationId, type BackgroundId } from '@/lib/presentation';
import { ACCENT_HEX } from '@/lib/catalog';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import type { GameConfig } from './types';

/** Runtime for a node-graph ("Forge") game — same interpreter as the editor. */
export function GraphGame({ meta, gameId, gameName, params, maxBet }: GameConfig) {
  const { guard: rawGuard, reserveSeeds, settle } = usePlay();
  // Bankroll cap (enforced on-chain; mirrored here so the UI blocks over-cap bets).
  const guard = (b: number) => (maxBet != null && b > maxBet ? { ok: false, reason: `Max bet ◎${maxBet} — this game's bankroll cap` } : rawGuard(b));
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
  const background: BackgroundId = (meta.background as BackgroundId) || 'none';
  const soundPack = meta.soundPack || 'arcade';
  const winEffect = meta.winEffect || 'confetti';
  const accentHex = ACCENT_HEX[(meta.accent as keyof typeof ACCENT_HEX)] ?? '#a855f7';
  const palette = useMemo(() => paletteFromSeed(meta.seedKey || meta.name, accentHex), [meta.seedKey, meta.name, accentHex]);

  const commit = (amount: number, m: number, didWin: boolean, payout: number, seeds: any, quiet: boolean) => {
    setMult(m);
    setWin(didWin);
    setRound((r) => r + 1);
    // Settle silently — the graph game plays its OWN themed sound + win effect.
    settle(
      { game: gameName ?? meta.name, template: 'graph', bet: amount, multiplier: m, payout, win: didWin, meta: { mult: m }, seeds },
      { quiet: true },
    );
    if (gameId) bumpUgc(gameId, amount);
    if (!quiet) {
      if (didWin) {
        sfx.packWin(soundPack, m);
        burstWin(m, { style: winEffect, colors: [palette.primary, palette.secondary, '#ffffff'] });
      } else {
        sfx.packLoss(soundPack);
      }
    }
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
      stage={
        <div className="relative h-full min-h-[300px]">
          <SceneBackground background={background} palette={palette} />
          <div className="relative z-10 h-full">
            <SceneStage presentation={presentation} mult={mult} win={win} rolling={rolling} palette={palette} round={round} />
          </div>
        </div>
      }
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
          {gameId ? (
            <Link href={`/forge?remix=${gameId}`} className="btn-ghost w-full !py-2 text-xs">
              Remix this game in the Forge
            </Link>
          ) : (
            <p className="text-center text-[0.68rem] text-slate-600">Built in the node Forge · provably fair</p>
          )}
        </div>
      }
    />
  );
}

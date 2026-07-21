'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { SceneBackground } from '@/components/scenes/SceneBackground';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { round2, DEFAULT_EDGE } from '@/lib/games';
import { Icon } from '@/components/Icon';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import { paletteFromSeed, type BackgroundId } from '@/lib/presentation';
import { ACCENT_HEX } from '@/lib/catalog';
import {
  specFromParams, boardLayout, boardMultiplier, safeCount, cellCount,
  BOARD_SKINS,
} from '@/lib/forge/board';
import type { GameConfig } from './types';

type Phase = 'idle' | 'playing' | 'busted' | 'cashed';

/** Interactive runtime for an Arcade board game — reveal, bank, walk away. */
export function BoardGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params }: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay();
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const spec = useMemo(() => specFromParams(params), [params]);
  const skin = BOARD_SKINS[spec.skin];
  const N = cellCount(spec);
  const safe = safeCount(spec);
  const background: BackgroundId = (meta.background as BackgroundId) || 'none';
  const accentHex = ACCENT_HEX[(meta.accent as keyof typeof ACCENT_HEX)] ?? skin.gem;
  const palette = useMemo(() => paletteFromSeed(meta.seedKey || meta.name, accentHex), [meta.seedKey, meta.name, accentHex]);
  const soundPack = meta.soundPack || 'arcade';
  const winEffect = meta.winEffect || 'confetti';

  const [bet, setBet] = useState(0.1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [bombSet, setBombSet] = useState<Set<number>>(new Set());
  const [seeds, setSeeds] = useState<ReturnType<typeof reserveSeeds> | null>(null);
  const [lastHit, setLastHit] = useState<number | null>(null);
  const shake = useAnimationControls();

  const picks = revealed.size;
  const curMult = picks > 0 ? boardMultiplier(spec, picks, edge) : 1;
  const nextMult = boardMultiplier(spec, Math.min(picks + 1, safe), edge);
  // Heat: 0..1 tension that scales the board glow + cash-out urgency.
  const heat = Math.min(1, Math.log10(Math.max(1, curMult)) / 2);
  const g = guard(bet);

  const start = () => {
    const s = reserveSeeds();
    setSeeds(s);
    setBombSet(boardLayout(spec, s));
    setRevealed(new Set());
    setLastHit(null);
    setPhase('playing');
  };

  const reveal = (i: number) => {
    if (phase !== 'playing' || revealed.has(i) || !seeds) return;
    if (bombSet.has(i)) {
      setLastHit(i);
      setPhase('busted');
      sfx.packLoss(soundPack);
      shake.start({ x: [0, -12, 11, -8, 6, -3, 0], transition: { duration: 0.5 } });
      settle(
        { game: gameName ?? meta.name, template: 'board', bet, multiplier: 0, payout: 0, win: false, meta: { picks, hit: i }, seeds },
        { quiet: true },
      );
      if (gameId) bumpUgc(gameId, bet);
      setTimeout(() => setPhase((p) => (p === 'busted' ? 'idle' : p)), 2200);
      return;
    }
    const next = new Set(revealed).add(i);
    setRevealed(next);
    // rising pitch as the ladder climbs
    sfx.tick(next.size);
    if (next.size === safe) cashOut(next.size);
  };

  const cashOut = (override?: number) => {
    if (phase !== 'playing' || !seeds) return;
    const p = override ?? picks;
    if (p === 0) return;
    const m = boardMultiplier(spec, p, edge);
    setPhase('cashed');
    settle(
      { game: gameName ?? meta.name, template: 'board', bet, multiplier: m, payout: round2(bet * m), win: true, meta: { picks: p }, seeds },
      { quiet: true },
    );
    sfx.packWin(soundPack, m);
    burstWin(m, { style: winEffect, colors: [skin.gem, skin.gemGlow, '#ffffff'] });
    if (gameId) bumpUgc(gameId, bet);
    setTimeout(() => setPhase((ph) => (ph === 'cashed' ? 'idle' : ph)), 2400);
  };

  const showBomb = (i: number) => (phase === 'busted' || phase === 'cashed') && bombSet.has(i);
  const cell = 'clamp(38px, 12vw, 62px)';

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative grid h-full min-h-[320px] place-items-center overflow-hidden">
          <SceneBackground background={background} palette={palette} />
          {/* reactive heat halo */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-500"
            style={{ background: `radial-gradient(circle at 50% 55%, ${skin.gemGlow}${Math.round(heat * 60).toString(16).padStart(2, '0')}, transparent 60%)` }}
          />
          <motion.div animate={shake} className="relative z-10 flex flex-col items-center gap-4">
            {/* running multiplier */}
            <div className="text-center">
              <motion.div
                key={picks}
                initial={{ scale: 0.8, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-mono text-4xl font-black tracking-tight md:text-5xl"
                style={{ color: phase === 'busted' ? '#ff3b6b' : skin.gemGlow, textShadow: `0 0 ${18 + heat * 30}px ${skin.gem}` }}
              >
                {phase === 'busted' ? 'BUST' : `${curMult.toFixed(2)}×`}
              </motion.div>
              <div className="mt-0.5 text-[0.7rem] uppercase tracking-[0.3em] text-slate-400">
                {phase === 'playing' && picks > 0 ? `Banking ◎${(bet * curMult).toFixed(3)}` : phase === 'playing' ? 'Pick a tile' : `${safe} safe · ${spec.bombs} hazards`}
              </div>
            </div>

            {/* the board */}
            <div
              className="grid gap-1.5 md:gap-2"
              style={{ gridTemplateColumns: `repeat(${spec.cols}, ${cell})` }}
            >
              {Array.from({ length: N }, (_, i) => {
                const isRevealed = revealed.has(i);
                const isBomb = showBomb(i);
                const hit = lastHit === i;
                const open = isRevealed || isBomb;
                return (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.9 }}
                    disabled={phase !== 'playing' || isRevealed}
                    onClick={() => reveal(i)}
                    className="relative grid place-items-center rounded-xl border"
                    style={{
                      width: cell, height: cell,
                      borderColor: hit ? skin.bomb : isBomb ? `${skin.bomb}55` : isRevealed ? `${skin.gem}66` : 'rgba(255,255,255,0.08)',
                      background: open
                        ? isBomb
                          ? `radial-gradient(circle, ${skin.bomb}33, ${skin.bomb}11)`
                          : `radial-gradient(circle, ${skin.gem}2e, ${skin.gem}0d)`
                        : `linear-gradient(160deg, ${skin.tile[0]}, ${skin.tile[1]})`,
                      boxShadow: hit
                        ? `0 0 26px -4px ${skin.bomb}`
                        : isRevealed
                          ? `0 0 20px -6px ${skin.gem}, inset 0 0 12px -6px ${skin.gemGlow}`
                          : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                  >
                    <AnimatePresence>
                      {isBomb ? (
                        <motion.span key="b" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} style={{ color: skin.bomb }}>
                          <Icon name={skin.bombIcon} size={24} />
                        </motion.span>
                      ) : isRevealed ? (
                        <motion.span
                          key="g"
                          initial={{ scale: 0, rotateY: spec.fx === 'flip' ? -90 : 0, opacity: 0 }}
                          animate={{ scale: spec.fx === 'shatter' ? [1.4, 1] : 1, rotateY: 0, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                          style={{ color: skin.gem, filter: `drop-shadow(0 0 6px ${skin.gemGlow})` }}
                        >
                          <Icon name={skin.gemIcon} size={24} />
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                    {/* bloom pop on reveal */}
                    {isRevealed && spec.fx === 'bloom' && (
                      <motion.span
                        className="pointer-events-none absolute inset-0 rounded-xl"
                        initial={{ opacity: 0.7, scale: 0.6 }}
                        animate={{ opacity: 0, scale: 1.8 }}
                        transition={{ duration: 0.6 }}
                        style={{ border: `2px solid ${skin.gemGlow}` }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-void-900/50 p-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${skin.gem}22`, color: skin.gem }}>
              <Icon name={skin.icon} size={16} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{skin.label}</div>
              <div className="text-[0.68rem] text-slate-500">{spec.rows}×{spec.cols} board · {spec.bombs} hazards</div>
            </div>
          </div>

          <BetAmount value={bet} onChange={setBet} disabled={phase === 'playing'} />

          <div className="grid grid-cols-2 gap-2">
            <Info label="Current" value={picks > 0 ? `${curMult.toFixed(2)}×` : '—'} color={skin.gem} />
            <Info label="Next tile" value={picks < safe && nextMult > curMult ? `${nextMult.toFixed(2)}×` : 'MAX'} color={skin.gemGlow} accent />
          </div>

          {phase === 'playing' ? (
            <button
              className="mt-2 w-full rounded-2xl px-4 py-3 font-bold text-black transition-all disabled:opacity-40"
              disabled={picks === 0}
              style={{
                background: picks === 0 ? '#334155' : `linear-gradient(120deg, ${skin.gem}, ${skin.gemGlow})`,
                boxShadow: picks === 0 ? undefined : `0 0 ${16 + heat * 34}px -4px ${skin.gem}`,
                color: picks === 0 ? '#94a3b8' : '#04121a',
              }}
              onClick={() => cashOut()}
            >
              {picks === 0 ? 'Reveal a tile to begin' : `Cash out ◎${(bet * curMult).toFixed(4)}`}
            </button>
          ) : (
            <BetButton guard={g} onClick={start} busy={phase === 'busted' || phase === 'cashed'}>
              Start ◎{bet}
            </BetButton>
          )}

          {gameId ? (
            <Link href={`/arcade?remix=${gameId}`} className="btn-ghost w-full !py-2 text-xs">
              Remix this board in the Arcade
            </Link>
          ) : (
            <p className="text-center text-[0.68rem] text-slate-600">Built in the Arcade · provably fair</p>
          )}
        </div>
      }
    />
  );
}

function Info({ label, value, color, accent }: { label: string; value: string; color: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className="font-mono text-lg font-bold" style={{ color: accent ? color : '#fff' }}>{value}</div>
    </div>
  );
}

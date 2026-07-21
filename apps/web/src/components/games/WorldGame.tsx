'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
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
import { boardLayout, boardMultiplier, safeCount, cellCount, BOARD_SKINS } from '@/lib/forge/board';
import { worldFromParams, runLogicBonus } from '@/lib/forge/world';
import type { GameConfig } from './types';

const World3D = dynamic(() => import('@/components/worlds/World3D'), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[340px] place-items-center text-sm text-slate-500">Loading 3D world…</div>,
});

type Phase = 'idle' | 'playing' | 'busted' | 'cashed';

/** Runtime for a 3D "World" — spatial board (body) + optional logic core (brain). */
export function WorldGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params }: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay();
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const spec = useMemo(() => worldFromParams(params), [params]);
  const board = spec.board;
  const skin = BOARD_SKINS[board.skin];
  const safe = safeCount(board);
  const soundPack = meta.soundPack || 'crystal';
  const winEffect = meta.winEffect || 'coins';

  const [bet, setBet] = useState(0.1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [bombSet, setBombSet] = useState<Set<number>>(new Set());
  const [seeds, setSeeds] = useState<ReturnType<typeof reserveSeeds> | null>(null);
  const [hitIndex, setHitIndex] = useState<number | null>(null);
  const [bonus, setBonus] = useState<number | null>(null);

  const picks = revealed.size;
  const curMult = picks > 0 ? boardMultiplier(board, picks, edge) : 1;
  const nextMult = boardMultiplier(board, Math.min(picks + 1, safe), edge);
  const heat = Math.min(1, Math.log10(Math.max(1, curMult)) / 2);
  const g = guard(bet);

  const start = () => {
    const s = reserveSeeds();
    setSeeds(s);
    setBombSet(boardLayout(board, s));
    setRevealed(new Set());
    setHitIndex(null);
    setBonus(null);
    setPhase('playing');
  };

  const reveal = (i: number) => {
    if (phase !== 'playing' || revealed.has(i) || !seeds) return;
    if (bombSet.has(i)) {
      setHitIndex(i);
      setPhase('busted');
      sfx.packLoss(soundPack);
      settle({ game: gameName ?? meta.name, template: 'board', bet, multiplier: 0, payout: 0, win: false, meta: { picks, hit: i }, seeds }, { quiet: true });
      if (gameId) bumpUgc(gameId, bet);
      setTimeout(() => setPhase((p) => (p === 'busted' ? 'idle' : p)), 2400);
      return;
    }
    const next = new Set(revealed).add(i);
    setRevealed(next);
    sfx.tick(next.size);
    if (next.size === safe) cashOut(next.size);
  };

  const cashOut = (override?: number) => {
    if (phase !== 'playing' || !seeds) return;
    const p = override ?? picks;
    if (p === 0) return;
    let m = boardMultiplier(board, p, edge);
    // Logic core: an edge-neutral bonus multiplier drawn from a separate channel.
    if (spec.logic) {
      const bs = floatStream(seeds.serverSeed, `${seeds.clientSeed}:logic`, seeds.nonce);
      const b = round2(runLogicBonus(spec, () => bs.next()));
      setBonus(b);
      m = round2(m * b);
    } else {
      setBonus(null);
    }
    setPhase('cashed');
    settle({ game: gameName ?? meta.name, template: 'board', bet, multiplier: m, payout: round2(bet * m), win: true, meta: { picks: p, bonus }, seeds }, { quiet: true });
    sfx.packWin(soundPack, m);
    burstWin(m, { style: winEffect, colors: [skin.gem, skin.gemGlow, '#ffffff'] });
    if (gameId) bumpUgc(gameId, bet);
    setTimeout(() => setPhase((ph) => (ph === 'cashed' ? 'idle' : ph)), 2800);
  };

  const showBombs = phase === 'busted' || phase === 'cashed';

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="relative h-full min-h-[340px] overflow-hidden rounded-2xl">
          <World3D
            spec={spec}
            revealed={revealed}
            bombSet={bombSet}
            showBombs={showBombs}
            playing={phase === 'playing'}
            hitIndex={hitIndex}
            onReveal={reveal}
            heat={heat}
          />
          {/* HUD overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <div className="rounded-xl border border-white/10 bg-void-950/70 px-3 py-2 backdrop-blur">
              <div className="font-mono text-2xl font-black" style={{ color: phase === 'busted' ? '#ff3b6b' : skin.gemGlow, textShadow: `0 0 ${14 + heat * 26}px ${skin.gem}` }}>
                {phase === 'busted' ? 'BUST' : `${curMult.toFixed(2)}×`}
              </div>
              <div className="text-[0.62rem] uppercase tracking-[0.25em] text-slate-400">
                {phase === 'playing' && picks > 0 ? `◎${(bet * curMult).toFixed(3)}` : phase === 'cashed' && bonus ? `logic bonus ×${bonus}` : `${safe} safe · ${board.bombs} hazards`}
              </div>
            </div>
            {spec.logic && (
              <div className="rounded-xl border border-white/10 bg-void-950/70 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.2em] text-slate-300"><Icon name="orbit" size={12} /> Logic core</div>
              </div>
            )}
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-void-900/50 p-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${skin.gem}22`, color: skin.gem }}><Icon name={skin.icon} size={16} /></span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{skin.label}{spec.logic ? ' + logic' : ''}</div>
              <div className="text-[0.68rem] text-slate-500">{board.rows}×{board.cols} · {board.bombs} hazards · 3D</div>
            </div>
          </div>

          <BetAmount value={bet} onChange={setBet} disabled={phase === 'playing'} />

          <div className="grid grid-cols-2 gap-2">
            <Info label="Current" value={picks > 0 ? `${curMult.toFixed(2)}×` : '—'} color={skin.gem} />
            <Info label="Next tile" value={picks < safe && nextMult > curMult ? `${nextMult.toFixed(2)}×` : 'MAX'} color={skin.gemGlow} accent />
          </div>

          {phase === 'playing' ? (
            <button
              className="mt-2 w-full rounded-2xl px-4 py-3 font-bold transition-all disabled:opacity-40"
              disabled={picks === 0}
              style={{ background: picks === 0 ? '#334155' : `linear-gradient(120deg, ${skin.gem}, ${skin.gemGlow})`, boxShadow: picks === 0 ? undefined : `0 0 ${16 + heat * 34}px -4px ${skin.gem}`, color: picks === 0 ? '#94a3b8' : '#04121a' }}
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
            <Link href={`/worlds?remix=${gameId}`} className="btn-ghost w-full !py-2 text-xs">Remix this world</Link>
          ) : (
            <p className="text-center text-[0.68rem] text-slate-600">Built in Soltrend Worlds · provably fair · drag to orbit</p>
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

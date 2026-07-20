'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { playCoinflip, clampEdge, DEFAULT_EDGE } from '@/lib/games';
import { fmtMult } from '@/lib/format';
import { Icon } from '@/components/Icon';
import type { GameConfig } from './types';

export function CoinflipGame({ meta, edge = DEFAULT_EDGE, gameId, gameName }: GameConfig) {
  const { guard, reserveSeeds, settle } = usePlay();
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [pickHeads, setPickHeads] = useState(true);
  const [spin, setSpin] = useState(0);
  const [heads, setHeads] = useState<boolean | null>(null);
  const [win, setWin] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const mult = 2 * (1 - clampEdge(edge));
  const g = guard(bet);

  const doBet = async () => {
    setBusy(true);
    const seeds = reserveSeeds();
    const res = playCoinflip(bet, pickHeads, seeds, edge);
    // Land on the right face: even multiples of 180 → heads up.
    const base = spin - (spin % 360);
    const target = base + 360 * 5 + (res.heads ? 0 : 180);
    setSpin(target);
    setTimeout(() => {
      setHeads(res.heads);
      setWin(res.win);
      settle({
        game: gameName ?? meta.name,
        template: 'coinflip',
        bet,
        multiplier: res.multiplier,
        payout: res.payout,
        win: res.win,
        meta: { heads: res.heads, pickHeads },
        seeds,
      });
      if (gameId) bumpUgc(gameId, bet);
      setBusy(false);
    }, 1100);
  };

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="grid h-full place-items-center gap-6">
          <div style={{ perspective: 800 }}>
            <motion.div
              className="relative h-40 w-40"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: spin }}
              transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <CoinFace side="H" />
              <CoinFace side="T" back />
            </motion.div>
          </div>
          <div className="h-6 font-semibold">
            {win === true && <span className="text-win">{heads ? 'Heads' : 'Tails'} — you win!</span>}
            {win === false && <span className="text-loss">{heads ? 'Heads' : 'Tails'} — not this time.</span>}
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
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
        </div>
      }
    />
  );
}

function CoinFace({ side, back }: { side: 'H' | 'T'; back?: boolean }) {
  return (
    <div
      className="absolute inset-0 grid place-items-center rounded-full text-void-950"
      style={{
        backfaceVisibility: 'hidden',
        transform: back ? 'rotateY(180deg)' : undefined,
        background:
          side === 'H'
            ? 'radial-gradient(circle at 35% 30%, #fde68a, #f59e0b)'
            : 'radial-gradient(circle at 35% 30%, #c4b5fd, #a855f7)',
        boxShadow: '0 12px 40px -8px rgba(0,0,0,0.7), inset 0 0 0 6px rgba(255,255,255,0.25)',
      }}
    >
      <Icon name={side === 'H' ? 'moon' : 'bolt'} size={56} strokeWidth={1.6} />
    </div>
  );
}

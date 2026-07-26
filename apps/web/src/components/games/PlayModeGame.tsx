'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { GameScreen } from './GameScreen';
import { DemoBar } from './DemoBar';
import { Icon } from '@/components/Icon';
import { sfx } from '@/lib/sound';
import type { GameConfig } from './types';

/**
 * A game with a demo / real switch above it.
 *
 * Every game on Soltrend can be played for pretend credits before a single
 * lamport is staked — same engine, same seed chain, same edge, no ledger. It
 * starts in demo for a visitor with no wallet, because asking someone to
 * connect a wallet before they know whether they like the game is the wrong way
 * round; the moment a wallet is connected the switch flips to real, unless the
 * player has already chosen for themselves.
 */
export function PlayModeGame({ config, crashVariant }: { config: GameConfig; crashVariant?: boolean }) {
  const { connected } = useWallet();
  const [demo, setDemo] = useState(true);
  const chosen = useRef(false);

  useEffect(() => {
    if (!chosen.current && connected) setDemo(false);
  }, [connected]);

  const pick = (next: boolean) => {
    chosen.current = true;
    setDemo(next);
    sfx.click();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-white/[0.07] bg-void-900/60 p-0.5">
          <Tab active={demo} onClick={() => pick(true)} tone="cyan">
            <Icon name="spark" size={12} /> Demo credits
          </Tab>
          <Tab active={!demo} onClick={() => pick(false)} tone="violet">
            <Icon name="coin" size={12} /> Real ◎
          </Tab>
        </div>
        {!demo && !connected && (
          <span className="text-[0.68rem] text-slate-500">Connect your wallet to bet for real.</span>
        )}
        {demo && (
          <span className="text-[0.68rem] text-slate-500">Free play — nothing is staked.</span>
        )}
      </div>

      {demo && <DemoBar compact theoreticalRtp={config.edge != null ? 1 - config.edge : undefined} />}

      <GameScreen config={{ ...config, demo }} crashVariant={crashVariant} />
    </div>
  );
}

function Tab({
  active, onClick, tone, children,
}: { active: boolean; onClick: () => void; tone: 'cyan' | 'violet'; children: React.ReactNode }) {
  const on = tone === 'cyan'
    ? 'bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/40'
    : 'bg-neon-violet/20 text-white ring-1 ring-neon-violet/40';
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold transition ${
        active ? on : 'text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

'use client';

import { Icon } from '@/components/Icon';

/** The demo / real switch row. Pair with `usePlayMode` for the decision. */
export function PlayModeToggle({
  demo, connected, onPick,
}: { demo: boolean; connected: boolean; onPick: (demo: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl border border-white/[0.07] bg-void-900/60 p-0.5">
        <Tab active={demo} onClick={() => onPick(true)} tone="cyan">
          <Icon name="spark" size={12} /> Demo credits
        </Tab>
        <Tab active={!demo} onClick={() => onPick(false)} tone="violet">
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

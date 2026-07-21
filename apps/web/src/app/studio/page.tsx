'use client';

import { useEffect, useState } from 'react';
import { SectionHead } from '@/components/SectionHead';
import { Icon, type IconName } from '@/components/Icon';
import { WorldBuilder } from '@/components/create/WorldBuilder';
import { NodeBuilder } from '@/components/create/NodeBuilder';
import { sfx } from '@/lib/sound';

type Mode = 'world' | 'node';

/**
 * The single creation surface — 3D World and Node game builders merged behind one
 * switch. Deep-linkable via ?mode=world|node (&remix=<id>); the old /worlds,
 * /forge and /arcade routes redirect here.
 */
export default function StudioPage() {
  const [mode, setMode] = useState<Mode>('world');

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    if (m === 'node' || m === 'world') setMode(m);
  }, []);

  const pick = (m: Mode) => {
    setMode(m);
    sfx.click();
    // keep the URL shareable without a reload
    const url = new URL(window.location.href);
    url.searchParams.set('mode', m);
    window.history.replaceState({}, '', url);
  };

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="Create"
        title="Build a game"
        sub="Design a 3D world or wire a node mechanic — provably fair, vault-safe, published to the community in a tap."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === 'world'}
          onClick={() => pick('world')}
          icon="gem"
          title="3D World"
          blurb="A playable 3D board players reveal in space, with decor + an optional logic core."
          accent="#22d3ee"
        />
        <ModeCard
          active={mode === 'node'}
          onClick={() => pick('node')}
          icon="orbit"
          title="Node game"
          blurb="Generate a game from a feeling, or wire your own mechanic node-by-node."
          accent="#a855f7"
        />
      </div>

      {mode === 'world' ? <WorldBuilder /> : <NodeBuilder />}
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, blurb, accent }: { active: boolean; onClick: () => void; icon: IconName; title: string; blurb: string; accent: string }) {
  return (
    <button
      onClick={onClick}
      className="glass glass-hover flex items-center gap-3 p-4 text-left transition"
      style={active ? { borderColor: `${accent}88`, boxShadow: `0 0 0 1px ${accent}55, 0 10px 30px -14px ${accent}` } : undefined}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}1a`, color: accent }}>
        <Icon name={icon} size={20} />
      </span>
      <div className="flex-1">
        <div className="font-display text-sm font-bold text-white">{title}{active && <span className="ml-2 text-[0.62rem] font-bold" style={{ color: accent }}>● building</span>}</div>
        <div className="text-xs text-slate-500">{blurb}</div>
      </div>
    </button>
  );
}

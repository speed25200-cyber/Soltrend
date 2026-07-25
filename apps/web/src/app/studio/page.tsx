'use client';

import { useEffect, useState } from 'react';
import { SectionHead } from '@/components/SectionHead';
import { Icon, type IconName } from '@/components/Icon';
import { WorldBuilder } from '@/components/create/WorldBuilder';
import { NodeBuilder } from '@/components/create/NodeBuilder';
import { SpriteEditor } from '@/components/create/SpriteEditor';
import { ClassicsBuilder } from '@/components/create/ClassicsBuilder';
import { sfx } from '@/lib/sound';

type Mode = 'world' | 'node' | 'classic' | 'art';

/**
 * The single creation surface — 3D World and Node game builders merged behind one
 * switch. Deep-linkable via ?mode=world|node (&remix=<id>); the old /worlds,
 * /forge and /arcade routes redirect here.
 */
export default function StudioPage() {
  const [mode, setMode] = useState<Mode>('world');
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    if (m === 'node' || m === 'world' || m === 'art' || m === 'classic') setMode(m);
    try {
      setShowTip(!window.localStorage.getItem('soltrend-studio-tip'));
    } catch {
      /* ignore */
    }
  }, []);

  const dismissTip = () => {
    setShowTip(false);
    try {
      window.localStorage.setItem('soltrend-studio-tip', '1');
    } catch {
      /* ignore */
    }
  };

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
        eyebrow="Create · Studio"
        title="Build a game"
        sub="Design a 3D world, wire a node mechanic or reskin a classic — provably fair, vault-safe, published in a tap. Draw your own symbols in the Symbols tab."
      />

      {showTip && (
        <div className="glass relative flex flex-col gap-2 p-4 text-sm">
          <button onClick={dismissTip} className="absolute right-3 top-3 text-slate-500 hover:text-white" aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
          <p className="font-display font-bold text-white">New here? Pick a mode:</p>
          <ul className="grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
            <li><b className="text-slate-200">3D World</b> — a spatial board players reveal, with decor + optional logic.</li>
            <li><b className="text-slate-200">Node game</b> — invent a mechanic from a prompt, a feeling, or node-by-node.</li>
            <li><b className="text-slate-200">Classic</b> — reskin + retune the Towers climb, then ship it.</li>
            <li><b className="text-slate-200">Symbols</b> — draw pixel art for slot/scratch games (an asset tool, not a game).</li>
          </ul>
          <p className="text-xs text-slate-500">Every builder autosaves a draft. Published a game? Manage it and claim royalties under <span className="text-neon-violet">My games</span>.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <ModeCard
          active={mode === 'classic'}
          onClick={() => pick('classic')}
          icon="target"
          title="Classic"
          blurb="Reskin the Towers dungeon-climb — pick a difficulty and a look, then ship it."
          accent="#10f5a0"
        />
        <ModeCard
          active={mode === 'art'}
          onClick={() => pick('art')}
          icon="star"
          title="Symbols"
          blurb="Draw your own pixel symbols — then use them in your slot and scratch games."
          accent="#ffd25f"
        />
      </div>

      {mode === 'world' ? <WorldBuilder /> : mode === 'node' ? <NodeBuilder /> : mode === 'classic' ? <ClassicsBuilder /> : <SpriteEditor />}
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

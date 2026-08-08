'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { WorldBuilder } from '@/components/create/WorldBuilder';
import { NodeBuilder } from '@/components/create/NodeBuilder';
import { SpriteEditor } from '@/components/create/SpriteEditor';
import { ClassicsBuilder } from '@/components/create/ClassicsBuilder';
import { SlotBuilder } from '@/components/create/SlotBuilder';
import { GAME_KINDS, EFFORT_LABEL, kindById, type GameKind, type KindId } from '@/lib/studio/kinds';
import { sfx } from '@/lib/sound';

/**
 * The studio.
 *
 * It used to open on five cards named after our engines — "Node game", "3D
 * World", "Classic" — with a second mechanic menu hidden inside one of them and
 * a pixel-art editor filed alongside the game builders as if it were a game. A
 * creator had to understand our architecture before they could pick anything.
 *
 * Now there is one question: what do you want to make. Every game we can build
 * is in one flat list, described by how it plays, with an honest note on how
 * long it takes. Pick one and you go straight into building it — no second menu,
 * no vocabulary to learn. Art tools live under Tools, because they are not games.
 */
export default function StudioPage() {
  const [kind, setKind] = useState<KindId | null>(null);
  const [art, setArt] = useState(false);

  // Deep links: ?make=slot (and the older ?mode=) drop straight into a builder,
  // which is what remix/edit links rely on.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const make = q.get('make') ?? q.get('mode');
    if (make === 'art') { setArt(true); return; }
    const legacy: Record<string, KindId> = { world: 'board', node: 'node', classic: 'towers' };
    const id = (kindById(make ?? '')?.id ?? legacy[make ?? '']) as KindId | undefined;
    if (id) setKind(id);
  }, []);

  const pick = (id: KindId) => {
    setKind(id);
    setArt(false);
    sfx.click();
    const url = new URL(window.location.href);
    url.searchParams.set('make', id);
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url);
  };

  const reset = () => {
    setKind(null);
    setArt(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('make');
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url);
  };

  const active = kind ? kindById(kind) : null;

  /* ------------------------------------------------------- the chooser */
  if (!kind && !art) {
    return (
      <div className="space-y-6">
        <SectionHead
          eyebrow="Create · Studio"
          title="What do you want to make?"
          sub="Pick a game. Everything else — the odds, the payout table, the fairness proof — is handled for you and checked before it can go live."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_KINDS.map((k) => (
            <KindCard key={k.id} kind={k} onClick={() => pick(k.id)} />
          ))}
        </div>

        <div className="glass flex flex-wrap items-center gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-slate-300">
            <Icon name="pencil" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">Tools</div>
            <div className="text-xs text-slate-500">Draw your own pixel symbols to use in slot games. Not a game on its own.</div>
          </div>
          <button onClick={() => { setArt(true); sfx.click(); }} className="btn-ghost text-xs">Symbol editor</button>
        </div>

        <p className="text-center text-xs text-slate-600">
          Already published something? Manage it under <Link href="/studio/games" className="text-neon-violet">My games</Link>.
        </p>
      </div>
    );
  }

  /* -------------------------------------------------------- the builder */
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={reset} className="btn-ghost !py-2 text-xs">
          <Icon name="close" size={12} /> Change
        </button>
        {active && (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${active.accent}1a`, color: active.accent }}>
              <Icon name={active.icon} size={18} />
            </span>
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-white">Building a {active.name.toLowerCase()}</div>
              <div className="truncate text-xs text-slate-500">{active.plays}</div>
            </div>
          </div>
        )}
        {art && (
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-slate-300"><Icon name="pencil" size={18} /></span>
            <div>
              <div className="font-display text-sm font-bold text-white">Symbol editor</div>
              <div className="text-xs text-slate-500">Draw symbols, then pick them when you build a slot.</div>
            </div>
          </div>
        )}
      </div>

      {art ? (
        <SpriteEditor />
      ) : kind === 'slot' ? (
        <SlotBuilder />
      ) : kind === 'towers' ? (
        <ClassicsBuilder />
      ) : kind === 'node' ? (
        <NodeBuilder />
      ) : (
        <WorldBuilder mechanic={kind === 'ascent' ? 'ascent' : kind === 'nexus' ? 'nexus' : 'board'} />
      )}
    </div>
  );
}

function KindCard({ kind, onClick }: { kind: GameKind; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass glass-hover group relative overflow-hidden p-5 text-left transition"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-30 blur-2xl transition group-hover:opacity-60"
        style={{ background: kind.accent }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${kind.accent}1a`, color: kind.accent }}>
            <Icon name={kind.icon} size={22} />
          </span>
          <span className="chip !text-[0.58rem]">{EFFORT_LABEL[kind.effort]} · {kind.minutes}</span>
        </div>
        <h3 className="mt-3 font-display text-lg font-bold text-white">{kind.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">{kind.plays}</p>
        <p className="mt-2.5 text-[0.68rem] text-slate-500">
          <span className="text-slate-400">You choose:</span> {kind.youChoose}
        </p>
      </div>
    </button>
  );
}

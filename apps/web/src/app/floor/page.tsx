'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCasino } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { ACCENT_HEX } from '@/lib/catalog';
import { fmtCompact } from '@/lib/format';

/**
 * "The Floor" — a spatial discovery view. Community games float on a tilted 3D
 * plane you can pan; hovering lifts a game off the floor, clicking plays it.
 * Pure CSS 3D transforms (no WebGL), so it builds statically and stays light.
 */
export default function FloorPage() {
  const ugc = useCasino((s) => s.ugc);
  const [rot, setRot] = useState(52); // floor tilt
  const drag = useRef<{ x: number; startRot: number } | null>(null);

  // Lay games out on a grid, ordered by buzz (volume + recency), so the busiest
  // sit toward the front of the floor.
  const tiles = useMemo(() => {
    const now = Date.now();
    const scored = [...ugc]
      .map((g) => ({ g, buzz: g.volume + Math.max(0, 1 - (now - g.createdAt) / 6.048e8) * 500 }))
      .sort((a, b) => b.buzz - a.buzz);
    const perRow = 4;
    return scored.map(({ g }, i) => ({ g, col: i % perRow, row: Math.floor(i / perRow) }));
  }, [ugc]);

  const onDown = (e: React.PointerEvent) => (drag.current = { x: e.clientX, startRot: rot });
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const d = (e.clientX - drag.current.x) * 0.06;
    setRot(Math.max(38, Math.min(66, drag.current.startRot - d)));
  };
  const onUp = () => (drag.current = null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead eyebrow="Play · The Floor" title="Walk the floor" sub="A spatial view of the community's games — drag to pan, hover to lift, tap to play." />
        <Link href="/discover" className="btn-ghost mb-1">List view</Link>
      </div>

      {tiles.length === 0 ? (
        <div className="glass grid place-items-center p-16 text-center text-slate-500">No community games on the floor yet.</div>
      ) : (
        <div
          className="relative h-[560px] cursor-grab overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-void-950 to-void-900 active:cursor-grabbing"
          style={{ perspective: '1200px' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          {/* ambient glow */}
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-neon-violet/10 blur-3xl" />
          <div
            className="absolute left-1/2 top-[58%]"
            style={{ transform: `translate(-50%, -50%) rotateX(${rot}deg)`, transformStyle: 'preserve-3d' }}
          >
            {tiles.map(({ g, col, row }) => {
              const hex = ACCENT_HEX[(g.theme.accent as keyof typeof ACCENT_HEX)] ?? ACCENT_HEX.violet;
              const x = (col - 1.5) * 150;
              const y = row * 150 - 120;
              return <FloorTile key={g.id} g={g} hex={hex} x={x} y={y} counterRot={rot} />;
            })}
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg border border-white/10 bg-void-950/70 px-3 py-1 text-[0.62rem] uppercase tracking-[0.2em] text-slate-500 backdrop-blur">
            drag to pan the floor
          </div>
        </div>
      )}
    </div>
  );
}

function FloorTile({ g, hex, x, y, counterRot }: { g: any; hex: string; x: number; y: number; counterRot: number }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/play/ugc?id=${g.id}`}
      className="absolute block"
      style={{ left: x, top: y, transform: `translateZ(${hover ? 60 : 0}px)`, transition: 'transform 0.25s' }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      {/* stand the tile upright against the floor tilt */}
      <motion.div
        className="grid h-32 w-32 place-items-center rounded-2xl border p-3 text-center backdrop-blur"
        style={{
          transform: `rotateX(-${counterRot}deg)`,
          transformOrigin: 'bottom',
          borderColor: `${hex}55`,
          background: `linear-gradient(160deg, ${hex}22, rgba(10,12,20,0.85))`,
          boxShadow: hover ? `0 20px 50px -10px ${hex}` : `0 8px 24px -12px ${hex}`,
        }}
      >
        <div>
          <span style={{ color: hex }}><Icon name={g.theme.icon} size={30} strokeWidth={1.5} /></span>
          <div className="mt-1 line-clamp-1 font-display text-xs font-bold text-white">{g.name}</div>
          <div className="text-[0.6rem] text-slate-500">◎{fmtCompact(g.volume)}</div>
        </div>
      </motion.div>
      {/* floor shadow */}
      <div className="mx-auto mt-1 h-2 w-20 rounded-full" style={{ background: `${hex}44`, filter: 'blur(6px)' }} />
    </Link>
  );
}

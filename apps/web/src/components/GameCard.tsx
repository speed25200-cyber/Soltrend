'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { GameMeta, ACCENT_HEX } from '@/lib/catalog';
import { Icon } from './Icon';

export function GameCard({ meta, index = 0, wide = false }: { meta: GameMeta; index?: number; wide?: boolean }) {
  const hex = ACCENT_HEX[meta.accent];
  const card = useRef<HTMLDivElement>(null);

  // Pointer-tracked 3D tilt + spotlight. CSS custom properties carry the cursor
  // into the stylesheet; the transform is set directly so there is no re-render
  // per mousemove.
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = card.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 6}deg) rotateY(${(px - 0.5) * 8}deg) translateY(-4px)`;
  };
  const onLeave = () => {
    const el = card.current;
    if (el) el.style.transform = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 260, damping: 24 }}
      className={wide ? 'col-span-2' : undefined}
    >
      <Link href={`/play/${meta.slug}`} className="group block h-full">
        <div
          ref={card}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className={`glass glass-premium spot-card tilt glass-hover relative overflow-hidden p-4 ${wide ? 'h-full min-h-[15rem]' : 'aspect-[4/5]'}`}
          style={{ ['--hex' as string]: hex }}
        >
          {/* ambient glow */}
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-40 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
            style={{ background: hex }}
          />
          {meta.hot && (
            <span className="absolute right-3 top-3 z-10 chip !border-loss/40 !bg-loss/10 !text-loss">
              <Icon name="flame" size={12} /> Hot
            </span>
          )}

          <div className="relative flex h-full flex-col" style={{ transform: 'translateZ(28px)', transformStyle: 'preserve-3d' }}>
            <div className="flex-1 grid place-items-center">
              <span
                className="transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                style={{ color: hex, filter: `drop-shadow(0 8px 24px ${hex}88)` }}
              >
                <Icon name={meta.icon} size={wide ? 72 : 56} strokeWidth={1.5} />
              </span>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">{meta.name}</h3>
              <p className="text-xs text-slate-500">{meta.tagline}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="chip !text-[0.65rem]">Original</span>
                <span
                  className="ml-auto translate-x-2 text-sm font-bold opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                  style={{ color: hex }}
                >
                  Play →
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { GameMeta, ACCENT_HEX } from '@/lib/catalog';
import { Icon } from './Icon';

export function GameCard({ meta, index = 0 }: { meta: GameMeta; index?: number }) {
  const hex = ACCENT_HEX[meta.accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 260, damping: 24 }}
    >
      <Link href={`/play/${meta.slug}`} className="group block">
        <div
          className="glass glass-hover relative aspect-[4/5] overflow-hidden p-4"
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

          <div className="relative flex h-full flex-col">
            <div className="flex-1 grid place-items-center">
              <span
                className="transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                style={{ color: hex, filter: `drop-shadow(0 8px 24px ${hex}88)` }}
              >
                <Icon name={meta.icon} size={56} strokeWidth={1.5} />
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

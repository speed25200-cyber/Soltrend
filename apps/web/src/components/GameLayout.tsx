'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { FairnessBar } from './FairnessBar';
import { GameMeta, ACCENT_HEX } from '@/lib/catalog';
import { Icon } from './Icon';
import { auraCss } from '@/lib/auras';

/**
 * Standard game screen: a large "stage" (the play canvas) beside a control
 * column, with the fairness strip below. Mobile stacks canvas over controls.
 */
export function GameLayout({
  meta,
  stage,
  controls,
  footer,
}: {
  meta: GameMeta;
  stage: ReactNode;
  controls: ReactNode;
  footer?: ReactNode;
}) {
  const hex = ACCENT_HEX[meta.accent];
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="btn-ghost !p-2" aria-label="Back to lobby">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </Link>
        <span
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ color: hex, background: `radial-gradient(circle at 30% 30%, ${hex}33, ${hex}0a)`, boxShadow: `0 0 24px -8px ${hex}` }}
        >
          <Icon name={meta.icon} size={24} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{meta.name}</h1>
          <p className="text-sm text-slate-500">{meta.tagline}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Controls come first in DOM on mobile for thumb reach, but visually second on desktop */}
        <div className="order-2 lg:order-1">
          <div
            className="glass relative min-h-[380px] overflow-hidden p-5"
            style={{ boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.05), 0 0 60px -30px ${hex}` }}
          >
            {meta.aura && (
              <div className="pointer-events-none absolute inset-0" style={{ background: auraCss(meta.aura) }} />
            )}
            <div className="relative z-10 h-full">{stage}</div>
          </div>
          {footer}
        </div>
        <div className="order-1 lg:order-2">
          <div className="glass p-5">{controls}</div>
        </div>
      </div>

      <FairnessBar />
    </div>
  );
}

'use client';

import { ReactNode } from 'react';
import type { BetGuard } from '@/hooks/usePlay';

/**
 * The bet CTA. Surfaces the guard reason inline (disabled + helper text) so the
 * player always knows *why* they can't bet — never a dead button.
 */
export function BetButton({
  guard,
  onClick,
  busy,
  children,
  variant = 'primary',
}: {
  guard: BetGuard;
  onClick: () => void;
  busy?: boolean;
  children: ReactNode;
  variant?: 'primary' | 'win';
}) {
  return (
    <div className="mt-4">
      <button
        className={`w-full text-base ${variant === 'win' ? 'btn-primary btn-win' : 'btn-primary'}`}
        disabled={!guard.ok || busy}
        onClick={onClick}
      >
        {busy ? 'Settling…' : children}
      </button>
      {!guard.ok && guard.reason && (
        <p className="mt-2 text-center text-xs font-medium text-slate-500">{guard.reason}</p>
      )}
    </div>
  );
}

'use client';

/** Fire a win celebration (confetti + optional big-win shockwave). */
export function burstWin(mult: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('soltrend:win', { detail: { mult } }));
}

/** Fire a jackpot celebration. */
export function burstJackpot(amount: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('soltrend:jackpot', { detail: { amount } }));
}

'use client';

/** Fire a win celebration with an optional effect style + colours. */
export function burstWin(mult: number, opts?: { style?: string; colors?: string[] }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('soltrend:win', { detail: { mult, style: opts?.style, colors: opts?.colors } }));
}

/** Fire a jackpot celebration. */
export function burstJackpot(amount: number, colors?: string[]) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('soltrend:jackpot', { detail: { amount, colors } }));
}

export function fmtSol(n: number, dp = 4): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

export function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/**
 * A multiplier, for display.
 *
 * Engines return exact multipliers, because rounding one to two decimals moves
 * real money — enough to push a 1% game below its own minimum edge. Two decimals
 * are still the readable form, so this floors rather than rounds: the number on
 * screen is never larger than the number paid. A player may be paid a hair more
 * than they were quoted, never a hair less.
 */
export function fmtMult(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const floored = Math.floor(Math.abs(n) * 100) / 100;
  return `${(n < 0 ? -floored : floored).toFixed(2)}×`;
}

/** The full-precision multiplier, for surfaces that must be auditable — the
 *  fairness verifier and the bet record, where the exact figure is the point. */
export function fmtMultExact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const s = n.toFixed(6).replace(/(\.\d\d)(\d*?)0+$/, '$1$2');
  return `${s}×`;
}

export function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Approx SOL→USD for display flavour only (static demo rate). */
export const SOL_USD = 182;

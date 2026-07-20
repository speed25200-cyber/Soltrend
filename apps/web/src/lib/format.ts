export function fmtSol(n: number, dp = 4): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

export function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fmtMult(n: number): string {
  return `${n.toFixed(2)}×`;
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

/**
 * Monte-Carlo simulator for the Studio. Runs the *actual* provably-fair engine
 * thousands of times against a design, so a creator sees the true RTP, hit rate,
 * volatility and payout distribution before publishing — turning game design
 * into something measurable and honest rather than guesswork.
 */

import { createServerSeed } from './provably-fair';
import {
  playDice,
  playLimbo,
  playCoinflip,
  buildWheel,
  spinWheel,
  dropPlinko,
  minesLayout,
  minesMultiplier,
  clampEdge,
  plinkoPayouts,
  type Template,
} from './games';

export interface SimBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface SimResult {
  rounds: number;
  rtp: number;
  edge: number;
  hitRate: number;
  avgWinMult: number;
  maxMult: number;
  volatility: number; // std dev of returned multiplier
  volatilityLabel: 'Low' | 'Medium' | 'High' | 'Extreme';
  buckets: SimBucket[];
}

const BUCKET_DEFS: { label: string; min: number; max: number }[] = [
  { label: 'Loss', min: 0, max: 0.0001 },
  { label: '0–1×', min: 0.0001, max: 1 },
  { label: '1–2×', min: 1, max: 2 },
  { label: '2–5×', min: 2, max: 5 },
  { label: '5–10×', min: 5, max: 10 },
  { label: '10–50×', min: 10, max: 50 },
  { label: '50×+', min: 50, max: Infinity },
];

/** Returns the payout multiplier (0 on loss) for one round of a design. */
function roundMultiplier(
  template: Template,
  params: Record<string, any>,
  edge: number,
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
): number {
  switch (template) {
    case 'dice': {
      const r = playDice(1, params.target ?? 50, params.over ?? true, seeds, edge);
      return r.win ? r.multiplier : 0;
    }
    case 'limbo': {
      const r = playLimbo(1, params.target ?? 2, seeds, edge);
      return r.win ? r.multiplier : 0;
    }
    case 'coinflip': {
      const r = playCoinflip(1, true, seeds, edge);
      return r.win ? r.multiplier : 0;
    }
    case 'wheel': {
      const segs = buildWheel(params.risk ?? 'medium', 30, edge);
      return spinWheel(segs, seeds).multiplier;
    }
    case 'plinko': {
      const rows = [8, 12, 16].includes(params.rows) ? params.rows : 12;
      const { bucket } = dropPlinko(rows, seeds);
      return plinkoPayouts((params.risk ?? 'medium') as 'low' | 'medium' | 'high', rows, edge)[bucket] ?? 1;
    }
    case 'mines': {
      const grid = params.grid ?? 25;
      const bombs = params.bombs ?? 3;
      const picks = Math.max(1, Math.min(grid - bombs, params.picks ?? 3));
      const layout = minesLayout(grid, bombs, seeds);
      // Reveal `picks` distinct tiles in a fixed scan order; bomb → loss.
      for (let i = 0, revealed = 0; i < grid && revealed < picks; i++) {
        if (layout.has(i)) return 0;
        revealed++;
      }
      return minesMultiplier(grid, bombs, picks, edge);
    }
    default:
      return 0;
  }
}

export function simulate(
  template: Template,
  params: Record<string, any>,
  edge: number,
  rounds = 5000,
): SimResult {
  const serverSeed = createServerSeed().serverSeed;
  const clientSeed = 'studio-sim';
  const buckets = BUCKET_DEFS.map((b) => ({ ...b, count: 0 }));

  let totalPayout = 0;
  let wins = 0;
  let winMultSum = 0;
  let maxMult = 0;
  let sum = 0;
  let sumSq = 0;

  for (let n = 1; n <= rounds; n++) {
    const m = roundMultiplier(template, params, edge, { serverSeed, clientSeed, nonce: n });
    totalPayout += m;
    sum += m;
    sumSq += m * m;
    if (m >= 1) {
      wins++;
      winMultSum += m;
    }
    if (m > maxMult) maxMult = m;
    for (const b of buckets) {
      if (m >= b.min && m < b.max) {
        b.count++;
        break;
      }
    }
  }

  const mean = sum / rounds;
  const variance = Math.max(0, sumSq / rounds - mean * mean);
  const volatility = Math.sqrt(variance);
  const rtp = totalPayout / rounds;

  return {
    rounds,
    rtp,
    edge: 1 - rtp,
    hitRate: wins / rounds,
    avgWinMult: wins ? winMultSum / wins : 0,
    maxMult,
    volatility,
    volatilityLabel: volatility < 1.5 ? 'Low' : volatility < 4 ? 'Medium' : volatility < 12 ? 'High' : 'Extreme',
    buckets,
  };
}

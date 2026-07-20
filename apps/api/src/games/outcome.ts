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
  round2,
  PLINKO_PAYOUTS,
  type Template,
} from '@soltrend/shared';
import type { SeedSnapshot } from '../common/session.store';

export interface Outcome {
  multiplier: number;
  payout: number;
  win: boolean;
  detail: Record<string, unknown>;
}

/**
 * Server-authoritative outcome for a single instant bet. Pure function of
 * (template, params, edge, bet, seeds) → identical to what the client derives
 * and to what the on-chain `settle_bet` would settle. Interactive games (Mines)
 * pass the player's chosen tiles so the whole round is reproducible.
 */
export function computeOutcome(
  template: Template,
  params: Record<string, any>,
  edge: number,
  bet: number,
  seeds: SeedSnapshot,
): Outcome {
  const s = { serverSeed: seeds.serverSeed, clientSeed: seeds.clientSeed, nonce: seeds.nonce };

  switch (template) {
    case 'dice': {
      const r = playDice(bet, num(params.target, 50), bool(params.over, true), s, edge);
      return { multiplier: r.multiplier, payout: r.payout, win: r.win, detail: { roll: r.roll } };
    }
    case 'limbo': {
      const r = playLimbo(bet, num(params.target, 2), s, edge);
      return { multiplier: r.multiplier, payout: r.payout, win: r.win, detail: { crashPoint: r.crashPoint } };
    }
    case 'coinflip': {
      const r = playCoinflip(bet, bool(params.pickHeads, true), s, edge);
      return { multiplier: r.multiplier, payout: r.payout, win: r.win, detail: { heads: r.heads } };
    }
    case 'wheel': {
      const segs = buildWheel(risk(params.risk), 30, edge);
      const { index, multiplier } = spinWheel(segs, s);
      return { multiplier, payout: round2(bet * multiplier), win: multiplier >= 1, detail: { index } };
    }
    case 'plinko': {
      const rows = [8, 12, 16].includes(num(params.rows, 12)) ? num(params.rows, 12) : 12;
      const { bucket, path } = dropPlinko(rows as 8 | 12 | 16, s);
      const raw = (PLINKO_PAYOUTS[risk(params.risk)][rows as 8 | 12 | 16] ?? [])[bucket] ?? 1;
      const multiplier = round2(raw * (1 - clampEdge(edge)));
      return { multiplier, payout: round2(bet * multiplier), win: multiplier >= 1, detail: { bucket, path } };
    }
    case 'mines': {
      const grid = num(params.grid, 25);
      const bombs = num(params.bombs, 3);
      const tiles: number[] = Array.isArray(params.tiles) ? params.tiles : [];
      const layout = minesLayout(grid, bombs, s);
      const hit = tiles.find((t) => layout.has(t));
      if (hit !== undefined) {
        return { multiplier: 0, payout: 0, win: false, detail: { bombs: [...layout], hit } };
      }
      const multiplier = minesMultiplier(grid, bombs, tiles.length, edge);
      return {
        multiplier,
        payout: round2(bet * multiplier),
        win: tiles.length > 0,
        detail: { picks: tiles.length },
      };
    }
    default:
      throw new Error(`Unsupported template: ${template}`);
  }
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : v === 1 || v === '1' ? true : d);
const risk = (v: unknown): 'low' | 'medium' | 'high' =>
  v === 'low' || v === 'high' ? v : 'medium';

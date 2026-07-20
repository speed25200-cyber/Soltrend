/**
 * GameSpec — a casino game described by *data*, never code (§7).
 *
 * The validator here is the safety gate that makes UGC legal & non-abusable:
 * a creator can only ever produce a spec whose house edge is inside the global
 * band and whose maximum payout can never drain the vault. The platform stays
 * the sole operator; the creator merely designs within audited primitives.
 */

import {
  MIN_EDGE,
  MAX_EDGE,
  clampEdge,
  minesMultiplier,
  PLINKO_PAYOUTS,
  type Template,
} from './games';

export interface GameSpec {
  template: Template;
  name: string;
  edge: number;
  params: Record<string, number | string>;
  theme: { accent: string; icon: string };
}

export interface Validation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  rtp: number; // return-to-player = 1 - edge
  maxWinMult: number; // largest multiplier the game can pay
}

/** Global payout ceiling (× bet). Beyond this a single bet could threaten the vault. */
export const MAX_PAYOUT_MULT = 1000;
export const CREATABLE_TEMPLATES: Template[] = ['dice', 'limbo', 'mines', 'plinko', 'wheel', 'coinflip'];

export function maxWinMultiplier(spec: GameSpec): number {
  const e = clampEdge(spec.edge);
  switch (spec.template) {
    case 'dice':
      // Highest multiplier at the tightest win chance (~1%).
      return (100 - e * 100) / 1;
    case 'limbo':
      return MAX_PAYOUT_MULT; // unbounded in theory → capped by the ceiling
    case 'coinflip':
      return 2 * (1 - e);
    case 'mines': {
      const grid = (spec.params.grid as number) ?? 25;
      const bombs = (spec.params.bombs as number) ?? 3;
      return minesMultiplier(grid, bombs, grid - bombs, e);
    }
    case 'plinko': {
      const risk = (spec.params.risk as 'low' | 'medium' | 'high') ?? 'medium';
      const rows = (spec.params.rows as 8 | 12 | 16) ?? 12;
      const table = PLINKO_PAYOUTS[risk][rows] ?? [];
      return Math.max(...table) * (1 - e);
    }
    case 'wheel':
      return 50 * (1 - e); // high-risk top segment
    default:
      return 10;
  }
}

export function validateSpec(spec: GameSpec): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spec.name || spec.name.trim().length < 3) errors.push('Name must be at least 3 characters.');
  if (spec.name && spec.name.length > 28) errors.push('Name must be 28 characters or fewer.');

  if (spec.edge < MIN_EDGE - 1e-9)
    errors.push(`House edge ${pct(spec.edge)} is below the ${pct(MIN_EDGE)} minimum.`);
  if (spec.edge > MAX_EDGE + 1e-9)
    errors.push(`House edge ${pct(spec.edge)} exceeds the ${pct(MAX_EDGE)} maximum.`);

  const maxWinMult = maxWinMultiplier(spec);
  if (maxWinMult > MAX_PAYOUT_MULT)
    errors.push(`Max payout ${maxWinMult.toFixed(0)}× exceeds the ${MAX_PAYOUT_MULT}× vault-safety cap.`);

  if (spec.template === 'mines') {
    const grid = (spec.params.grid as number) ?? 25;
    const bombs = (spec.params.bombs as number) ?? 3;
    if (bombs < 1 || bombs >= grid) errors.push('Mines must be between 1 and grid size − 1.');
  }

  if (spec.edge > 0.03) warnings.push('Edges above 3% convert worse — players prefer 1–2%.');

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    rtp: 1 - clampEdge(spec.edge),
    maxWinMult,
  };
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

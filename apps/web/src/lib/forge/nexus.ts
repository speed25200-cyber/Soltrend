/**
 * NEXUS — creator-authored 3D risk topology.
 *
 * Every other casino game (ours included, until now) hands the creator a fixed
 * shape — a grid, a tower, a wheel — and lets them tune numbers on it. A Nexus
 * inverts that: the creator draws the *structure*. Rooms float in 3D space, each
 * with its own danger, wired together by one-way paths. The player walks the
 * graph, and at every junction picks a route: the safe corridor that pays
 * little, or the lethal shortcut that pays a lot. They can bank at any room.
 *
 * ── Why free-form authoring is still provably safe ──────────────────────────
 * A room with survival probability p pays a gain of exactly 1/p. Walking a path
 * P multiplies those gains, and the house edge is applied once, at cash-out:
 *
 *     payout(P) = ( ∏ 1/p_i ) · (1 − edge)
 *     EV(P)     = ( ∏ p_i ) · ( ∏ 1/p_i ) · (1 − edge) = 1 − edge
 *
 * The edge is therefore *path-independent*: it is identical down every route
 * through any topology a creator can draw, so no arrangement of rooms — however
 * strange — can tilt the game. The only thing left to validate is the vault cap
 * (the richest reachable path must stay under MAX_PAYOUT), which is a bounded
 * search, not a Monte-Carlo estimate.
 */

import { clampEdge, MIN_EDGE, MAX_EDGE } from '../games';
import { MAX_PAYOUT } from './board';
import { floatStream } from '../provably-fair';

export interface NexusRoom {
  id: string;
  /** position on the floor plane, in world units */
  x: number;
  z: number;
  /** height — lets creators build spirals, bridges and layered vaults */
  y: number;
  /** chance this room is a trap, 0..MAX_RISK. Survival is 1 - risk. */
  risk: number;
  label?: string;
}

export interface NexusSpec {
  rooms: NexusRoom[];
  /** directed edges "from>to"; a room with no exits forces a cash-out */
  links: [string, string][];
  startId: string;
}

export const MAX_ROOMS = 14;
export const MIN_RISK = 0.05;
export const MAX_RISK = 0.6;
/** Depth guard for the path search — also the longest run a player can take. */
export const MAX_DEPTH = 12;

export const clampRisk = (r: number) => Math.max(MIN_RISK, Math.min(MAX_RISK, r));

/** Fair gain for one room: 1 / survival. Always ≥ 1. */
export const roomGain = (room: NexusRoom) => 1 / (1 - clampRisk(room.risk));

export const findRoom = (spec: NexusSpec, id: string) => spec.rooms.find((r) => r.id === id);

/** Rooms reachable in one step from `id`. */
export function exitsFrom(spec: NexusSpec, id: string): NexusRoom[] {
  return spec.links
    .filter(([from]) => from === id)
    .map(([, to]) => findRoom(spec, to))
    .filter((r): r is NexusRoom => !!r);
}

/**
 * Multiplier after clearing `path` (room ids, excluding the start room, which is
 * always safe ground). The edge is applied once here — see the header proof.
 */
export function nexusMultiplier(spec: NexusSpec, path: string[], edge: number): number {
  let m = 1;
  for (const id of path) {
    const room = findRoom(spec, id);
    if (room) m *= roomGain(room);
  }
  return Math.round(Math.min(MAX_PAYOUT, m * (1 - clampEdge(edge))) * 100) / 100;
}

/**
 * Richest simple path from the start, as a raw gain product (no edge applied).
 * Simple = never revisits a room, so loops in the topology are allowed without
 * making the payout unbounded. Bounded by MAX_ROOMS + MAX_DEPTH.
 */
export function maxPathGain(spec: NexusSpec): number {
  const start = findRoom(spec, spec.startId);
  if (!start) return 1;
  let best = 1;
  const walk = (id: string, gain: number, seen: Set<string>, depth: number) => {
    if (gain > best) best = gain;
    if (depth >= MAX_DEPTH) return;
    for (const next of exitsFrom(spec, id)) {
      if (seen.has(next.id)) continue;
      seen.add(next.id);
      walk(next.id, gain * roomGain(next), seen, depth + 1);
      seen.delete(next.id);
    }
  };
  walk(spec.startId, 1, new Set([spec.startId]), 0);
  return best;
}

export interface NexusStats {
  rooms: number;
  links: number;
  /** top payout down the richest route */
  maxMult: number;
  /** chance of surviving that richest route */
  maxPathSurvival: number;
  /** how many rooms offer a real choice (2+ exits) — the soul of the design */
  junctions: number;
  edge: number;
  capped: boolean;
  ok: boolean;
  errors: string[];
}

export function nexusStats(spec: NexusSpec, edge: number): NexusStats {
  const e = clampEdge(edge);
  const errors: string[] = [];
  const start = findRoom(spec, spec.startId);

  if (!start) errors.push('Pick a starting room.');
  if (spec.rooms.length < 2) errors.push('A Nexus needs at least two rooms.');
  if (spec.rooms.length > MAX_ROOMS) errors.push(`Too many rooms — the limit is ${MAX_ROOMS}.`);
  if (start && exitsFrom(spec, spec.startId).length === 0) errors.push('The starting room has no exits — nowhere to go.');

  // Unreachable rooms are dead content; warn the creator rather than ship them.
  if (start) {
    const seen = new Set([spec.startId]);
    const queue = [spec.startId];
    while (queue.length) {
      for (const next of exitsFrom(spec, queue.shift()!)) {
        if (!seen.has(next.id)) {
          seen.add(next.id);
          queue.push(next.id);
        }
      }
    }
    const orphans = spec.rooms.filter((r) => !seen.has(r.id));
    if (orphans.length) errors.push(`${orphans.length} room${orphans.length === 1 ? '' : 's'} can't be reached from the start.`);
  }

  const gain = maxPathGain(spec);
  const maxMult = Math.round(Math.min(MAX_PAYOUT, gain * (1 - e)) * 100) / 100;
  if (gain * (1 - e) > MAX_PAYOUT) errors.push(`The richest route pays ${(gain * (1 - e)).toFixed(0)}x, over the ${MAX_PAYOUT}x vault cap — shorten it or make rooms safer.`);
  if (edge < MIN_EDGE - 1e-9) errors.push(`House edge ${(edge * 100).toFixed(2)}% is below the ${MIN_EDGE * 100}% minimum.`);
  if (edge > MAX_EDGE + 1e-9) errors.push(`House edge ${(edge * 100).toFixed(2)}% exceeds the ${MAX_EDGE * 100}% maximum.`);

  return {
    rooms: spec.rooms.length,
    links: spec.links.length,
    maxMult,
    // survival of the richest route = (1-edge)/maxMult by the identity above
    maxPathSurvival: gain > 0 ? 1 / gain : 0,
    junctions: spec.rooms.filter((r) => exitsFrom(spec, r.id).length >= 2).length,
    edge: e,
    capped: maxMult >= MAX_PAYOUT - 0.5,
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Pre-draw a trap roll for every room from the reserved seed, so the whole
 * Nexus is fixed the moment the round starts — the player can verify it after
 * the fact, and the outcome cannot depend on the route they chose.
 */
export function nexusRolls(
  spec: NexusSpec,
  seeds: { serverSeed: string; clientSeed: string; nonce: number },
): Record<string, number> {
  const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
  const rolls: Record<string, number> = {};
  // Stable order so the same seed always yields the same Nexus.
  for (const room of [...spec.rooms].sort((a, b) => a.id.localeCompare(b.id))) {
    rolls[room.id] = stream.next();
  }
  return rolls;
}

/** True when entering this room springs its trap. */
export const isTrap = (room: NexusRoom, rolls: Record<string, number>) =>
  (rolls[room.id] ?? 1) < clampRisk(room.risk);

/* ------------------------------------------------------------------ authoring */

let roomCounter = 0;
export const newRoom = (x: number, z: number, y = 0, risk = 0.2): NexusRoom => ({
  id: `r${(roomCounter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`,
  x,
  z,
  y,
  risk: clampRisk(risk),
});

/**
 * Starter topologies — each teaches a different authoring idea, and each is a
 * shape the older grid/tower mechanics simply cannot express.
 */
export const NEXUS_TEMPLATES: { id: string; label: string; hint: string; build: () => NexusSpec }[] = [
  {
    id: 'fork',
    label: 'The Fork',
    hint: 'One safe road, one lethal shortcut — they meet at the vault',
    build: () => {
      const start = newRoom(0, 3, 0, 0.08);
      const safeA = newRoom(-2.2, 1, 0, 0.12);
      const safeB = newRoom(-2.2, -1, 0, 0.12);
      const risky = newRoom(2.2, 0, 0.8, 0.45);
      const vault = newRoom(0, -3, 0.4, 0.3);
      return {
        rooms: [start, safeA, safeB, risky, vault],
        links: [
          [start.id, safeA.id],
          [start.id, risky.id],
          [safeA.id, safeB.id],
          [safeB.id, vault.id],
          [risky.id, vault.id],
        ],
        startId: start.id,
      };
    },
  },
  {
    id: 'spiral',
    label: 'Spiral Vault',
    hint: 'A climbing spiral that grows more dangerous with height',
    build: () => {
      const rooms = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return newRoom(Math.cos(a) * 2.6, Math.sin(a) * 2.6, i * 0.55, 0.1 + i * 0.06);
      });
      return {
        rooms,
        links: rooms.slice(0, -1).map((r, i) => [r.id, rooms[i + 1].id] as [string, string]),
        startId: rooms[0].id,
      };
    },
  },
  {
    id: 'gauntlet',
    label: 'Crossroads',
    hint: 'Two parallel routes you can switch between — pick your poison',
    build: () => {
      const start = newRoom(0, 3.4, 0, 0.08);
      const left = Array.from({ length: 3 }, (_, i) => newRoom(-1.8, 1.4 - i * 1.7, 0, 0.14));
      const right = Array.from({ length: 3 }, (_, i) => newRoom(1.8, 1.4 - i * 1.7, 0.5, 0.34));
      const links: [string, string][] = [
        [start.id, left[0].id],
        [start.id, right[0].id],
      ];
      for (let i = 0; i < 2; i++) {
        links.push([left[i].id, left[i + 1].id], [right[i].id, right[i + 1].id]);
        links.push([left[i].id, right[i + 1].id], [right[i].id, left[i + 1].id]); // cross over
      }
      return { rooms: [start, ...left, ...right], links, startId: start.id };
    },
  },
];

/* ------------------------------------------------------------- (de)serialize */

export function nexusToParams(spec: NexusSpec): Record<string, number | string> {
  return { nexus: JSON.stringify(spec) };
}

export function nexusFromParams(params?: Record<string, number | string>): NexusSpec | null {
  if (!params?.nexus) return null;
  try {
    const spec = JSON.parse(String(params.nexus)) as NexusSpec;
    if (!Array.isArray(spec.rooms) || !Array.isArray(spec.links) || typeof spec.startId !== 'string') return null;
    // Drop links pointing at rooms that no longer exist.
    const ids = new Set(spec.rooms.map((r) => r.id));
    return {
      rooms: spec.rooms.slice(0, MAX_ROOMS).map((r) => ({ ...r, risk: clampRisk(r.risk) })),
      links: spec.links.filter(([a, b]) => ids.has(a) && ids.has(b)),
      startId: spec.startId,
    };
  } catch {
    return null;
  }
}

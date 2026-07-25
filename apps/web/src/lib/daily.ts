/**
 * THE DAILY NEXUS — one map, the whole world, every day.
 *
 * Casinos deliberately never give two players the same board, so nobody can
 * compare runs and there is nothing to talk about. That is exactly why nothing
 * a casino produces ever spreads. This inverts it: every player on earth gets
 * the *same* map today, derived deterministically from the date, and the run
 * ends in a compact text card built to be pasted anywhere.
 *
 * The map is shared; the luck is not. Trap rolls still come from each player's
 * own provably-fair seed chain, so the daily map being computable in advance
 * gives nobody an edge — you can study the topology, you cannot know your rolls.
 * What's compared is the decision: which route did you take, and how far did you
 * push before banking.
 */

import { sha256Hex } from './provably-fair';
import { clampRisk, linkId, newRoom, nexusStats, type NexusRoom, type NexusSpec } from './forge/nexus';

/** Day 1 — the epoch the daily counter is numbered from. */
const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

/** UTC day key, so the world rolls over at the same instant. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Human-facing puzzle number, e.g. Daily Nexus #212. */
export function dayNumber(now: number): number {
  return Math.floor((Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()) - EPOCH) / DAY_MS) + 1;
}

export function msUntilNextDay(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(0, next - now);
}

/** Deterministic PRNG seeded from a hex digest. */
function rngFrom(hex: string): () => number {
  let a = parseInt(hex.slice(0, 8), 16) >>> 0;
  let b = parseInt(hex.slice(8, 16), 16) >>> 0;
  let c = parseInt(hex.slice(16, 24), 16) >>> 0;
  let d = parseInt(hex.slice(24, 32), 16) >>> 0;
  return () => {
    // sfc32 — small, fast, good enough for level layout
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Build the day's map: a layered graph so there is always a real choice at every
 * step, with danger rising as you go deeper and — on some days — a key room
 * guarding the richest chamber.
 */
function buildMap(rand: () => number): NexusSpec {
  const layers: NexusRoom[][] = [];
  const depth = 3 + Math.floor(rand() * 2); // 3..4 layers past the entrance

  const start = newRoom(0, 3.4, 0, 0.07);
  start.label = 'Gate';
  layers.push([start]);

  for (let i = 1; i <= depth; i++) {
    const width = 2 + (rand() < 0.35 ? 1 : 0); // 2..3 rooms per layer
    const z = 3.4 - i * 1.9;
    const row: NexusRoom[] = [];
    for (let j = 0; j < width; j++) {
      const x = (j - (width - 1) / 2) * 2.5;
      // Deeper rooms are more dangerous, and each has its own character.
      const base = 0.1 + i * 0.07 + rand() * 0.16;
      const r = newRoom(Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.round(rand() * 8) / 10, clampRisk(base));
      r.label = `${['West', 'Court', 'East'][width === 2 ? j * 2 : j] ?? 'Hall'} ${i}`;
      row.push(r);
    }
    layers.push(row);
  }

  // Wire every room to one or two rooms on the next layer, guaranteeing at least
  // one exit so no route dead-ends before the final chamber.
  const links: [string, string][] = [];
  for (let i = 0; i < layers.length - 1; i++) {
    const next = layers[i + 1];
    for (const from of layers[i]) {
      const first = Math.floor(rand() * next.length);
      links.push([from.id, next[first].id]);
      if (next.length > 1 && rand() < 0.65) {
        const second = (first + 1 + Math.floor(rand() * (next.length - 1))) % next.length;
        if (second !== first) links.push([from.id, next[second].id]);
      }
    }
    // Forward wiring alone can leave a room with no way in, which would strand
    // it. Give every room in the layer at least one inbound path.
    for (const room of next) {
      if (!links.some(([, to]) => to === room.id)) {
        const from = layers[i][Math.floor(rand() * layers[i].length)];
        links.push([from.id, room.id]);
      }
    }
  }

  const spec: NexusSpec = { rooms: layers.flat(), links, startId: start.id, gates: {} };

  // On roughly half the days, seal the richest final room behind a key stashed
  // on a side branch — the day's real decision.
  const last = layers[layers.length - 1];
  if (rand() < 0.5 && last.length > 1 && layers.length > 2) {
    const mid = layers[layers.length - 2];
    const keyRoom = mid[Math.floor(rand() * mid.length)];
    const prize = last.reduce((a, b) => (a.risk > b.risk ? a : b));
    const feeders = links.filter(([, to]) => to === prize.id);
    // Only gate it if another way through still exists, so the day is playable
    // even for someone who skips the key.
    if (feeders.length > 0 && last.length > 1) {
      keyRoom.key = 'amber';
      keyRoom.label = 'Key vault';
      prize.label = 'Treasury';
      for (const [from] of feeders) spec.gates![linkId(from, prize.id)] = 'amber';
    }
  }

  return spec;
}

export interface DailyPuzzle {
  key: string;
  number: number;
  spec: NexusSpec;
  /** top payout down the richest route, for the "par" the board is chasing */
  maxMult: number;
}

/** Today's puzzle. Regenerates with a new salt until the validator accepts it. */
export function dailyPuzzle(now: number, edge = 0.02): DailyPuzzle {
  const key = dayKey(now);
  for (let salt = 0; salt < 24; salt++) {
    const spec = buildMap(rngFrom(sha256Hex(`soltrend-daily-v1:${key}:${salt}`)));
    const stats = nexusStats(spec, edge);
    if (stats.ok && stats.maxMult > 1.5) {
      return { key, number: dayNumber(now), spec, maxMult: stats.maxMult };
    }
  }
  // Guaranteed fallback: a plain three-room corridor, always valid.
  const a = newRoom(0, 2.4, 0, 0.1);
  const b = newRoom(0, 0, 0.3, 0.2);
  const c = newRoom(0, -2.4, 0.6, 0.3);
  const spec: NexusSpec = { rooms: [a, b, c], links: [[a.id, b.id], [b.id, c.id]], startId: a.id, gates: {} };
  return { key, number: dayNumber(now), spec, maxMult: nexusStats(spec, edge).maxMult };
}

/* --------------------------------------------------------------- the share card */

export interface DailyResult {
  /** rooms cleared (excluding the entrance) */
  rooms: number;
  /** total rooms on the richest route, for the ratio */
  total: number;
  multiplier: number;
  banked: boolean;
  keysFound: number;
}

/**
 * The artifact that actually travels. Deliberately plain text with geometric
 * glyphs (never emoji) so it survives a paste into any chat, and carries no
 * stake or balance — what spreads is the run, not someone's money.
 */
export function shareCard(puzzle: DailyPuzzle, r: DailyResult, streak: number, url = 'soltrend.io/daily'): string {
  const cleared = '◆'.repeat(Math.max(0, r.rooms));
  const rest = '◇'.repeat(Math.max(0, r.total - r.rooms - (r.banked ? 0 : 1)));
  const end = r.banked ? '' : '✕';
  const line = `${cleared}${end}${rest}`;
  const lines = [
    `Daily Nexus #${puzzle.number}`,
    line,
    r.banked ? `Banked ${r.multiplier.toFixed(2)}x at ${r.rooms} room${r.rooms === 1 ? '' : 's'} deep` : `Lost it at room ${r.rooms + 1}`,
  ];
  if (r.keysFound > 0) lines.push(`${r.keysFound} key${r.keysFound === 1 ? '' : 's'} recovered`);
  if (streak > 1) lines.push(`${streak} day streak`);
  lines.push(url);
  return lines.join('\n');
}

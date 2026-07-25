/**
 * Soltrend Worlds — the fusion of the node Forge and the spatial Arcade.
 *
 * A "World" is one designable game with two linked layers:
 *   • BODY  — a 3D board the player physically reveals (spatial, Mines-exact,
 *             provably fair, vault-safe by construction).
 *   • BRAIN — an optional node-graph "logic core" that reshapes the win into a
 *             bonus multiplier. It is edge-neutral (normalised to mean ≈ 1), so
 *             it adds signature variance and drama without touching the house
 *             edge, which is owned entirely by the board.
 *
 * One spec, one publish. The same WorldSpec drives the 3D renderer, the payout
 * and the Monte-Carlo-free validator.
 */

import { clampSpec, boardStats, specToParams, type BoardSpec, type BoardStats } from './board';
import { runGraph, simulateGraph, type ForgeGraph } from './model';
import { clampEdge, MIN_EDGE, MAX_EDGE } from '../games';
import { MAX_PAYOUT } from './board';
import { floatStream } from '../provably-fair';
import { nexusStats, nexusFromParams, nexusToParams, NEXUS_TEMPLATES, type NexusSpec } from './nexus';

export type EnvironmentId = 'void' | 'nebula' | 'grid' | 'sunset' | 'arena';
export type CameraId = 'orbit' | 'iso' | 'cinematic';

/**
 * Spatial mechanic. Both are provably fair and vault-safe; they differ in how the
 * player moves through risk.
 *   • board  — reveal tiles on a flat grid (Mines-exact). Spread-out, exploratory.
 *   • ascent — climb a vertical tower one level at a time, each level hiding one
 *              trap among `cols` platforms. Escalating, vertigo-driven tension.
 */
export type WorldMode = 'board' | 'ascent' | 'nexus';

export const WORLD_MODES: { id: WorldMode; label: string; hint: string }[] = [
  { id: 'board', label: 'Board', hint: 'Reveal tiles on a grid — explore and bank' },
  { id: 'ascent', label: 'Ascent', hint: 'Climb a tower level by level — one trap per floor' },
  { id: 'nexus', label: 'Nexus', hint: 'Draw your own 3D map — players choose their route' },
];

export const ENVIRONMENTS: { id: EnvironmentId; label: string; fog: string; ground: string; ambient: number }[] = [
  { id: 'void', label: 'Void', fog: '#05060f', ground: '#0a0d1c', ambient: 0.35 },
  { id: 'nebula', label: 'Nebula', fog: '#140a2e', ground: '#120a26', ambient: 0.5 },
  { id: 'grid', label: 'Neon grid', fog: '#04121a', ground: '#06141a', ambient: 0.45 },
  { id: 'sunset', label: 'Sunset', fog: '#2a1030', ground: '#1a0a1e', ambient: 0.6 },
  { id: 'arena', label: 'Arena', fog: '#0a0e18', ground: '#10131f', ambient: 0.7 },
];

export const CAMERAS: { id: CameraId; label: string }[] = [
  { id: 'orbit', label: 'Orbit' },
  { id: 'iso', label: 'Isometric' },
  { id: 'cinematic', label: 'Cinematic' },
];

export type PropType = 'crystal' | 'ring' | 'pillar' | 'arch' | 'totem' | 'orb';

export const PROP_TYPES: { id: PropType; label: string }[] = [
  { id: 'crystal', label: 'Crystal' },
  { id: 'ring', label: 'Ring' },
  { id: 'pillar', label: 'Pillar' },
  { id: 'arch', label: 'Arch' },
  { id: 'totem', label: 'Totem' },
  { id: 'orb', label: 'Orb' },
];

/** A decorative 3D object placed around the board — cosmetic only, no math impact. */
export interface WorldProp {
  id: string;
  type: PropType;
  angle: number;   // 0..360 around the board
  radius: number;  // distance from centre
  height: number;  // vertical offset
  scale: number;
  color: string;
}

export interface WorldSpec {
  board: BoardSpec;
  logic: ForgeGraph | null;
  environment: EnvironmentId;
  camera: CameraId;
  props: WorldProp[];
  /** runtime scale that normalises the logic core to mean ≈ 1 (edge-neutral) */
  logicScale: number;
  /** which spatial mechanic this world plays as */
  mode: WorldMode;
  /** creator-drawn risk topology — only used by the 'nexus' mechanic */
  nexus: NexusSpec | null;
}

export const defaultWorld = (board: BoardSpec): WorldSpec => ({
  board, logic: null, environment: 'nebula', camera: 'orbit', props: [], logicScale: 1, mode: 'board', nexus: null,
});

/* ------------------------------------------------------------------- ascent */
// The tower reuses the board's grid dimensions: `cols` platforms per floor,
// `rows` floors. Exactly one platform per floor is a trap, so surviving a floor
// has probability (cols-1)/cols and the fair multiplier compounds by cols/(cols-1).

export const ascentLanes = (spec: WorldSpec) => Math.max(2, Math.min(5, spec.board.cols));
export const ascentFloors = (spec: WorldSpec) => Math.max(2, Math.min(12, spec.board.rows));

/** Fair multiplier after clearing `level` floors, with the house edge applied. */
export function ascentMultiplier(spec: WorldSpec, level: number, edge: number): number {
  if (level <= 0) return 1;
  const lanes = ascentLanes(spec);
  return Math.round(Math.pow(lanes / (lanes - 1), level) * (1 - clampEdge(edge)) * 100) / 100;
}

/** Trap lane per floor, drawn from the reserved seed — the whole tower is fixed at start. */
export function ascentLayout(spec: WorldSpec, seeds: { serverSeed: string; clientSeed: string; nonce: number }): number[] {
  const lanes = ascentLanes(spec);
  const stream = floatStream(seeds.serverSeed, seeds.clientSeed, seeds.nonce);
  return Array.from({ length: ascentFloors(spec) }, () => Math.floor(stream.next() * lanes));
}

/** Starter towers — tuned so each has a distinct risk feel and a legal top payout. */
export const ASCENT_TEMPLATES: { id: string; label: string; hint: string; spec: BoardSpec; edge: number }[] = [
  { id: 'spire', label: 'Spire', hint: '5 floors, 4 lanes — a steady climb', spec: { rows: 5, cols: 4, bombs: 1, skin: 'gems', fx: 'flip' }, edge: 0.02 },
  { id: 'gauntlet', label: 'Gauntlet', hint: '6 floors, 3 lanes — steep and tense', spec: { rows: 6, cols: 3, bombs: 1, skin: 'inferno', fx: 'shatter' }, edge: 0.03 },
  { id: 'skyvault', label: 'Sky Vault', hint: '4 floors, 5 lanes — forgiving', spec: { rows: 4, cols: 5, bombs: 1, skin: 'vault', fx: 'bloom' }, edge: 0.02 },
];

function ascentStats(spec: WorldSpec, edge: number): BoardStats {
  const lanes = ascentLanes(spec);
  const floors = ascentFloors(spec);
  const e = clampEdge(edge);
  const ladder = Array.from({ length: floors }, (_, i) => ({
    picks: i + 1,
    mult: ascentMultiplier(spec, i + 1, e),
    survive: Math.pow((lanes - 1) / lanes, i + 1),
  }));
  const maxMult = ladder.length ? ladder[ladder.length - 1].mult : 1;
  const errors: string[] = [];
  if (edge < MIN_EDGE - 1e-9) errors.push(`House edge ${(edge * 100).toFixed(2)}% is below the ${MIN_EDGE * 100}% minimum.`);
  if (edge > MAX_EDGE + 1e-9) errors.push(`House edge ${(edge * 100).toFixed(2)}% exceeds the ${MAX_EDGE * 100}% maximum.`);
  if (maxMult > MAX_PAYOUT) errors.push(`Top payout ${maxMult.toFixed(0)}x exceeds the ${MAX_PAYOUT}x cap — fewer floors or more lanes.`);
  return {
    cells: lanes * floors,
    safe: floors,
    maxMult: Math.round(maxMult * 100) / 100,
    ladder,
    edge: e,
    capped: maxMult >= MAX_PAYOUT - 0.5,
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Adapt the Nexus validator to the shared BoardStats shape the builder renders.
 * The "ladder" here is the richest route step by step, so a creator can see what
 * the greediest possible player would earn on the way through their map.
 */
function nexusBoardStats(spec: WorldSpec, edge: number): BoardStats {
  const e = clampEdge(edge);
  if (!spec.nexus) {
    return { cells: 0, safe: 0, maxMult: 1, ladder: [], edge: e, capped: false, ok: false, errors: ['Draw at least two rooms to build a Nexus.'] };
  }
  const n = nexusStats(spec.nexus, edge);
  return {
    cells: n.rooms,
    safe: n.links,
    maxMult: n.maxMult,
    ladder: [{ picks: 1, mult: n.maxMult, survive: n.maxPathSurvival }],
    edge: n.edge,
    capped: n.capped,
    ok: n.ok,
    errors: n.errors,
  };
}

export { NEXUS_TEMPLATES };

let propCounter = 0;
export const newProp = (type: PropType, color: string): WorldProp => ({
  id: `p${(propCounter++).toString(36)}`,
  type,
  angle: (propCounter * 47) % 360,
  radius: 4.2,
  height: 0,
  scale: 1,
  color,
});

/** Fit the logic core so its average output is ~1× — pure variance, no edge. */
export function normaliseLogic(graph: ForgeGraph): number {
  const sim = simulateGraph(graph, 12000);
  if (!sim || sim.rtp <= 0.001) return 1;
  return Math.round((1 / sim.rtp) * 1000) / 1000;
}

/** Run the logic core once for a bonus multiplier (edge-neutral, clamped). */
export function runLogicBonus(spec: WorldSpec, next: () => number): number {
  if (!spec.logic) return 1;
  const raw = runGraph(spec.logic, next) * (spec.logicScale || 1);
  return Math.max(0.1, Math.min(10, Number.isFinite(raw) ? raw : 1));
}

export interface WorldStats extends BoardStats {
  hasLogic: boolean;
  /** spread of the logic bonus, e.g. "0.4× – 3.1×" */
  logicRange: [number, number] | null;
}

export function worldStats(spec: WorldSpec, edge: number): WorldStats {
  const base =
    spec.mode === 'nexus'
      ? nexusBoardStats(spec, edge)
      : spec.mode === 'ascent'
        ? ascentStats(spec, edge)
        : boardStats(spec.board, edge);
  let logicRange: [number, number] | null = null;
  if (spec.logic) {
    let lo = Infinity, hi = 0;
    // sample the bonus distribution deterministically for the builder readout
    let s = 0.12345;
    const rng = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 400; i++) {
      const b = runLogicBonus(spec, rng);
      lo = Math.min(lo, b); hi = Math.max(hi, b);
    }
    logicRange = [Math.round(lo * 100) / 100, Math.round(hi * 100) / 100];
  }
  return { ...base, hasLogic: !!spec.logic, logicRange };
}

/* ------------------------------------------------------------- (de)serialize */

export function worldToParams(spec: WorldSpec): Record<string, number | string> {
  const p: Record<string, number | string> = {
    ...specToParams(spec.board),
    environment: spec.environment,
    camera: spec.camera,
    logicScale: spec.logicScale,
    mode: spec.mode,
  };
  if (spec.nexus) Object.assign(p, nexusToParams(spec.nexus));
  if (spec.logic) p.logic = JSON.stringify(spec.logic);
  if (spec.props.length) p.props = JSON.stringify(spec.props);
  return p;
}

export function worldFromParams(params?: Record<string, number | string>): WorldSpec {
  const board = clampSpec({
    rows: Number(params?.rows), cols: Number(params?.cols), bombs: Number(params?.bombs),
    skin: params?.skin as BoardSpec['skin'], fx: params?.fx as BoardSpec['fx'],
  });
  let logic: ForgeGraph | null = null;
  if (params?.logic) {
    try { logic = JSON.parse(String(params.logic)) as ForgeGraph; } catch { logic = null; }
  }
  let props: WorldProp[] = [];
  if (params?.props) {
    try { props = JSON.parse(String(params.props)) as WorldProp[]; } catch { props = []; }
  }
  const env = (params?.environment as EnvironmentId) || 'nebula';
  const cam = (params?.camera as CameraId) || 'orbit';
  const mode: WorldMode = params?.mode === 'ascent' ? 'ascent' : params?.mode === 'nexus' ? 'nexus' : 'board';
  const nexus = mode === 'nexus' ? nexusFromParams(params) : null;
  return { board, logic, environment: env, camera: cam, props, logicScale: Number(params?.logicScale) || 1, mode, nexus };
}

export const envDef = (id: EnvironmentId) => ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[1];

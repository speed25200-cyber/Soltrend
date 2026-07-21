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

export type EnvironmentId = 'void' | 'nebula' | 'grid' | 'sunset' | 'arena';
export type CameraId = 'orbit' | 'iso' | 'cinematic';

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
}

export const defaultWorld = (board: BoardSpec): WorldSpec => ({
  board, logic: null, environment: 'nebula', camera: 'orbit', props: [], logicScale: 1,
});

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
  const base = boardStats(spec.board, edge);
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
  };
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
  return { board, logic, environment: env, camera: cam, props, logicScale: Number(params?.logicScale) || 1 };
}

export const envDef = (id: EnvironmentId) => ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[1];

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  REELS, ROWS, GOLDMINE, TRAIN, BELL, GTRAIN, SCATTER, WILD, REEL_WEIGHTS,
  type GXSpin, type TrainColor,
} from '@/lib/slots/gold-express';
import { TRAIN_HEX } from './ExpressSymbols';
import type { ReelPlan } from './ExpressReels';

/**
 * The slot machine itself, in 3D — the AAA piece. Five cylindrical reels with
 * real three-dimensional symbol tiles wrapped around them spin with angular
 * momentum and brake one at a time onto the engine's grid. Every symbol is
 * built from geometry (no textures — crisp at any angle, on any GPU); the
 * letters and cash values use a little dot-matrix segment font. The cabinet
 * is brass and glass with a lit marquee; wins strobe the lamps.
 */

const SLOTS = 12; // tiles around each reel
const SLOT_A = (Math.PI * 2) / SLOTS;
const RADIUS = 1.02;
const STOP_ANGLE = SLOT_A / 2; // the resting rotation that puts the finals in the window
const TURNS = 3;

/** window row j (0=top) is filled by this slot index */
const FINAL_SLOT = [1, 0, 11, 10];

/* ------------------------------------------------- dot-matrix segment font */

/** 3×5 cell patterns, '#'-lit. Every glyph we need for ranks, cash, marquee. */
const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '###', '#..', '###'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['#.#', '###', '###', '###', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  '×': ['#.#', '.#.', '.#.', '.#.', '#.#'],
  '.': ['...', '...', '...', '...', '.#.'],
  ' ': ['...', '...', '...', '...', '...'],
};

function Glyph({ ch, color, size = 0.03 }: { ch: string; color: string; size?: number }) {
  const cells = useMemo(() => {
    const rows = GLYPHS[ch] ?? GLYPHS[' '];
    const out: [number, number][] = [];
    rows.forEach((row, y) => {
      row.split('').forEach((c, x) => {
        if (c === '#') out.push([(x - 1) * (size + size * 0.25), (2 - y) * (size + size * 0.25)]);
      });
    });
    return out;
  }, [ch, size]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color]);
  return (
    <group>
      {cells.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]} material={mat}>
          <boxGeometry args={[size, size, size * 0.7]} />
        </mesh>
      ))}
    </group>
  );
}

function Text3D({
  text, color, size = 0.03, spacing = 3.9,
}: { text: string; color: string; size?: number; spacing?: number }) {
  const width = (text.length - 1) * size * spacing;
  return (
    <group position={[-width / 2, 0, 0]}>
      {text.split('').map((ch, i) => (
        <group key={i} position={[i * size * spacing, 0, 0]}>
          <Glyph ch={ch.toUpperCase()} color={color} size={size} />
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------- symbol meshes */

const RANK_COLORS = ['#2dd4bf', '#4ade80', '#60a5fa', '#a78bfa', '#f87171'];
const RANK_LABEL = ['1 0', 'J', 'Q', 'K', 'A'];

function mat(color: string) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function SymbolMesh({
  sym, cash, trainColor,
}: { sym: number; cash?: number | null; trainColor?: TrainColor | null }) {
  const mats = useMemo(() => new Map<string, THREE.MeshBasicMaterial>(), []);
  const m = (c: string) => {
    let x = mats.get(c);
    if (!x) { x = mat(c); mats.set(c, x); }
    return x;
  };
  useEffect(() => () => { mats.forEach((x) => x.dispose()); }, [mats]);

  if (sym <= 4) {
    return (
      <group>
        <mesh material={m(RANK_COLORS[sym])} position={[0, 0, 0]}>
          <boxGeometry args={[0.34, 0.38, 0.05]} />
        </mesh>
        <mesh material={m('#0b0e1a')} position={[0, 0, 0.028]}>
          <boxGeometry args={[0.29, 0.33, 0.012]} />
        </mesh>
        <group position={[0, 0, 0.045]}>
          <Text3D text={RANK_LABEL[sym]} color="#f8fafc" size={0.032} />
        </group>
      </group>
    );
  }
  if (sym === 5) { // lamp
    return (
      <group>
        <mesh material={m('#b45309')}><boxGeometry args={[0.2, 0.3, 0.1]} /></mesh>
        <mesh material={m('#fff7d6')} position={[0, 0, 0.04]}>
          <sphereGeometry args={[0.075, 12, 10]} />
        </mesh>
        <mesh material={m('#78350f')} position={[0, 0.18, 0]}><boxGeometry args={[0.26, 0.05, 0.12]} /></mesh>
        <mesh material={m('#78350f')} position={[0, -0.18, 0]}><boxGeometry args={[0.28, 0.05, 0.12]} /></mesh>
        <pointLight color="#ffd9a0" intensity={0.5} distance={0.8} />
      </group>
    );
  }
  if (sym === 6) { // shovel
    return (
      <group rotation={[0, 0, 0.4]}>
        <mesh material={m('#92400e')} position={[0, 0.08, 0]}><boxGeometry args={[0.045, 0.4, 0.045]} /></mesh>
        <mesh material={m('#94a3b8')} position={[0, -0.22, 0]}><boxGeometry args={[0.2, 0.18, 0.03]} /></mesh>
      </group>
    );
  }
  if (sym === 7) { // hard hat
    return (
      <group>
        <mesh material={m('#fde047')} position={[0, 0.02, 0]} scale={[1, 0.72, 1]}>
          <sphereGeometry args={[0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh material={m('#a16207')} position={[0, 0.02, 0]}><boxGeometry args={[0.42, 0.04, 0.2]} /></mesh>
      </group>
    );
  }
  if (sym === 8) { // money bag
    return (
      <group>
        <mesh material={m('#d6a45b')} position={[0, -0.03, 0]} scale={[1, 1.15, 0.7]}>
          <sphereGeometry args={[0.16, 14, 12]} />
        </mesh>
        <mesh material={m('#92400e')} position={[0, 0.17, 0]}><boxGeometry args={[0.14, 0.06, 0.1]} /></mesh>
        <group position={[0, -0.02, 0.115]}>
          <Text3D text="$" color="#fef3c7" size={0.04} />
        </group>
      </group>
    );
  }
  if (sym === 9) { // gold bars
    return (
      <group>
        <mesh material={m('#fcd34d')} position={[-0.09, -0.06, 0]} rotation={[0, 0, 0]}><boxGeometry args={[0.16, 0.09, 0.08]} /></mesh>
        <mesh material={m('#fcd34d')} position={[0.09, -0.06, 0]}><boxGeometry args={[0.16, 0.09, 0.08]} /></mesh>
        <mesh material={m('#fde68a')} position={[0, 0.04, 0]}><boxGeometry args={[0.16, 0.09, 0.08]} /></mesh>
      </group>
    );
  }
  if (sym === WILD) {
    return (
      <group>
        <mesh material={m('#b45309')}><boxGeometry args={[0.2, 0.26, 0.1]} /></mesh>
        <mesh material={m('#fff7d6')} position={[0, 0, 0.04]}>
          <sphereGeometry args={[0.07, 12, 10]} />
        </mesh>
        <group position={[0, -0.21, 0.06]}>
          <Text3D text="WILD" color="#fdba74" size={0.022} spacing={3.6} />
        </group>
      </group>
    );
  }
  if (sym === GOLDMINE) {
    return (
      <group>
        <mesh material={m('#44403c')}><boxGeometry args={[0.34, 0.36, 0.06]} /></mesh>
        <mesh material={m('#0c0a09')} position={[0, -0.02, 0.04]}>
          <cylinderGeometry args={[0.12, 0.12, 0.03, 16, 1, false, 0, Math.PI]} />
        </mesh>
        <mesh material={m('#fcd34d')} position={[-0.05, -0.08, 0.06]}>
          <icosahedronGeometry args={[0.045, 0]} />
        </mesh>
        <mesh material={m('#fde68a')} position={[0.05, -0.08, 0.06]}>
          <icosahedronGeometry args={[0.055, 0]} />
        </mesh>
        {cash != null && (
          <group position={[0, -0.21, 0.06]}>
            <Text3D text={`${cash.toFixed(cash < 2 ? 2 : 1)}×`} color="#fcd34d" size={0.018} spacing={3.6} />
          </group>
        )}
      </group>
    );
  }
  if (sym === TRAIN || sym === GTRAIN) {
    const hex = sym === GTRAIN ? { a: '#fde68a', b: '#b45309' } : TRAIN_HEX[trainColor ?? 'green'];
    return (
      <group>
        <mesh material={m(hex.a)} position={[0, -0.02, 0]}><boxGeometry args={[0.3, 0.16, 0.1]} /></mesh>
        <mesh material={m(hex.b)} position={[-0.08, 0.1, 0]}><boxGeometry args={[0.12, 0.1, 0.09]} /></mesh>
        <mesh material={m('#1c1917')} position={[0.1, 0.11, 0]}><cylinderGeometry args={[0.03, 0.04, 0.1, 8]} /></mesh>
        <mesh material={m('#1f2937')} position={[-0.08, -0.13, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
        </mesh>
        <mesh material={m('#1f2937')} position={[0.1, -0.13, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
        </mesh>
        <mesh material={m('#fff7d6')} position={[-0.14, -0.02, 0.05]}>
          <sphereGeometry args={[0.03, 8, 8]} />
        </mesh>
      </group>
    );
  }
  if (sym === BELL) {
    return (
      <group>
        <mesh material={m('#fcd34d')} position={[0, 0.02, 0]} scale={[1, 1.1, 0.8]}>
          <sphereGeometry args={[0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
        </mesh>
        <mesh material={m('#b45309')} position={[0, -0.1, 0]}><boxGeometry args={[0.34, 0.045, 0.12]} /></mesh>
        <mesh material={m('#fde68a')} position={[0, -0.17, 0]}>
          <sphereGeometry args={[0.045, 8, 8]} />
        </mesh>
      </group>
    );
  }
  // SCATTER — dynamite
  return (
    <group>
      {[-0.09, 0, 0.09].map((x, i) => (
        <mesh key={i} material={m(i === 1 ? '#b91c1c' : '#dc2626')} position={[x, 0, 0]} rotation={[0, 0, (i - 1) * 0.15]}>
          <cylinderGeometry args={[0.045, 0.045, 0.3, 10]} />
        </mesh>
      ))}
      <mesh material={m('#78350f')}><boxGeometry args={[0.3, 0.07, 0.1]} /></mesh>
      <mesh material={m('#fcd34d')} position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- the tile */

function Tile({
  sym,
  angle,
  cash,
  trainColor,
  hot,
}: {
  sym: number;
  angle: number;
  cash?: number | null;
  trainColor?: TrainColor | null;
  hot?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const plate = useMemo(() => new THREE.MeshBasicMaterial({ color: '#17111f', toneMapped: false }), []);
  const frame = useMemo(() => new THREE.MeshBasicMaterial({ color: '#6b4a17', toneMapped: false }), []);
  const frameHot = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fcd34d', toneMapped: false }), []);

  useFrame((s) => {
    const g = ref.current;
    if (!g) return;
    const target = hot ? 1.14 + Math.sin(s.clock.elapsedTime * 6) * 0.06 : 1;
    const sc = THREE.MathUtils.lerp(g.scale.x, target, 0.2);
    g.scale.setScalar(sc);
  });

  return (
    <group ref={ref} position={[0, Math.sin(angle) * RADIUS, Math.cos(angle) * RADIUS]} rotation={[-angle, 0, 0]}>
      {/* backplate + brass edge */}
      <mesh material={plate} position={[0, 0, -0.03]}>
        <boxGeometry args={[0.5, 0.5, 0.05]} />
      </mesh>
      {[[0, 0.245], [0, -0.245]].map(([x, y], i) => (
        <mesh key={i} material={hot ? frameHot : frame} position={[x, y, -0.02]}>
          <boxGeometry args={[0.5, 0.02, 0.06]} />
        </mesh>
      ))}
      {[[-0.245, 0], [0.245, 0]].map(([x, y], i) => (
        <mesh key={i} material={hot ? frameHot : frame} position={[x, y, -0.02]}>
          <boxGeometry args={[0.02, 0.5, 0.06]} />
        </mesh>
      ))}
      <SymbolMesh sym={sym} cash={cash} trainColor={trainColor} />
    </group>
  );
}

/* ---------------------------------------------------------------- the reel */

/** Deterministic filler strip for a reel (teaser-safe densities). */
function fillerStrip(weights: number[], seed: number): number[] {
  const w = weights.map((x, i) =>
    i === GOLDMINE ? x * 0.5 : i === TRAIN ? x * 0.5 : i === BELL || i === GTRAIN ? x * 0.35 : i === SCATTER ? 0 : x,
  );
  const total = w.reduce((a, b) => a + b, 0);
  let s = (seed * 2654435761) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < SLOTS; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    let t = (s / 4294967296) * total;
    let pick = 0;
    for (let k = 0; k < w.length; k++) {
      t -= w[k];
      if (t < 0) { pick = k; break; }
    }
    out.push(pick);
  }
  return out;
}

function Reel({
  index,
  spin,
  plan,
  spinning,
  spinKey,
  free,
  lit,
  showWins,
  collected,
}: {
  index: number;
  spin: GXSpin | null;
  plan: ReelPlan;
  spinning: boolean;
  spinKey: number;
  free: boolean;
  lit: Set<string>;
  showWins: boolean;
  collected: boolean;
}) {
  const grp = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const anim = useRef({ from: 0, to: 0, dur: 1, t: 99, spinId: -1 });

  const weights = (free ? REEL_WEIGHTS.free : REEL_WEIGHTS.base)[index];
  const strip = useMemo(() => {
    const base = fillerStrip(weights, 7 + index * 13 + (spinKey % 3));
    if (!spin) return base;
    const out = [...base];
    for (let j = 0; j < ROWS; j++) out[FINAL_SLOT[j]] = spin.grid[index][j];
    return out;
  }, [weights, spin, index, spinKey]);

  useFrame((state, dt) => {
    const g = grp.current;
    if (!g) return;
    const a = anim.current;
    if (spinning && a.spinId !== spinKey) {
      // new spin: wind up from wherever we rest to the stop, plus whole turns
      a.spinId = spinKey;
      const cur = g.rotation.x % (Math.PI * 2);
      a.from = g.rotation.x;
      const delta = ((STOP_ANGLE - cur) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      a.to = a.from + delta + Math.PI * 2 * TURNS;
      a.dur = plan.stops[index] / 1000;
      a.t = 0;
    }
    if (a.t < a.dur) {
      a.t = Math.min(a.dur, a.t + dt);
      const x = a.t / a.dur;
      // long travel, ease-out, then a small mechanical overshoot and settle
      const e = x < 0.86 ? 1 - Math.pow(1 - x / 0.86, 3) : 1;
      const over = x > 0.86 ? Math.sin(((x - 0.86) / 0.14) * Math.PI) * 0.022 : 0;
      g.rotation.x = a.from + (a.to - a.from) * e - over;
    } else if (!spinning) {
      g.rotation.x = a.to % (Math.PI * 2);
    }
    // anticipation glow while this reel hangs
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      const active = spinning && plan.antic[index] && a.t > a.dur * 0.55 && a.t < a.dur;
      m.opacity = THREE.MathUtils.damp(m.opacity, active ? 0.55 + Math.sin(state.clock.elapsedTime * 8) * 0.25 : 0, 8, dt);
    }
  });

  return (
    <group position={[(index - 2) * 0.62, 0, 0]}>
      <group ref={grp} rotation={[STOP_ANGLE, 0, 0]}>
        {strip.map((sym, k) => {
          const finalRow = FINAL_SLOT.indexOf(k);
          const isFinal = spin !== null && finalRow >= 0;
          const rowKey = `${index}:${finalRow}`;
          return (
            <Tile
              key={`${spinKey}-${k}`}
              sym={sym}
              angle={k * SLOT_A}
              cash={isFinal && sym === GOLDMINE ? spin!.cash[index][finalRow] : null}
              trainColor={isFinal && sym === TRAIN ? spin!.trains[index][finalRow] : null}
              hot={
                (isFinal && showWins && lit.has(rowKey)) ||
                (isFinal && collected && sym === GOLDMINE)
              }
            />
          );
        })}
        {/* the drum core */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[RADIUS - 0.03, RADIUS - 0.03, 0.56, 24, 1, true]} />
          <meshStandardMaterial color="#0a0806" side={THREE.BackSide} roughness={0.9} />
        </mesh>
      </group>
      {/* anticipation frame glow */}
      <mesh ref={glow} position={[0, 0, 0.12]}>
        <planeGeometry args={[0.64, 2.35]} />
        <meshBasicMaterial color="#fcd34d" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------- the cabinet */

function Marquee({ lit }: { lit: boolean }) {
  const lamps = useMemo(() => Array.from({ length: 16 }, (_, i) => i), []);
  const lampRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    const g = lampRef.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    g.children.forEach((ch, i) => {
      const m = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const on = lit ? (Math.floor(t * 6 + i) % 2 === 0) : (Math.sin(t * 2 + i * 0.6) > 0.3);
      m.color.set(on ? '#ffe9a8' : '#5c4517');
    });
  });
  return (
    <group position={[0, 1.62, 0]}>
      <mesh>
        <boxGeometry args={[3.6, 0.5, 0.18]} />
        <meshStandardMaterial color="#3a2510" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.095]}>
        <planeGeometry args={[3.4, 0.42]} />
        <meshBasicMaterial color="#120a03" toneMapped={false} />
      </mesh>
      <group position={[0, -0.02, 0.11]} scale={1}>
        <Text3D text="GOLD MINE EXPRESS" color="#fde68a" size={0.026} spacing={4.2} />
      </group>
      <group ref={lampRef} position={[0, 0.3, 0.1]}>
        {lamps.map((i) => (
          <mesh key={i} position={[-1.65 + i * 0.22, 0, 0]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#5c4517" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export interface Machine3DProps {
  spin: GXSpin | null;
  plan: ReelPlan;
  spinning: boolean;
  spinKey: number;
  free: boolean;
  showWins: boolean;
  collected: boolean;
  lit: Set<string>;
}

export function SlotMachine(props: Machine3DProps) {
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a5f22', metalness: 0.7, roughness: 0.42 }), []);
  const winGlow = useRef<THREE.PointLight>(null);
  useFrame((s, dt) => {
    if (winGlow.current) {
      const on = props.showWins && props.lit.size > 0;
      winGlow.current.intensity = THREE.MathUtils.damp(winGlow.current.intensity, on ? 26 + Math.sin(s.clock.elapsedTime * 7) * 8 : 0, 5, dt);
    }
  });

  return (
    <group position={[0, 0.1, 0]}>
      {/* window backplate */}
      <mesh position={[0, 0, -0.75]}>
        <boxGeometry args={[3.4, 2.6, 0.12]} />
        <meshStandardMaterial color="#06040a" roughness={0.9} />
      </mesh>
      {/* brass frame */}
      <mesh material={frame} position={[0, 1.42, 0]}>
        <boxGeometry args={[3.6, 0.24, 0.4]} />
      </mesh>
      <mesh material={frame} position={[0, -1.42, 0]}>
        <boxGeometry args={[3.6, 0.3, 0.44]} />
      </mesh>
      <mesh material={frame} position={[-1.72, 0, 0]}>
        <boxGeometry args={[0.2, 3.1, 0.4]} />
      </mesh>
      <mesh material={frame} position={[1.72, 0, 0]}>
        <boxGeometry args={[0.2, 3.1, 0.4]} />
      </mesh>
      {/* reel dividers */}
      {[-0.93, -0.31, 0.31, 0.93].map((x) => (
        <mesh key={x} material={frame} position={[x, 0, -0.05]}>
          <boxGeometry args={[0.03, 2.4, 0.1]} />
        </mesh>
      ))}

      <Marquee lit={props.showWins && props.lit.size > 0} />
      <pointLight ref={winGlow} color="#fcd34d" intensity={0} distance={8} position={[0, 0.6, 2.2]} />

      {Array.from({ length: REELS }).map((_, r) => (
        <Reel
          key={r}
          index={r}
          spin={props.spin}
          plan={props.plan}
          spinning={props.spinning}
          spinKey={props.spinKey}
          free={props.free}
          lit={props.lit}
          showWins={props.showWins}
          collected={props.collected}
        />
      ))}

      {/* glass sheen over the window */}
      <mesh position={[0, 0, 0.4]} rotation={[0, 0, 0]}>
        <planeGeometry args={[3.3, 2.45]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.045}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Camera choreography for the machine: idle sway, push-in during the spin. */
export function MachineCam({ spinning, active }: { spinning: boolean; active: boolean }) {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    if (!active) return; // the mine's own sway owns the camera otherwise
    const targetZ = spinning ? 6.8 : 7.4;
    s.camera.position.z = THREE.MathUtils.damp(s.camera.position.z, targetZ, 2.4, dt);
    s.camera.position.y = THREE.MathUtils.damp(s.camera.position.y, 2.35 + Math.sin(t * 0.4) * 0.05, 2.4, dt);
    s.camera.position.x = THREE.MathUtils.damp(s.camera.position.x, Math.sin(t * 0.3) * 0.1, 2.4, dt);
    look.set(0, 1.85, 0);
    s.camera.lookAt(look);
  });
  return null;
}

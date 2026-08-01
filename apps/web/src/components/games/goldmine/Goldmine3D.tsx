'use client';

import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import {
  REELS, ROWS, GOLDMINE, PAYLINES, SCATTER, TRAIN, GTRAIN, WILD,
  type GXSpin, type TrainColor,
} from '@/lib/slots/gold-express';
import { TRAIN_HEX } from './ExpressSymbols';
import { ReelStrip, FINAL_SLOT, STRIP_SLOTS, type SlotSpec } from './ReelStripTextures';
import type { ReelPlan } from './ExpressReels';

/**
 * Gold Mine Express, rendered by the GPU.
 *
 * The whole game lives in one WebGL canvas: a sunset canyon, the timber
 * viaduct with the ore train, and centre stage a brass-and-glass cabinet whose
 * five drums carry the game's own SVG art as canvas textures. Five textured
 * strips replace the previous approaches — the DOM build animated dozens of
 * filtered SVG nodes on the CPU, and the first 3D attempt built symbols out of
 * geometry at a mesh per dot-matrix dot. Here a reel is one draw call, every
 * frame of motion is a texture-offset write in useFrame, and React renders
 * nothing at all while the drums are turning.
 */

export interface Stage3DProps {
  spin: GXSpin | null;
  plan: ReelPlan;
  spinning: boolean;
  spinKey: number;
  /** free-spin replays run the faster braking schedule and redder light */
  free: boolean;
  showWins: boolean;
  collected: boolean;
  train: { active: boolean; color: TrainColor; step: number; count: number };
  /** 0..1 mine-cart fill — drives the cart prop beside the machine */
  cartLevel: number;
  winStrength: number; // 0..1, scales the celebration light
}

/* ------------------------------------------------------------- constants */

const TILE_W = 1.06; // world width of one reel window column
const TILE_H = 0.96; // world height of one symbol row
const WINDOW_W = REELS * TILE_W;
const WINDOW_H = ROWS * TILE_H;
/** the strip shows this many slots through the glass (over-curl included) */
const VISIBLE = 4.7;
const REPEAT_Y = VISIBLE / STRIP_SLOTS;
/** resting texture offset that centres FINAL_SLOT rows in the window */
const REST_OFFSET = (STRIP_SLOTS - FINAL_SLOT[3] - 1 + (VISIBLE - ROWS) / 2) / STRIP_SLOTS;

const FILLER_POOL = [0, 1, 2, 3, 4, 5, 6, WILD, 0, 2, 4, 1, 3, 6, 5];

/* ---------------------------------------------------------------- helpers */

/** Deterministic filler so a given spin always shows the same passers-by. */
function fillerFor(seed: number, count: number): SlotSpec[] {
  let s = (seed * 2654435761) >>> 0;
  const out: SlotSpec[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out.push({ sym: FILLER_POOL[s % FILLER_POOL.length] });
  }
  return out;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/* -------------------------------------------------------------- the drums */

interface DrumState {
  offset: number;
  from: number;
  target: number;
  start: number; // ms timestamps relative to spin start
  stop: number;
  blurred: boolean;
}

function Reels({ spin, plan, spinning, spinKey, showWins }: {
  spin: GXSpin | null; plan: ReelPlan; spinning: boolean; spinKey: number; showWins: boolean;
}) {
  const strips = useMemo(
    () => Array.from({ length: REELS }, (_, r) => new ReelStrip(fillerFor(r + 7, STRIP_SLOTS))),
    [],
  );
  useEffect(() => () => strips.forEach((s) => s.dispose()), [strips]);

  const mats = useMemo(
    () => strips.map((s) => {
      const m = new THREE.MeshBasicMaterial({ map: s.texture, toneMapped: false });
      s.texture.repeat.set(1, REPEAT_Y);
      s.blurTexture.repeat.set(1, REPEAT_Y);
      s.texture.offset.y = REST_OFFSET;
      s.blurTexture.offset.y = REST_OFFSET;
      return m;
    }),
    [strips],
  );

  // The drum face: a plane curved along Z so the strip genuinely wraps away at
  // the top and bottom, like the front arc of a cylinder.
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(TILE_W * 0.985, WINDOW_H * (VISIBLE / ROWS), 1, 24);
    const pos = g.attributes.position;
    const half = (WINDOW_H * (VISIBLE / ROWS)) / 2;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setZ(i, -Math.pow(Math.abs(y) / half, 2) * 0.52);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const state = useRef<DrumState[]>(
    Array.from({ length: REELS }, () => ({ offset: REST_OFFSET, from: 0, target: 0, start: 0, stop: 0, blurred: false })),
  );
  const spinStart = useRef(0);
  const lastKey = useRef(-1);

  // A new spinKey arms the run: repaint the landing window while the smear map
  // hides the strip, and lay out each drum's schedule from the braking plan.
  useEffect(() => {
    if (spinKey === lastKey.current || !spinning) return;
    lastKey.current = spinKey;
    spinStart.current = performance.now();
    state.current.forEach((d, r) => {
      const turns = 2 + r; // farther reels travel farther
      d.from = d.offset;
      d.target = d.offset + turns; // integer travel keeps the landing on FINAL_SLOT
      d.start = r * 90;
      d.stop = plan.stops[r];
      d.blurred = false;
    });
    strips.forEach((s, r) => {
      const finals: SlotSpec[] = spin
        ? Array.from({ length: ROWS }, (_, row) => ({
            sym: spin.grid[r][row],
            cash: spin.cash[r][row],
            trainColor: spin.trains[r][row],
          }))
        : [];
      void s.setWindow(finals, fillerFor(spinKey * 31 + r, STRIP_SLOTS - ROWS));
    });
  }, [spinKey, spinning, plan, spin, strips]);

  useFrame(() => {
    if (!spinning && state.current.every((d) => !d.blurred)) return;
    const now = performance.now() - spinStart.current;
    state.current.forEach((d, r) => {
      const mat = mats[r];
      const strip = strips[r];
      let t = 0;
      if (now <= d.start) t = 0;
      else if (now >= d.stop) t = 1;
      else t = (now - d.start) / (d.stop - d.start);
      // Constant-ish velocity for most of the travel, cubic brake into the
      // stop, with a short spring past the detent and back.
      const eased = easeOutCubic(t);
      let offset = d.from + (d.target - d.from) * eased;
      if (t >= 1) {
        const over = Math.min(1, (now - d.stop) / 260);
        offset = d.target + Math.sin(over * Math.PI) * 0.012 * (1 - over);
      }
      d.offset = offset;
      const speed = t > 0 && t < 1 ? (d.target - d.from) * 3 * Math.pow(1 - t, 2) : 0; // d/dt of the cubic
      const wantBlur = speed > 0.9;
      if (wantBlur !== d.blurred) {
        d.blurred = wantBlur;
        mat.map = wantBlur ? strip.blurTexture : strip.texture;
        mat.needsUpdate = true;
      }
      const y = ((offset % 1) + 1) % 1;
      strip.texture.offset.y = y;
      strip.blurTexture.offset.y = y;
    });
  });

  // Winning cells, lit from inside the glass.
  const winCells = useMemo(() => {
    if (!showWins || !spin) return [];
    const set = new Map<string, number>();
    for (const w of spin.lineWins) {
      const rows = PAYLINES[w.line];
      for (let r = 0; r < w.length; r++) set.set(`${r}:${rows[r]}`, w.sym);
    }
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const s = spin.grid[r][row];
        if (s === SCATTER || (spin.collect && (s === GOLDMINE || s === TRAIN || s === GTRAIN))) set.set(`${r}:${row}`, s);
      }
    }
    return [...set.keys()].map((k) => k.split(':').map(Number) as [number, number]);
  }, [showWins, spin]);

  const glowRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    const s = 0.55 + Math.sin(clock.elapsedTime * 5) * 0.25;
    glowRef.current.children.forEach((c) => {
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = s;
    });
  });

  return (
    <group>
      {Array.from({ length: REELS }).map((_, r) => (
        <mesh
          key={r}
          geometry={geo}
          material={mats[r]}
          position={[(r - (REELS - 1) / 2) * TILE_W, 0, 0]}
        />
      ))}
      {/* reel separators */}
      {Array.from({ length: REELS + 1 }).map((_, i) => (
        <mesh key={`sep${i}`} position={[(i - REELS / 2) * TILE_W, 0, 0.06]}>
          <boxGeometry args={[0.045, WINDOW_H * 1.16, 0.1]} />
          <meshStandardMaterial color="#6b4a1c" metalness={0.75} roughness={0.35} />
        </mesh>
      ))}
      <group ref={glowRef}>
        {winCells.map(([r, row]) => (
          <mesh
            key={`${r}-${row}`}
            position={[(r - (REELS - 1) / 2) * TILE_W, ((ROWS - 1) / 2 - row) * TILE_H, 0.055]}
          >
            <planeGeometry args={[TILE_W * 0.92, TILE_H * 0.92]} />
            <meshBasicMaterial color="#ffdf7e" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------- the cabinet */

function textTexture(text: string, color = '#ffe9b0'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.font = '900 84px Archivo, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,180,40,0.9)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 66);
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

/** A soft-edged light streak across the glass — feathered in a tiny gradient
 *  texture so it reads as a reflection, not a hard-edged plane. */
function GlassStreak() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, WINDOW_H * 0.36, 0.12]} rotation={[0, 0, -0.28]}>
      <planeGeometry args={[WINDOW_W * 1.1, 0.7]} />
      <meshBasicMaterial map={tex} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function Cabinet({ spinning, lit }: { spinning: boolean; lit: boolean }) {
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9932e', metalness: 0.85, roughness: 0.32 }), []);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a2c12', metalness: 0.1, roughness: 0.8 }), []);
  const marquee = useMemo(() => textTexture('GOLD MINE EXPRESS'), []);
  useEffect(() => () => marquee.dispose(), [marquee]);

  // Marquee lamps: one instanced mesh, colors strobed in place.
  const lampRef = useRef<THREE.InstancedMesh>(null);
  const lampCount = 18;
  const lampGeo = useMemo(() => new THREE.SphereGeometry(0.05, 10, 10), []);
  const lampMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => {
    const m = lampRef.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < lampCount; i++) {
      const x = ((i % (lampCount / 2)) / (lampCount / 2 - 1) - 0.5) * (WINDOW_W + 0.5);
      const y = i < lampCount / 2 ? WINDOW_H / 2 + 1.06 : -(WINDOW_H / 2) - 0.62;
      o.position.set(x, y, 0.42);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const m = lampRef.current;
    if (!m) return;
    for (let i = 0; i < lampCount; i++) {
      const phase = clock.elapsedTime * (spinning ? 9 : lit ? 6 : 1.4) + i * 0.7;
      const v = 0.35 + Math.max(0, Math.sin(phase)) * (spinning || lit ? 1.5 : 0.45);
      col.setRGB(v * 1.4, v * 0.95, v * 0.3);
      m.setColorAt(i, col);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  const W = WINDOW_W + 0.9;
  const H = WINDOW_H + 1.15;
  return (
    <group>
      {/* body behind the drums */}
      <mesh position={[0, 0, -0.75]} material={wood}>
        <boxGeometry args={[W + 0.5, H + 1.3, 0.9]} />
      </mesh>
      {/* brass frame */}
      {([
        [0, H / 2 + 0.28, [W + 0.7, 0.5, 0.6]],
        [0, -(H / 2) - 0.12, [W + 0.7, 0.42, 0.6]],
        [-(W / 2) - 0.16, 0.08, [0.42, H + 0.85, 0.6]],
        [W / 2 + 0.16, 0.08, [0.42, H + 0.85, 0.6]],
      ] as const).map(([x, y, size], i) => (
        <mesh key={i} position={[x, y, -0.1]} material={brass}>
          <boxGeometry args={size as unknown as [number, number, number]} />
        </mesh>
      ))}
      {/* marquee board */}
      <group position={[0, H / 2 + 1.05, 0.12]}>
        <mesh material={wood}>
          <boxGeometry args={[W + 0.2, 0.95, 0.35]} />
        </mesh>
        <mesh position={[0, 0, 0.19]}>
          <planeGeometry args={[W - 0.4, 0.72]} />
          <meshBasicMaterial map={marquee} transparent toneMapped={false} />
        </mesh>
      </group>
      <instancedMesh ref={lampRef} args={[lampGeo, lampMat, lampCount]} />
      {/* glass: a whisper of reflection, the shading that sells the drum */}
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[WINDOW_W + 0.12, WINDOW_H + 0.55]} />
        <meshBasicMaterial transparent opacity={0.09} depthWrite={false} color="#ffedc8" blending={THREE.AdditiveBlending} />
      </mesh>
      <GlassStreak />
      {/* roller shading top/bottom of the window */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, s * (WINDOW_H / 2 + 0.12), 0.08]}>
          <planeGeometry args={[WINDOW_W + 0.1, 0.85]} />
          <meshBasicMaterial
            transparent
            depthWrite={false}
            color="#140b03"
            opacity={0.82}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
      {/* feet */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.4), -(H / 2) - 0.55, -0.3]} material={brass}>
          <boxGeometry args={[0.5, 0.5, 0.7]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ the set */

function Canyon() {
  const ridges = useMemo(() => {
    const make = (seed: number, base: string, top: string) => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      let s = seed >>> 0;
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, top);
      g.addColorStop(1, base);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 256);
      let x = 0;
      let y = 110 + rnd() * 60;
      while (x < 1024) {
        ctx.lineTo(x, y);
        x += 40 + rnd() * 90;
        y = Math.max(30, Math.min(210, y + (rnd() - 0.5) * 90));
      }
      ctx.lineTo(1024, 256);
      ctx.closePath();
      ctx.fill();
      const t = new THREE.CanvasTexture(c);
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      return t;
    };
    return [
      make(11, '#7a3f16', '#a45a1e'),
      make(23, '#5c2c10', '#7c3f14'),
      make(47, '#3c1c0a', '#552a0e'),
    ];
  }, []);
  useEffect(() => () => ridges.forEach((t) => t.dispose()), [ridges]);

  return (
    <group>
      {/* sky */}
      <mesh position={[0, 4, -26]}>
        <planeGeometry args={[90, 34]} />
        <meshBasicMaterial color="#f5b35c" toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[0, 9.5, -25.5]}>
        <planeGeometry args={[90, 16]} />
        <meshBasicMaterial color="#e88f3e" transparent opacity={0.85} toneMapped={false} fog={false} />
      </mesh>
      {/* sun */}
      <mesh position={[5.4, 6.4, -24]}>
        <circleGeometry args={[2.3, 40]} />
        <meshBasicMaterial color="#fff3c4" toneMapped={false} fog={false} />
      </mesh>
      {ridges.map((t, i) => (
        <mesh key={i} position={[0, 1.6 - i * 0.9, -20 + i * 3.4]}>
          <planeGeometry args={[70 - i * 10, 9 - i * 1.6]} />
          <meshBasicMaterial map={t} transparent depthWrite={false} fog={false} />
        </mesh>
      ))}
      {/* canyon floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.6, -4]}>
        <planeGeometry args={[80, 40]} />
        <meshStandardMaterial color="#2e1608" roughness={1} />
      </mesh>
    </group>
  );
}

/** The timber viaduct and the little ore train that crosses it during wins. */
function Viaduct({ running, color }: { running: boolean; color: TrainColor }) {
  const train = useRef<THREE.Group>(null);
  const x = useRef(-14);
  const wheels = useRef<THREE.Mesh[]>([]);
  const glow = TRAIN_HEX[color]?.glow ?? '#fcd34d';

  useFrame((_, dt) => {
    const g = train.current;
    if (!g) return;
    const speed = running ? 4.6 : 1.15;
    x.current += dt * speed;
    if (x.current > 16) x.current = -16;
    g.position.x = x.current;
    g.position.y = 3.62 + Math.sin(x.current * 2.6) * 0.014;
    wheels.current.forEach((w) => {
      if (w) w.rotation.z -= dt * speed * 2.4;
    });
  });

  const timber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a3416', roughness: 0.85 }), []);
  return (
    <group position={[0, 0, -9]}>
      {/* deck */}
      <mesh position={[0, 3.35, 0]} material={timber}>
        <boxGeometry args={[34, 0.18, 0.85]} />
      </mesh>
      {/* trestle legs */}
      {Array.from({ length: 9 }).map((_, i) => {
        const lx = (i - 4) * 3.9;
        return (
          <group key={i}>
            <mesh position={[lx - 0.55, 0.05, 0]} rotation={[0, 0, 0.16]} material={timber}>
              <boxGeometry args={[0.22, 6.6, 0.55]} />
            </mesh>
            <mesh position={[lx + 0.55, 0.05, 0]} rotation={[0, 0, -0.16]} material={timber}>
              <boxGeometry args={[0.22, 6.6, 0.55]} />
            </mesh>
            <mesh position={[lx, 1.35, 0]} material={timber}>
              <boxGeometry args={[1.75, 0.16, 0.5]} />
            </mesh>
          </group>
        );
      })}
      {/* the train */}
      <group ref={train} position={[0, 3.62, 0]}>
        {/* locomotive */}
        <group>
          <mesh position={[0.62, 0.34, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 1.15, 14]} />
            <meshStandardMaterial color="#3a3f46" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0.62, 0.34, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.27, 0.27, 1.1, 14]} />
            <meshStandardMaterial color="#23272d" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[-0.05, 0.42, 0]}>
            <boxGeometry args={[0.62, 0.66, 0.5]} />
            <meshStandardMaterial color={glow} metalness={0.35} roughness={0.5} />
          </mesh>
          <mesh position={[1.06, 0.78, 0]}>
            <cylinderGeometry args={[0.09, 0.14, 0.34, 10]} />
            <meshStandardMaterial color="#1c1f24" />
          </mesh>
          {[-0.28, 0.5, 1.0].map((wx, i) => (
            <mesh
              key={i}
              ref={(el) => { if (el) wheels.current[i] = el; }}
              position={[wx, 0.02, 0.26]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.17, 0.17, 0.06, 16]} />
              <meshStandardMaterial color="#c9932e" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
        {/* two ore cars */}
        {[1, 2].map((i) => (
          <group key={i} position={[-i * 1.28, 0, 0]}>
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[1.0, 0.42, 0.5]} />
              <meshStandardMaterial color="#5a3416" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.55, 0]}>
              <boxGeometry args={[0.85, 0.16, 0.4]} />
              <meshStandardMaterial color="#ffd25f" emissive="#a97b16" emissiveIntensity={0.6} metalness={0.6} roughness={0.35} />
            </mesh>
            {[-0.3, 0.3].map((wx, j) => (
              <mesh
                key={j}
                ref={(el) => { if (el) wheels.current[3 + i * 2 + j] = el; }}
                position={[wx, 0.02, 0.26]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.14, 0.14, 0.06, 14]} />
                <meshStandardMaterial color="#c9932e" metalness={0.8} roughness={0.3} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/** The mine cart beside the cabinet, filling with ore as the meter climbs. */
function MineCart({ level }: { level: number }) {
  const ore = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ore.current;
    if (!m) return;
    const target = 0.12 + level * 0.5;
    m.scale.y += (target - m.scale.y) * 0.08;
    m.position.y = -2.62 + m.scale.y * 0.35;
  });
  return (
    <group position={[4.6, 0, -1.4]} rotation={[0, -0.5, 0]}>
      <mesh position={[0, -2.6, 0]}>
        <boxGeometry args={[1.5, 0.9, 1.0]} />
        <meshStandardMaterial color="#4a2c12" roughness={0.85} />
      </mesh>
      <mesh ref={ore} position={[0, -2.4, 0]}>
        <sphereGeometry args={[0.62, 12, 8]} />
        <meshStandardMaterial color="#ffd25f" emissive="#b8860b" emissiveIntensity={0.9} metalness={0.5} roughness={0.4} />
      </mesh>
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, -3.12, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.08, 14]} />
          <meshStandardMaterial color="#2c2c30" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ camera */

function Rig({ free, train }: { free: boolean; train: boolean }) {
  const { camera, pointer, size } = useThree();
  useFrame(() => {
    // Pull back on narrow stages: the machine must fit the horizontal FOV,
    // which shrinks with aspect on portrait phones.
    const aspect = size.width / Math.max(1, size.height);
    const fit = (WINDOW_W / 2 + 1.35) / (Math.tan((38 * Math.PI) / 360) * aspect);
    const base = Math.max(12.4, fit);
    const back = train ? 2.4 : 0;
    const tx = pointer.x * 0.55;
    const ty = 0.42 + pointer.y * 0.3;
    camera.position.x += (tx - camera.position.x) * 0.05;
    camera.position.y += (ty - camera.position.y) * 0.05;
    camera.position.z += (base + back - camera.position.z) * 0.04;
    camera.lookAt(0, 0.2, 0);
  });
  useEffect(() => {
    (camera as THREE.PerspectiveCamera).fov = 38;
    camera.updateProjectionMatrix?.();
  }, [camera]);
  return <fog attach="fog" args={[free ? '#5c1e10' : '#6b3413', 26, 74]} />;
}

/* ------------------------------------------------------------------- stage */

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  render() {
    return this.state.broken ? this.props.fallback : this.props.children;
  }
}

export default function Goldmine3DStage(props: Stage3DProps) {
  const { spin, plan, spinning, spinKey, free, showWins, collected, train, cartLevel, winStrength } = props;
  const lit = showWins && (spin?.linesTotal ?? 0) > 0;

  return (
    <GLBoundary
      fallback={
        <div className="grid h-full place-items-center rounded-2xl bg-void-950/70 p-8 text-center text-sm text-slate-500">
          3D is not available on this device — the reels below still play with full provably-fair logic.
        </div>
      }
    >
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 38, position: [0, 0.35, 12.4] }}
      >
        <color attach="background" args={[free ? '#3d1208' : '#59260c']} />
        <Rig free={free} train={train.active} />

        <ambientLight intensity={free ? 0.45 : 0.62} color={free ? '#ffb08a' : '#ffd9a0'} />
        <directionalLight position={[6, 8, 5]} intensity={free ? 1.0 : 1.35} color="#ffca7a" />
        <pointLight position={[0, 0.4, 3.2]} intensity={6 + winStrength * 26} color="#ffdf8e" distance={12} decay={2} />

        <Canyon />
        <Viaduct running={train.active || collected || free} color={train.color} />
        <MineCart level={cartLevel} />

        <group position={[0, 0.15, 0]}>
          <Cabinet spinning={spinning} lit={lit || collected} />
          <Reels spin={spin} plan={plan} spinning={spinning} spinKey={spinKey} showWins={showWins} />
        </group>

        <Sparkles count={90} scale={[16, 8, 8]} position={[0, 1.4, -3]} size={2.4} speed={0.25} color="#ffd980" opacity={0.55} />

        <EffectComposer multisampling={0} resolutionScale={0.5} enableNormalPass={false}>
          {/* threshold above 1: only true emitters (lamps, marquee) bloom — the
              parchment reels stay crisp instead of washing white */}
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1.0} luminanceSmoothing={0.25} />
          <Vignette eskil={false} offset={0.18} darkness={0.72} />
        </EffectComposer>
      </Canvas>
    </GLBoundary>
  );
}

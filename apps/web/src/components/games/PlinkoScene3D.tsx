'use client';

import { Component, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Trail, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

/**
 * Plinko in 3D — a real board: brass pins in a triangular field, rails, a
 * glowing ball that falls row by row with a squash at every pin it kisses,
 * and a hot column of light where it lands. The DOM keeps the bucket labels;
 * the 3D layer owns the drama.
 */

export interface PlinkoBall {
  id: string;
  /** 0/1 per row: 0 = left, 1 = right */
  path: number[];
  bucket: number;
}

export interface PlinkoScene3DProps {
  rows: number;
  balls: PlinkoBall[];
  onLand: (ball: PlinkoBall) => void;
}

const SPEED_PER_ROW = 0.085; // seconds per row, matches the DOM deal
const PEG_GAP_X = 0.62;
const ROW_GAP_Y = 0.52;
const TOP_Y = 3.1;

/** Board x for a given path state: sr rights taken after r rows. */
const ballX = (sr: number, r: number, rows: number) => ((2 * sr - r) / (2 * rows)) * (rows * PEG_GAP_X);

function PegField({ rows }: { rows: number }) {
  const geo = useMemo(() => new THREE.SphereGeometry(0.075, 10, 8), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.25 }),
    [],
  );
  const pegs = useMemo(() => {
    const out: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      const y = TOP_Y - r * ROW_GAP_Y;
      for (let i = 0; i < count; i++) {
        out.push([(i - (count - 1) / 2) * PEG_GAP_X, y]);
      }
    }
    return out;
  }, [rows]);
  return (
    <group>
      {pegs.map(([x, y], i) => (
        <mesh key={i} geometry={geo} material={mat} position={[x, y, 0]} />
      ))}
    </group>
  );
}

function Ball({ rows, ball, onLand }: { rows: number; ball: PlinkoBall; onLand: (b: PlinkoBall) => void }) {
  const grp = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  const done = useRef(false);
  const landed = useRef(false);
  const total = rows * SPEED_PER_ROW;

  useFrame((_s, dt) => {
    const g = grp.current;
    if (!g || done.current) return;
    t.current += dt;
    const x01 = Math.min(1, t.current / total);
    const progress = x01 * rows;
    const r = Math.min(rows, Math.floor(progress));
    const frac = progress - r;

    // position along the path: smooth between row r and r+1
    const sr = ball.path.slice(0, r).reduce((a, b) => a + b, 0);
    const srNext = sr + (ball.path[r] ?? 0);
    const x0 = ballX(sr, r, rows);
    const x1 = ballX(srNext, Math.min(rows, r + 1), rows);
    // sine ease between rows + a little gravity dip
    const k = (1 - Math.cos(frac * Math.PI)) / 2;
    const x = x0 + (x1 - x0) * k;
    const y = TOP_Y - progress * ROW_GAP_Y - Math.sin(frac * Math.PI) * 0.09;
    g.position.set(x, y, 0.1);

    // squash each time the ball crosses a pin
    const pulse = Math.abs(Math.sin(frac * Math.PI));
    g.scale.set(1 - pulse * 0.18, 1 - pulse * 0.3, 1 - pulse * 0.18);

    if (glow.current) glow.current.intensity = 6 + pulse * 5;

    if (x01 >= 1 && !landed.current) {
      landed.current = true;
      done.current = true;
      onLand(ball);
    }
  });

  return (
    <group ref={grp} position={[0, TOP_Y, 0.1]}>
      <Trail width={1.1} length={5} color={new THREE.Color('#a855f7')} attenuation={(t) => t * t}>
        <mesh>
          <sphereGeometry args={[0.11, 16, 14]} />
          <meshStandardMaterial color="#e9d5ff" emissive="#a855f7" emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      </Trail>
      <pointLight ref={glow} color="#a855f7" intensity={7} distance={3.5} />
    </group>
  );
}

function LandingGlow({ rows, bucket }: { rows: number; bucket: number | null }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s, dt) => {
    const m = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (!m) return;
    const target = bucket !== null ? 0.5 + Math.sin(s.clock.elapsedTime * 6) * 0.3 : 0;
    m.opacity = THREE.MathUtils.damp(m.opacity, target, 8, dt);
  });
  const buckets = rows + 1;
  const x = bucket === null ? 0 : (bucket - (buckets - 1) / 2) * PEG_GAP_X * 1.05;
  return (
    <mesh ref={ref} position={[x, TOP_Y - rows * ROW_GAP_Y - 0.25, 0]}>
      <cylinderGeometry args={[0.3, 0.42, 1.4, 16, 1, true]} />
      <meshBasicMaterial color="#10f5a0" transparent opacity={0} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function CamRig({ rows }: { rows: number }) {
  const look = useMemo(() => new THREE.Vector3(0, TOP_Y - rows * ROW_GAP_Y * 0.5, 0), [rows]);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    s.camera.position.x = THREE.MathUtils.damp(s.camera.position.x, Math.sin(t * 0.25) * 0.35, 2, dt);
    s.camera.position.y = THREE.MathUtils.damp(s.camera.position.y, look.y + 0.7, 2, dt);
    s.camera.position.z = THREE.MathUtils.damp(s.camera.position.z, 4.4 + rows * 0.42, 2, dt);
    s.camera.lookAt(look);
  });
  return null;
}

function Board({ rows, balls, onLand }: PlinkoScene3DProps) {
  const [landedBucket, setLandedBucket] = useState<number | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const width = (rows + 2) * PEG_GAP_X + 0.6;
  const height = rows * ROW_GAP_Y + 1.9;

  const handleLand = (b: PlinkoBall) => {
    setLandedBucket(b.bucket);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setLandedBucket(null), 900);
    onLand(b);
  };

  return (
    <>
      <color attach="background" args={['#070914']} />
      <fog attach="fog" args={['#070914', 8, 22]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, TOP_Y + 2, 3]} color="#a855f7" intensity={9} distance={14} />
      <pointLight position={[-4, 0, 2]} color="#22d3ee" intensity={4} distance={12} />

      {/* board backplate */}
      <mesh position={[0, TOP_Y - rows * ROW_GAP_Y * 0.5 + 0.3, -0.35]}>
        <boxGeometry args={[width, height, 0.14]} />
        <meshStandardMaterial color="#0d1128" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* rails */}
      {[-width / 2, width / 2].map((x, i) => (
        <mesh key={i} position={[x, TOP_Y - rows * ROW_GAP_Y * 0.5 + 0.3, -0.1]}>
          <boxGeometry args={[0.14, height, 0.34]} />
          <meshStandardMaterial color="#8a5f22" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      {/* funnel */}
      <mesh position={[0, TOP_Y + 0.55, 0]}>
        <cylinderGeometry args={[0.42, 0.16, 0.5, 20, 1, true]} />
        <meshStandardMaterial color="#8a5f22" metalness={0.85} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* bucket dividers */}
      {Array.from({ length: rows + 2 }).map((_, i) => (
        <mesh key={i} position={[(i - (rows + 1) / 2) * PEG_GAP_X * 1.05, TOP_Y - rows * ROW_GAP_Y - 0.15, -0.05]}>
          <boxGeometry args={[0.05, 0.7, 0.3]} />
          <meshStandardMaterial color="#3a3f6a" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      <PegField rows={rows} />
      <Sparkles count={24} scale={[width, height, 2]} size={2.5} speed={0.25} color="#a855f7" position={[0, 0.6, 1]} />
      {balls.map((b) => (
        <Ball key={b.id} rows={rows} ball={b} onLand={handleLand} />
      ))}
      <LandingGlow rows={rows} bucket={landedBucket} />

      <CamRig rows={rows} />
      <EffectComposer>
        <Bloom mipmapBlur intensity={0.95} luminanceThreshold={0.28} luminanceSmoothing={0.9} />
        <Vignette eskil={false} offset={0.26} darkness={0.8} />
      </EffectComposer>
    </>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function PlinkoScene3D(props: PlinkoScene3DProps) {
  return (
    <GLErrorBoundary fallback={null}>
      <Canvas dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 48, position: [0, 1, 9] }}>
        <Board {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The tower behind the Towers grid — a monolith of glowing floors in the
 * night, climbing as the player does. Cleared floors burn green, the active
 * floor breathes violet, a bust floods the tower red, a cash-out gilds it.
 * The DOM grid in front stays the interactive layer; this canvas is the
 * scenography that makes the climb feel like a climb.
 *
 * Kept deliberately light: one slab + one edge glow per floor, refs written
 * in useFrame, no postprocessing, DPR capped.
 */

export interface TowersScene3DProps {
  rows: number;
  /** rows cleared so far */
  level: number;
  phase: 'idle' | 'playing' | 'busted' | 'cashed';
}

const FLOOR_H = 0.62;
const COL_IDLE = new THREE.Color('#232948');
const COL_CLEARED = new THREE.Color('#0f8a5f');
const COL_CURRENT = new THREE.Color('#7c3aed');
const COL_BUST = new THREE.Color('#b91c3c');
const COL_CASH = new THREE.Color('#d9a334');
const EDGE_IDLE = new THREE.Color('#2d3563');
const EDGE_CLEARED = new THREE.Color('#10f5a0');
const EDGE_CURRENT = new THREE.Color('#a855f7');
const EDGE_BUST = new THREE.Color('#ff3b6b');
const EDGE_CASH = new THREE.Color('#ffd25f');

function Tower({ rows, level, phase }: TowersScene3DProps) {
  const slabMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const edgeMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const group = useRef<THREE.Group>(null);
  const bustAt = useRef(0);
  const lastPhase = useRef<string>('idle');

  useFrame(({ clock, camera }, dt) => {
    const t = clock.elapsedTime;
    if (phase !== lastPhase.current) {
      lastPhase.current = phase;
      if (phase === 'busted') bustAt.current = performance.now();
    }
    const sinceBust = (performance.now() - bustAt.current) / 1000;

    for (let i = 0; i < rows; i++) {
      const slab = slabMats.current[i];
      const edge = edgeMats.current[i];
      if (!slab || !edge) continue;
      const cleared = i < level;
      const current = phase === 'playing' && i === level;
      let slabTarget = cleared ? COL_CLEARED : COL_IDLE;
      let edgeTarget = cleared ? EDGE_CLEARED : EDGE_IDLE;
      let glow = cleared ? 0.75 : 0.25;
      if (current) {
        slabTarget = COL_CURRENT;
        edgeTarget = EDGE_CURRENT;
        glow = 0.9 + Math.sin(t * 4.5) * 0.35;
      }
      if (phase === 'busted') {
        slabTarget = COL_BUST;
        edgeTarget = EDGE_BUST;
        glow = Math.max(0.3, 1.4 - sinceBust * 1.1);
      } else if (phase === 'cashed' && cleared) {
        slabTarget = COL_CASH;
        edgeTarget = EDGE_CASH;
        glow = 1.1 + Math.sin(t * 6) * 0.2;
      }
      slab.color.lerp(slabTarget, 1 - Math.exp(-dt * 6));
      slab.emissive.copy(slab.color);
      slab.emissiveIntensity = glow * 0.45;
      edge.color.lerp(edgeTarget, 1 - Math.exp(-dt * 6));
      edge.opacity = Math.min(1, glow);
    }

    // the camera rides the climb, with a tremor on the bust
    const targetY = level * FLOOR_H + 1.4;
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 2, dt);
    const shake = phase === 'busted' && sinceBust < 0.5 ? (0.5 - sinceBust) * 0.12 : 0;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3, dt) + (Math.random() - 0.5) * shake;
    camera.lookAt(0, targetY - 0.4, 0);
    if (group.current) group.current.rotation.y = Math.sin(t * 0.12) * 0.16;
  });

  return (
    <group ref={group}>
      {Array.from({ length: rows }).map((_, i) => {
        const w = 3.1 - i * 0.12;
        return (
          <group key={i} position={[0, i * FLOOR_H, 0]}>
            <mesh>
              <boxGeometry args={[w, FLOOR_H * 0.55, 1.7]} />
              <meshStandardMaterial
                ref={(m) => { slabMats.current[i] = m; }}
                color="#232948"
                metalness={0.6}
                roughness={0.42}
              />
            </mesh>
            {/* the floor's light line */}
            <mesh position={[0, -FLOOR_H * 0.02, 0.88]}>
              <planeGeometry args={[w * 0.96, 0.05]} />
              <meshBasicMaterial
                ref={(m) => { edgeMats.current[i] = m; }}
                color="#2d3563"
                transparent
                opacity={0.4}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
      {/* crown beacon */}
      <mesh position={[0, rows * FLOOR_H + 0.25, 0]}>
        <coneGeometry args={[0.4, 0.7, 4]} />
        <meshStandardMaterial color="#d9a334" metalness={0.85} roughness={0.3} emissive="#7a5410" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function Backdrop() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#0b0920');
    g.addColorStop(0.55, '#151238');
    g.addColorStop(1, '#241a4d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
  }, []);
  const { size } = useThree();
  void size;
  return (
    <mesh position={[0, 2.4, -6]}>
      <planeGeometry args={[40, 26]} />
      <meshBasicMaterial map={tex} fog={false} />
    </mesh>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function TowersScene3D(props: TowersScene3DProps) {
  return (
    <GLErrorBoundary>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 42, position: [0, 1.4, 7.2] }}>
        <fog attach="fog" args={['#0b0920', 9, 22]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 5]} intensity={1.1} color="#dbe4ff" />
        <pointLight position={[-4, 3, 3]} color="#a855f7" intensity={6} distance={14} decay={2} />
        <pointLight position={[4, 5, 3]} color="#22d3ee" intensity={4} distance={14} decay={2} />
        <Backdrop />
        <Tower {...props} />
        <Sparkles count={46} scale={[10, 9, 6]} size={2} speed={0.2} color="#8b7cf7" opacity={0.5} position={[0, 2.6, -1]} />
      </Canvas>
    </GLErrorBoundary>
  );
}

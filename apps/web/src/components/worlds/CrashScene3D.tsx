'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Trail, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { ShipMesh, shipById, type ShipSkin } from './ships';

export interface CrashShip {
  wallet: string;
  cashedAt: number | null;
  ship?: string;
}

export interface CrashScene3DProps {
  multiplier: number;
  status: 'idle' | 'flying' | 'busted';
  accent?: string;
  ships?: CrashShip[];
  skin?: ShipSkin;
}

const heightFor = (m: number) => Math.min(64, Math.log(Math.max(1, m)) * 7);

function Rocket({ multiplier, status, skin }: { multiplier: number; status: string; skin: ShipSkin }) {
  const grp = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const g = grp.current;
    if (!g) return;
    const targetY = status === 'busted' ? g.position.y : heightFor(multiplier);
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, 6, dt);
    g.position.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.7;
    g.rotation.z = -g.position.x * 0.14;
    g.visible = status !== 'busted';
    // camera chases the rocket
    state.camera.position.y = THREE.MathUtils.damp(state.camera.position.y, g.position.y + 1.5, 5, dt);
    state.camera.position.x = THREE.MathUtils.damp(state.camera.position.x, g.position.x * 0.3, 4, dt);
    state.camera.lookAt(0, g.position.y, 0);
  });
  return (
    <group ref={grp}>
      <Trail width={3.5} length={skin.trail} color={new THREE.Color(skin.color)} attenuation={(t) => t * t}>
        <group ref={anchor}>
          <ShipMesh skin={skin} emissive={1.4} />
        </group>
      </Trail>
      <pointLight color={skin.color} intensity={9} distance={14} />
    </group>
  );
}

function Explosion({ show, accent, at }: { show: boolean; accent: string; at: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const life = useRef(0);
  useFrame((_s, dt) => {
    if (!ref.current) return;
    if (show) {
      life.current = Math.min(1, life.current + dt * 1.6);
      const s = 0.4 + life.current * 6;
      ref.current.scale.setScalar(s);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - life.current);
      ref.current.visible = true;
    } else {
      life.current = 0;
      ref.current.visible = false;
    }
  });
  return (
    <group position={[0, at, 0]}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.8} />
      </mesh>
      {show && <Sparkles count={40} scale={6} size={6} speed={2} color="#ff5c3c" position={[0, 0, 0]} />}
    </group>
  );
}

/** The other players in the room, riding their own ships in a ring. */
function Ships({ ships, baseY }: { ships: CrashShip[]; baseY: number }) {
  const grp = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (grp.current) {
      grp.current.position.y = baseY;
      grp.current.rotation.y += dt * 0.12;
    }
  });
  const n = Math.min(24, ships.length);
  return (
    <group ref={grp}>
      {ships.slice(0, 24).map((s, i) => {
        const a = (i / Math.max(1, n)) * Math.PI * 2;
        const r = 2.6 + (i % 3) * 0.6;
        const cashed = s.cashedAt !== null;
        const sk = shipById(s.ship || 'dart');
        return (
          <group key={i} position={[Math.cos(a) * r, cashed ? 2.2 + i * 0.12 : 0, Math.sin(a) * r]} rotation={[0.2, -a, 0]}>
            <ShipMesh skin={cashed ? { ...sk, color: '#10f5a0', glow: '#6ee7b7' } : sk} scale={0.42} emissive={cashed ? 1.6 : 1} />
          </group>
        );
      })}
    </group>
  );
}

function Scene({ multiplier, status, ships = [], skin }: CrashScene3DProps) {
  const rocketY = heightFor(multiplier);
  const s = skin ?? shipById('dart');
  return (
    <>
      <color attach="background" args={['#05060f']} />
      <fog attach="fog" args={['#05060f', 10, 40]} />
      <ambientLight intensity={0.4} />
      <Stars radius={100} depth={60} count={2600} factor={5} saturation={0} fade speed={1.2} />
      <Rocket multiplier={multiplier} status={status} skin={s} />
      <Ships ships={ships} baseY={rocketY} />
      <Explosion show={status === 'busted'} accent="#ff3b6b" at={rocketY} />
    </>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function CrashScene3D(props: CrashScene3DProps) {
  const fallback = useMemo(() => <div className="grid h-full min-h-[320px] place-items-center text-sm text-slate-500">3D unavailable — round still runs.</div>, []);
  return (
    <GLErrorBoundary fallback={fallback}>
      <Canvas dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: 55, position: [0, 2, 12] }}>
        <Scene {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

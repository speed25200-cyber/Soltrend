'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Trail, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

export interface CrashShip {
  wallet: string;
  cashedAt: number | null;
}

export interface CrashScene3DProps {
  multiplier: number;
  status: 'idle' | 'flying' | 'busted';
  accent?: string;
  ships?: CrashShip[];
}

const heightFor = (m: number) => Math.min(64, Math.log(Math.max(1, m)) * 7);

function Rocket({ multiplier, status, accent }: { multiplier: number; status: string; accent: string }) {
  const grp = useRef<THREE.Group>(null);
  const nose = useRef<THREE.Mesh>(null);
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
    if (nose.current) (nose.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(state.clock.elapsedTime * 12) * 0.3;
  });
  return (
    <group ref={grp}>
      <Trail width={3.5} length={7} color={new THREE.Color(accent)} attenuation={(t) => t * t}>
        <mesh ref={nose} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.36, 1.15, 18]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.3} metalness={0.5} roughness={0.2} />
        </mesh>
      </Trail>
      {/* fins */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.3, 0.5, 12]} />
        <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
      </mesh>
      <pointLight color={accent} intensity={9} distance={14} />
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

/** Little orbiting markers for the other players in the room. */
function Ships({ ships, baseY, accent }: { ships: CrashShip[]; baseY: number; accent: string }) {
  const grp = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (grp.current) grp.current.position.y = baseY;
  });
  return (
    <group ref={grp}>
      {ships.slice(0, 24).map((s, i) => {
        const a = (i / Math.max(1, Math.min(24, ships.length))) * Math.PI * 2;
        const r = 2.4 + (i % 3) * 0.5;
        const cashed = s.cashedAt !== null;
        return (
          <mesh key={i} position={[Math.cos(a) * r, cashed ? 2 + i * 0.1 : 0, Math.sin(a) * r]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color={cashed ? '#10f5a0' : accent} emissive={cashed ? '#10f5a0' : accent} emissiveIntensity={1} />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({ multiplier, status, accent = '#a855f7', ships = [] }: CrashScene3DProps) {
  const rocketY = heightFor(multiplier);
  return (
    <>
      <color attach="background" args={['#05060f']} />
      <fog attach="fog" args={['#05060f', 10, 40]} />
      <ambientLight intensity={0.4} />
      <Stars radius={100} depth={60} count={2600} factor={5} saturation={0} fade speed={1.2} />
      <Rocket multiplier={multiplier} status={status} accent={accent} />
      <Ships ships={ships} baseY={rocketY} accent={accent} />
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

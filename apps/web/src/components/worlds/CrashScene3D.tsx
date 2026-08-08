'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Trail, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing';
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

/** Shared impulse channel: the bust sets it, the camera + fringe consume it. */
const shake = { v: 0 };

function Rocket({ multiplier, status, skin }: { multiplier: number; status: string; skin: ShipSkin }) {
  const grp = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  const engine = useRef<THREE.PointLight>(null);
  useFrame((state, dt) => {
    const g = grp.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const targetY = status === 'busted' ? g.position.y : heightFor(multiplier);
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, 6, dt);
    g.position.x = Math.sin(t * 0.8) * 0.7;
    // bank into the sway; a touch of vibration at speed sells the acceleration
    g.rotation.z = -g.position.x * 0.14 + (status === 'flying' ? Math.sin(t * 31) * 0.012 : 0);
    g.visible = status !== 'busted';
    if (engine.current) {
      engine.current.intensity = status === 'flying' ? 10 + Math.sin(t * 24) * 3 : 6;
    }
    // camera chases the rocket, with a decaying jolt after the bust
    const sx = shake.v > 0.001 ? (Math.random() - 0.5) * shake.v : 0;
    const sy = shake.v > 0.001 ? (Math.random() - 0.5) * shake.v : 0;
    shake.v = THREE.MathUtils.damp(shake.v, 0, 3.2, dt);
    state.camera.position.y = THREE.MathUtils.damp(state.camera.position.y, g.position.y + 1.5, 5, dt) + sy;
    state.camera.position.x = THREE.MathUtils.damp(state.camera.position.x, g.position.x * 0.3, 4, dt) + sx;
    state.camera.lookAt(0, g.position.y, 0);
  });
  return (
    <group ref={grp}>
      <Trail width={3.5} length={skin.trail} color={new THREE.Color(skin.color)} attenuation={(t) => t * t}>
        <group ref={anchor}>
          <ShipMesh skin={skin} emissive={1.4} />
        </group>
      </Trail>
      <pointLight ref={engine} color={skin.color} intensity={9} distance={14} />
    </group>
  );
}

/** Streaking particles that sell velocity — they rush past while flying. */
function SpeedField({ status, multiplier }: { status: string; multiplier: number }) {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 420;
  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const r = 2.5 + Math.random() * 9;
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.random() * 70 - 4;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, []);
  useFrame((_s, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
    // speed follows the multiplier curve — faster as the round heats up
    const v = status === 'flying' ? 14 + Math.min(60, multiplier * 6) : 1.2;
    for (let i = 0; i < COUNT; i++) {
      let y = attr.getY(i) - v * dt;
      if (y < -6) y += 76;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
    (pts.material as THREE.PointsMaterial).opacity = status === 'flying' ? 0.85 : 0.25;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#c4b5fd" size={0.07} transparent opacity={0.4} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Explosion({ show, accent, at }: { show: boolean; accent: string; at: number }) {
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.PointLight>(null);
  const life = useRef(0);
  useFrame((_s, dt) => {
    if (show) {
      life.current = Math.min(1, life.current + dt * 1.5);
      if (life.current === dt * 1.5) shake.v = 0.9; // first frame of the bust → kick the camera
      const l = life.current;
      if (core.current) {
        core.current.scale.setScalar(0.4 + l * 6);
        (core.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - l);
        core.current.visible = true;
      }
      // shockwave ring racing outward, tilted like a halo around the blast
      if (ring.current) {
        ring.current.scale.setScalar(0.5 + l * 9);
        (ring.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - l * 1.1);
        ring.current.visible = true;
      }
      if (flash.current) flash.current.intensity = Math.max(0, 90 * (1 - l * 1.4));
    } else {
      life.current = 0;
      if (core.current) core.current.visible = false;
      if (ring.current) ring.current.visible = false;
      if (flash.current) flash.current.intensity = 0;
    }
  });
  return (
    <group position={[0, at, 0]}>
      <mesh ref={core}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.8} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[1, 0.05, 8, 48]} />
        <meshBasicMaterial color="#ffb0c2" transparent opacity={0.9} />
      </mesh>
      <pointLight ref={flash} color={accent} intensity={0} distance={30} />
      {show && <Sparkles count={70} scale={7} size={7} speed={2.4} color="#ff5c3c" position={[0, 0, 0]} />}
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

/** Distant launch grid far below — a sense of altitude. */
function LaunchGrid() {
  return (
    <group position={[0, -4, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#070912" metalness={0.7} roughness={0.5} />
      </mesh>
      <gridHelper args={[80, 40, '#a855f7', '#141a33']} position={[0, 0.02, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.6, 2.1, 48]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
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
      {/* cool key from above, warm fill from below — the launch-pad glow */}
      <directionalLight position={[4, 8, 4]} intensity={0.5} color="#c4b5fd" />
      <pointLight position={[0, -3, 3]} color="#d946ef" intensity={6} distance={18} />
      <Stars radius={100} depth={60} count={2600} factor={5} saturation={0} fade speed={1.2} />
      <SpeedField status={status} multiplier={multiplier} />
      <LaunchGrid />
      <Rocket multiplier={multiplier} status={status} skin={s} />
      <Ships ships={ships} baseY={rocketY} />
      <Explosion show={status === 'busted'} accent="#ff3b6b" at={rocketY} />

      <EffectComposer>
        <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.22} luminanceSmoothing={0.85} />
        <ChromaticAberration offset={new THREE.Vector2(0.0006, 0.0009)} radialModulation modulationOffset={0.35} />
        <Noise premultiply opacity={0.08} />
        <Vignette eskil={false} offset={0.24} darkness={0.78} />
      </EffectComposer>
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

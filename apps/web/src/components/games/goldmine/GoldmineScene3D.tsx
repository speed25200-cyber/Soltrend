'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { TrainColor } from '@/lib/slots/gold-express';
import { TRAIN_HEX } from './ExpressSymbols';
import { SlotMachine, MachineCam, type Machine3DProps } from './SlotMachine3D';

/**
 * The Gold Mine Express in 3D — the living mine around the reels. Wooden
 * headframes, lantern light, rails, drifting gold dust; a mine cart that
 * visibly fills with ore as the meter climbs and tips over on the drop; a
 * coin eruption on every collect and big win; and the bonus train that
 * physically rides through the shaft while the carriages pay out.
 *
 * When `machine` is set, the slot machine itself takes centre stage as a full
 * 3D cabinet with cylindrical reels — the DOM layer keeps only the HUD.
 */

export interface Scene3DProps {
  /** 0..1 — how full the mine cart is */
  cartLevel: number;
  /** increments when the cart tips over */
  dropSignal: number;
  /** increments on any win — strength scales the eruption */
  winSignal: number;
  winStrength: number; // 0..1
  collectSignal: number;
  train: { active: boolean; color: TrainColor; step: number; count: number };
  /** the 3D slot machine — set to put it centre stage */
  machine?: (Machine3DProps & { active: boolean }) | null;
}

/* ------------------------------------------------------------------- set */

function Headframe({ x }: { x: number }) {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a2f16', roughness: 0.85, metalness: 0.05 }), []);
  return (
    <group position={[x, 0, -1.6]}>
      <mesh material={wood} position={[-1.7, 2.1, 0]} rotation={[0, 0, 0.32]}>
        <boxGeometry args={[0.28, 4.6, 0.28]} />
      </mesh>
      <mesh material={wood} position={[1.7, 2.1, 0]} rotation={[0, 0, -0.32]}>
        <boxGeometry args={[0.28, 4.6, 0.28]} />
      </mesh>
      <mesh material={wood} position={[0, 4.05, 0]}>
        <boxGeometry args={[3.9, 0.3, 0.3]} />
      </mesh>
      <mesh material={wood} position={[0, 2.4, 0]} rotation={[0, 0, 0.62]}>
        <boxGeometry args={[3.4, 0.2, 0.2]} />
      </mesh>
      <mesh material={wood} position={[0, 2.4, 0]} rotation={[0, 0, -0.62]}>
        <boxGeometry args={[3.4, 0.2, 0.2]} />
      </mesh>
    </group>
  );
}

function Lantern({ position, color = '#ffb35c' }: { position: [number, number, number]; color?: string }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame((s) => {
    if (ref.current) {
      const t = s.clock.elapsedTime;
      ref.current.intensity = 9 + Math.sin(t * 7 + position[0]) * 1.6 + Math.sin(t * 13) * 0.8;
    }
  });
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight ref={ref} color={color} intensity={9} distance={12} decay={1.6} />
    </group>
  );
}

function Rails() {
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3f4a', metalness: 0.9, roughness: 0.35 }), []);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2e1d0e', roughness: 0.9 }), []);
  return (
    <group position={[0, 0.02, 1.9]}>
      <mesh material={steel} position={[-0.55, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 16, 8]} />
      </mesh>
      <mesh material={steel} position={[0.55, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 16, 8]} />
      </mesh>
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} material={wood} position={[0, 0, -7.5 + i * 1.15]}>
          <boxGeometry args={[1.5, 0.06, 0.28]} />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- mine cart */

function MineCart({ level, dropSignal }: { level: number; dropSignal: number }) {
  const grp = useRef<THREE.Group>(null);
  const ore = useRef<THREE.Group>(null);
  const tip = useRef(0);
  const lastDrop = useRef(dropSignal);
  useFrame((s, dt) => {
    const g = grp.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    if (dropSignal !== lastDrop.current) {
      lastDrop.current = dropSignal;
      tip.current = 1; // start the tip-over
    }
    if (tip.current > 0) tip.current = Math.max(0, tip.current - dt * 0.7);
    // tip right then ease back upright
    const phase = tip.current;
    const angle = phase > 0.5 ? (1 - phase) * 2 * 0.9 : phase * 2 * 0.9;
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, -angle, 8, dt);
    g.position.y = Math.sin(t * 1.4) * 0.02;
    if (ore.current) {
      const target = tip.current > 0 ? 0.05 : Math.max(0.06, level);
      ore.current.scale.y = THREE.MathUtils.damp(ore.current.scale.y, target, 4, dt);
    }
  });
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2f3a', metalness: 0.85, roughness: 0.4 }), []);
  return (
    <group ref={grp} position={[3.6, 0.42, 1.9]} rotation={[0, -0.35, 0]}>
      <mesh material={iron}>
        <boxGeometry args={[1.1, 0.55, 0.8]} />
      </mesh>
      <mesh material={iron} position={[0, 0.32, 0]}>
        <boxGeometry args={[1.22, 0.1, 0.9]} />
      </mesh>
      {/* ore heap — grows with the meter */}
      <group ref={ore} position={[0, 0.3, 0]} scale={[1, 0.06, 1]}>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[((i % 3) - 1) * 0.3, 0.35 + Math.floor(i / 3) * 0.18, ((i * 7) % 3 - 1) * 0.22]}>
            <icosahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color="#fcd34d" emissive="#b45309" emissiveIntensity={0.5} metalness={0.7} roughness={0.25} flatShading />
          </mesh>
        ))}
      </group>
      {[[-0.4, -0.36], [0.4, -0.36], [-0.4, 0.36], [0.4, 0.36]].map(([x, z], i) => (
        <mesh key={i} material={iron} position={[x, -0.32, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 14]} />
        </mesh>
      ))}
      <pointLight color="#fcd34d" intensity={level * 6} distance={3} position={[0, 0.8, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------- coin burst */

const COINS = 64;

function CoinBurst({ signal, strength }: { signal: number; strength: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const vel = useRef(new Float32Array(COINS * 3));
  const pos = useRef(new Float32Array(COINS * 3));
  const life = useRef(0);
  const lastSignal = useRef(signal);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_s, dt) => {
    const m = ref.current;
    if (!m) return;
    if (signal !== lastSignal.current) {
      lastSignal.current = signal;
      life.current = 1.6;
      for (let i = 0; i < COINS; i++) {
        pos.current[i * 3] = 0;
        pos.current[i * 3 + 1] = 2.2;
        pos.current[i * 3 + 2] = 0.6;
        const a = Math.random() * Math.PI * 2;
        const v = (1.6 + Math.random() * 3.2) * (0.6 + strength * 0.8);
        vel.current[i * 3] = Math.cos(a) * v;
        vel.current[i * 3 + 1] = 2.4 + Math.random() * 3.4 * (0.6 + strength);
        vel.current[i * 3 + 2] = Math.sin(a) * v * 0.6;
      }
    }
    if (life.current <= 0) {
      m.count = 0;
      return;
    }
    life.current -= dt;
    m.count = COINS;
    for (let i = 0; i < COINS; i++) {
      vel.current[i * 3 + 1] -= 9.8 * dt;
      pos.current[i * 3] += vel.current[i * 3] * dt;
      pos.current[i * 3 + 1] = Math.max(0.06, pos.current[i * 3 + 1] + vel.current[i * 3 + 1] * dt);
      pos.current[i * 3 + 2] += vel.current[i * 3 + 2] * dt;
      dummy.position.set(pos.current[i * 3], pos.current[i * 3 + 1], pos.current[i * 3 + 2]);
      dummy.rotation.set(_s.clock.elapsedTime * 6 + i, i, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COINS]} frustumCulled={false}>
      <cylinderGeometry args={[0.09, 0.09, 0.025, 12]} />
      <meshStandardMaterial color="#ffd25f" emissive="#b45309" emissiveIntensity={0.9} metalness={0.85} roughness={0.2} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ train */

function BonusTrain({ color, step, count }: { color: TrainColor; step: number; count: number }) {
  const grp = useRef<THREE.Group>(null);
  const hex = TRAIN_HEX[color];
  useFrame((s, dt) => {
    const g = grp.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    // glide in from the right and idle with a gentle roll
    g.position.x = THREE.MathUtils.damp(g.position.x, 0.4, 2.2, dt);
    g.position.y = 0.5 + Math.sin(t * 6) * 0.012;
    g.rotation.y = -Math.PI / 2 + Math.sin(t * 0.5) * 0.02;
  });
  return (
    <group ref={grp} position={[14, 0.5, 1.9]}>
      {/* locomotive */}
      <group>
        <mesh position={[1.6, 0.42, 0]}>
          <boxGeometry args={[1.5, 0.7, 0.8]} />
          <meshStandardMaterial color={hex.a} emissive={hex.b} emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[2.1, 0.95, 0]}>
          <boxGeometry args={[0.6, 0.5, 0.7]} />
          <meshStandardMaterial color={hex.b} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0.95, 0.95, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 0.5, 10]} />
          <meshStandardMaterial color="#1c1917" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[0.85, 0.5, 0]}>
          <sphereGeometry args={[0.14, 10, 10]} />
          <meshBasicMaterial color="#fff7d6" />
        </mesh>
        <pointLight color={hex.glow} intensity={14} distance={7} position={[0.6, 0.6, 0]} />
      </group>
      {/* carriages — light up as they pay */}
      {Array.from({ length: count }).map((_, i) => {
        const lit = i < step;
        return (
          <group key={i} position={[3.1 + i * 1.35, 0.4, 0]}>
            <mesh>
              <boxGeometry args={[1.15, 0.62, 0.75]} />
              <meshStandardMaterial
                color={lit ? hex.a : '#2a2d38'}
                emissive={lit ? hex.glow : '#000000'}
                emissiveIntensity={lit ? 0.7 : 0}
                metalness={0.6}
                roughness={0.35}
              />
            </mesh>
            {lit && (
              <mesh position={[0, 0.5, 0]}>
                <icosahedronGeometry args={[0.2, 0]} />
                <meshStandardMaterial color="#fcd34d" emissive="#b45309" emissiveIntensity={1} flatShading />
              </mesh>
            )}
            {[[-0.38, -0.3], [0.38, -0.3], [-0.38, 0.3], [0.38, 0.3]].map(([x, z], w) => (
              <mesh key={w} position={[x, -0.36, z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.14, 0.14, 0.08, 12]} />
                <meshStandardMaterial color="#14161d" metalness={0.85} roughness={0.4} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ scene */

function Shaft({ cartLevel, dropSignal, winSignal, winStrength, collectSignal, train, machine }: Scene3DProps) {
  const machineActive = !!machine?.active;
  const cam = useRef({ t: 0 });
  useFrame((s, dt) => {
    if (machineActive) return; // MachineCam owns the camera
    // slow cinematic sway
    cam.current.t += dt;
    const t = cam.current.t;
    s.camera.position.x = Math.sin(t * 0.11) * 0.7;
    s.camera.position.y = 2.7 + Math.sin(t * 0.07) * 0.25;
    s.camera.position.z = THREE.MathUtils.damp(s.camera.position.z, 8.6, 2, dt);
    s.camera.lookAt(0, 1.7, 0);
  });
  return (
    <>
      <color attach="background" args={['#0a0603']} />
      <fog attach="fog" args={['#0a0603', 6, 20]} />
      <ambientLight intensity={0.32} color="#ffd9a0" />
      <directionalLight position={[2, 6, 4]} intensity={0.4} color="#ffdcb0" />
      {/* warm key on the machine face */}
      {machineActive && <pointLight position={[0, 1.6, 4.5]} color="#ffe0b0" intensity={5.5} distance={12} />}

      {/* rock walls + floor */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#171009" roughness={0.95} metalness={0.05} />
      </mesh>
      <mesh position={[0, 3.4, -4.2]}>
        <planeGeometry args={[40, 12]} />
        <meshStandardMaterial color="#120b06" roughness={1} />
      </mesh>

      <Headframe x={-3.4} />
      <Headframe x={3.4} />
      <Rails />
      <Lantern position={[-3.1, 3.6, -1.2]} />
      <Lantern position={[3.1, 3.6, -1.2]} />
      <Lantern position={[0, 4.4, -3.4]} color="#ffd25f" />

      <Sparkles count={70} scale={[10, 5, 6]} size={3} speed={0.25} color="#fcd34d" position={[0, 2, 0]} opacity={0.6} />

      {machineActive && (
        <group position={[0, 2.05, 0]} scale={1.3}>
          <SlotMachine {...machine!} />
        </group>
      )}
      <MachineCam spinning={machine?.spinning ?? false} active={machineActive} />

      <MineCart level={cartLevel} dropSignal={dropSignal} />
      <CoinBurst signal={winSignal} strength={winStrength} />
      <CoinBurst signal={collectSignal} strength={0.4} />
      {train.active && <BonusTrain color={train.color} step={train.step} count={train.count} />}

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.3} luminanceSmoothing={0.9} />
        <Vignette eskil={false} offset={0.3} darkness={0.85} />
      </EffectComposer>
    </>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function GoldmineScene3D(props: Scene3DProps) {
  return (
    <GLErrorBoundary fallback={null}>
      <Canvas dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 50, position: [0, 2.7, 8.6] }}>
        <Shaft {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

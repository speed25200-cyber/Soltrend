'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Sparkles, Stars, Trail } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { envDef, ascentLanes, ascentFloors, type WorldSpec, type WorldProp } from '@/lib/forge/world';
import { BOARD_SKINS, type BoardSkin } from '@/lib/forge/board';

export interface Ascent3DProps {
  spec: WorldSpec;
  /** floors cleared so far — also the index of the floor being played */
  level: number;
  /** trap lane per floor; only revealed on bust/cash-out */
  traps: number[];
  /** lane the player chose on each cleared floor */
  picks: number[];
  reveal: boolean;
  playing: boolean;
  /** lane that killed the run, or null */
  hitLane: number | null;
  onPick: (lane: number) => void;
  heat: number;
}

const FLOOR_H = 1.55; // vertical gap between floors
const LANE_W = 1.25; // horizontal gap between platforms

/** One platform the player can step onto. Lifts, glows, and shatters on a trap. */
function Platform({
  lane, floor, lanes, skin, state, active, onPick, heat,
}: {
  lane: number; floor: number; lanes: number; skin: (typeof BOARD_SKINS)[BoardSkin];
  state: 'idle' | 'cleared' | 'trap' | 'hit'; active: boolean; onPick: (l: number) => void; heat: number;
}) {
  const group = useRef<THREE.Group>(null);
  const slab = useRef<THREE.Mesh>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const hover = useRef(false);

  const x = (lane - (lanes - 1) / 2) * LANE_W;
  const y = floor * FLOOR_H;
  const isTrap = state === 'trap' || state === 'hit';
  const color = useMemo(() => new THREE.Color(isTrap ? skin.bomb : skin.gem), [isTrap, skin]);
  const glow = useMemo(() => new THREE.Color(isTrap ? skin.bomb : skin.gemGlow), [isTrap, skin]);

  useFrame((s, dt) => {
    const g = group.current;
    if (!g) return;
    // A hit platform drops away; the active floor breathes so the eye lands on it.
    const t = s.clock.elapsedTime;
    const targetY = state === 'hit' ? y - 3.4 : y + (active && hover.current ? 0.14 : 0);
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, state === 'hit' ? 3.4 : 10, dt);
    g.rotation.z = state === 'hit' ? THREE.MathUtils.damp(g.rotation.z, 0.7, 3, dt) : 0;

    const mat = slab.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) {
      const target =
        state === 'cleared' ? 0.7 + heat * 0.5 : isTrap ? 0.9 : active ? 0.28 + Math.sin(t * 3) * 0.12 : 0.04;
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, target, 8, dt);
      mat.opacity = THREE.MathUtils.damp(mat.opacity, state === 'hit' ? 0 : 1, 3, dt);
    }
    if (crystal.current) {
      crystal.current.visible = state === 'cleared' || isTrap;
      crystal.current.rotation.y += dt * 1.6;
      crystal.current.position.y = 0.52 + Math.sin(t * 2 + lane) * 0.06;
    }
  });

  return (
    <group
      ref={group}
      position={[x, y, 0]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); hover.current = true; document.body.style.cursor = active ? 'pointer' : 'default'; }}
      onPointerOut={() => { hover.current = false; document.body.style.cursor = 'default'; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (active) onPick(lane); }}
    >
      <RoundedBox ref={slab as never} args={[1.02, 0.2, 1.02]} radius={0.07} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial
          color={state === 'idle' ? new THREE.Color(skin.tile[0]) : color}
          emissive={glow}
          emissiveIntensity={0}
          metalness={0.6}
          roughness={0.25}
          transparent
        />
      </RoundedBox>
      <mesh ref={crystal} position={[0, 0.52, 0]} scale={0.28}>
        {isTrap ? <icosahedronGeometry args={[1, 0]} /> : <octahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial color={color} emissive={glow} emissiveIntensity={1.6} metalness={0.3} roughness={0.15} flatShading />
      </mesh>
    </group>
  );
}

/** The climbing marker — a glowing shard that rises with the player. */
function Climber({ level, lane, lanes, skin, alive }: { level: number; lane: number; lanes: number; skin: (typeof BOARD_SKINS)[BoardSkin]; alive: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    const targetX = (lane - (lanes - 1) / 2) * LANE_W;
    const targetY = alive ? level * FLOOR_H + 0.62 + Math.sin(t * 2) * 0.06 : -3;
    g.position.x = THREE.MathUtils.damp(g.position.x, targetX, 8, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, alive ? 7 : 2.5, dt);
    g.rotation.y += dt * 2.2;
  });
  return (
    <group ref={ref} position={[0, 0.6, 0]}>
      <Trail width={1.6} length={5} color={new THREE.Color(skin.gemGlow)} attenuation={(t) => t * t}>
        <mesh scale={[0.2, 0.34, 0.2]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#ffffff" emissive={skin.gemGlow} emissiveIntensity={2.4} flatShading />
        </mesh>
      </Trail>
      <pointLight color={skin.gemGlow} intensity={6} distance={5} />
    </group>
  );
}

/** The tower's spine — a humming column of energy the platforms hang off. */
function EnergyBeam({ floors, skin, heat }: { floors: number; skin: (typeof BOARD_SKINS)[BoardSkin]; heat: number }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const h = floors * FLOOR_H + 4;
  useFrame((s) => {
    if (!mat.current) return;
    const t = s.clock.elapsedTime;
    mat.current.opacity = 0.05 + heat * 0.1 + Math.sin(t * 2.2) * 0.02;
  });
  return (
    <group position={[0, h / 2 - 1, 0]}>
      <mesh>
        <cylinderGeometry args={[0.16, 0.16, h, 12, 1, true]} />
        <meshBasicMaterial ref={mat} color={skin.gemGlow} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.045, 0.045, h, 8]} />
        <meshBasicMaterial color={skin.gemGlow} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Camera rig that rises with the climb — the core of the vertigo. */
function ClimbCam({ level, floors }: { level: number; floors: number }) {
  const target = useRef(new THREE.Vector3(0, 0, 0));
  useFrame((s, dt) => {
    const y = level * FLOOR_H;
    // Pull back slightly as the tower grows so the whole climb stays legible.
    const dist = 6.4 + Math.min(floors, 12) * 0.12;
    target.current.set(0, y + 0.8, 0);
    s.camera.position.x = THREE.MathUtils.damp(s.camera.position.x, 0, 3, dt);
    s.camera.position.y = THREE.MathUtils.damp(s.camera.position.y, y + 2.6, 3, dt);
    s.camera.position.z = THREE.MathUtils.damp(s.camera.position.z, dist, 3, dt);
    s.camera.lookAt(target.current);
  });
  return null;
}

function Prop3D({ prop, level }: { prop: WorldProp; level: number }) {
  const ref = useRef<THREE.Group>(null);
  const a = (prop.angle * Math.PI) / 180;
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    ref.current.rotation.y = t * 0.25 + prop.angle;
    // Decor drifts upward with the climb so the tower never feels empty.
    ref.current.position.y = prop.height + level * FLOOR_H * 0.6 + Math.sin(t + prop.angle) * 0.15;
  });
  return (
    <group ref={ref} position={[Math.cos(a) * (prop.radius + 1.5), prop.height, Math.sin(a) * (prop.radius + 1.5)]} scale={prop.scale}>
      <mesh>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial color={prop.color} emissive={prop.color} emissiveIntensity={1.1} flatShading />
      </mesh>
    </group>
  );
}

function Scene({ spec, level, traps, picks, reveal, playing, hitLane, onPick, heat }: Ascent3DProps) {
  const env = envDef(spec.environment);
  const skin = BOARD_SKINS[spec.board.skin];
  const lanes = ascentLanes(spec);
  const floors = ascentFloors(spec);
  const alive = hitLane === null;

  return (
    <>
      <color attach="background" args={[env.fog]} />
      <fog attach="fog" args={[env.fog, 10, 32]} />
      <ambientLight intensity={env.ambient} />
      <pointLight position={[0, level * FLOOR_H + 4, 3]} color={skin.gemGlow} intensity={18 + heat * 30} distance={30} />
      <pointLight position={[-4, level * FLOOR_H, -3]} color={skin.bomb} intensity={5} distance={22} />

      <Stars radius={80} depth={60} count={1800} factor={4} saturation={0} fade speed={0.5} />
      <Sparkles count={40} scale={[6, floors * FLOOR_H, 6]} size={4} speed={0.35} color={skin.gemGlow} position={[0, (floors * FLOOR_H) / 2, 0]} />
      <EnergyBeam floors={floors} skin={skin} heat={heat} />
      {spec.props.map((p) => <Prop3D key={p.id} prop={p} level={level} />)}

      {/* the floor you started from — falls away below you */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]} receiveShadow>
        <circleGeometry args={[6, 48]} />
        <meshStandardMaterial color={env.ground} metalness={0.7} roughness={0.4} />
      </mesh>

      {Array.from({ length: floors }, (_, f) =>
        Array.from({ length: lanes }, (_, l) => {
          const cleared = f < level && picks[f] === l;
          const isTrapLane = traps[f] === l;
          const state: 'idle' | 'cleared' | 'trap' | 'hit' =
            hitLane !== null && f === level && l === hitLane ? 'hit'
              : cleared ? 'cleared'
                : reveal && isTrapLane ? 'trap'
                  : 'idle';
          return (
            <Platform
              key={`${f}-${l}`}
              lane={l}
              floor={f}
              lanes={lanes}
              skin={skin}
              state={state}
              active={playing && f === level}
              onPick={onPick}
              heat={heat}
            />
          );
        }),
      )}

      <Climber level={level} lane={picks[level - 1] ?? Math.floor(lanes / 2)} lanes={lanes} skin={skin} alive={alive} />
      <ClimbCam level={level} floors={floors} />
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.7} maxPolarAngle={Math.PI / 1.9} />

      <EffectComposer>
        <Bloom mipmapBlur intensity={1 + heat * 1.3} luminanceThreshold={0.22} luminanceSmoothing={0.9} />
        <ChromaticAberration offset={new THREE.Vector2(0.0004, 0.0007)} radialModulation modulationOffset={0.4} />
        <Noise premultiply opacity={0.06} />
        <Vignette eskil={false} offset={0.22} darkness={0.8} />
      </EffectComposer>
    </>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function Ascent3D(props: Ascent3DProps) {
  return (
    <GLErrorBoundary fallback={<div className="grid h-full min-h-[340px] place-items-center rounded-2xl bg-void-950/60 p-8 text-center text-sm text-slate-500">3D isn&apos;t available on this device — the climb still plays with full provably-fair logic.</div>}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 46, position: [0, 2.6, 7] }}>
        <Scene {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

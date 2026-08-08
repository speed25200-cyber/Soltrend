'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { WorldSpec } from '@/lib/forge/world';
import { envDef, type WorldProp } from '@/lib/forge/world';
import { BOARD_SKINS, type BoardSkin } from '@/lib/forge/board';

export interface World3DProps {
  spec: WorldSpec;
  revealed: Set<number>;
  bombSet: Set<number>;
  showBombs: boolean;
  playing: boolean;
  hitIndex: number | null;
  onReveal: (i: number) => void;
  /** 0..1 tension that drives light intensity + colour bloom */
  heat: number;
}

const SPACING = 1.14;

/** A single board tile — a lacquered slab with a hover ring and a floating gem. */
function Tile({
  index, col, row, cols, rows, skin, revealed, isBomb, isHit, playing, onReveal, heat,
}: {
  index: number; col: number; row: number; cols: number; rows: number;
  skin: (typeof BOARD_SKINS)[BoardSkin]; revealed: boolean; isBomb: boolean; isHit: boolean;
  playing: boolean; onReveal: (i: number) => void; heat: number;
}) {
  const group = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Mesh>(null);
  const slab = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const hover = useRef(false);

  const x = (col - (cols - 1) / 2) * SPACING;
  const z = (row - (rows - 1) / 2) * SPACING;
  const open = revealed || isBomb;
  const gemColor = useMemo(() => new THREE.Color(isBomb ? skin.bomb : skin.gem), [isBomb, skin]);
  const glowColor = useMemo(() => new THREE.Color(isBomb ? skin.bomb : skin.gemGlow), [isBomb, skin]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const targetY = open ? 0.34 : hover.current && playing ? 0.12 : 0;
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, 9, dt);
    // slab emissive ramps in when opened
    const mat = slab.current?.material as THREE.MeshPhysicalMaterial | undefined;
    if (mat) mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, open ? (isBomb ? 0.8 : 0.55 + heat * 0.6) : 0, 8, dt);
    // hover ring — a halo that rises around the tile under the cursor
    const rmat = ring.current?.material as THREE.MeshBasicMaterial | undefined;
    if (rmat && ring.current) {
      const active = hover.current && playing && !open;
      rmat.opacity = THREE.MathUtils.damp(rmat.opacity, active ? 0.85 : 0, 12, dt);
      ring.current.rotation.z += dt * (active ? 2.2 : 0.4);
    }
    // floating gem bob + spin
    if (gem.current) {
      const t = state.clock.elapsedTime;
      gem.current.visible = open;
      const s = open ? THREE.MathUtils.damp(gem.current.scale.x, isHit ? 0.001 : 0.32, 10, dt) : 0.001;
      gem.current.scale.setScalar(Math.max(0.001, s));
      gem.current.position.y = 0.62 + Math.sin(t * 1.6 + index) * 0.05;
      gem.current.rotation.y += dt * 1.2;
      gem.current.rotation.x = Math.sin(t + index) * 0.3;
    }
  });

  return (
    <group
      ref={group}
      position={[x, 0, z]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); hover.current = true; document.body.style.cursor = playing && !open ? 'pointer' : 'default'; }}
      onPointerOut={() => { hover.current = false; document.body.style.cursor = 'default'; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (playing && !open) onReveal(index); }}
    >
      <RoundedBox ref={slab as never} args={[0.98, 0.26, 0.98]} radius={0.09} smoothness={4} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={open ? gemColor : new THREE.Color(skin.tile[0])}
          emissive={glowColor}
          emissiveIntensity={0}
          metalness={0.65}
          roughness={0.3}
          clearcoat={0.8}
          clearcoatRoughness={0.22}
        />
      </RoundedBox>
      {/* hover halo */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <ringGeometry args={[0.52, 0.6, 40]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* floating gem / hazard crystal */}
      <mesh ref={gem} position={[0, 0.62, 0]}>
        {isBomb ? <icosahedronGeometry args={[1, 0]} /> : <octahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial color={gemColor} emissive={glowColor} emissiveIntensity={1.4} metalness={0.3} roughness={0.15} flatShading />
      </mesh>
    </group>
  );
}

function Rig({ spec, heat }: { spec: WorldSpec; heat: number }) {
  const key = useRef<THREE.PointLight>(null);
  const fill = useRef<THREE.PointLight>(null);
  const skin = BOARD_SKINS[spec.board.skin];

  useFrame((state, dt) => {
    if (key.current) key.current.intensity = THREE.MathUtils.damp(key.current.intensity, 16 + heat * 34, 6, dt);
    if (fill.current) {
      fill.current.intensity = 8 + heat * 14;
      const t = state.clock.elapsedTime;
      fill.current.position.x = Math.sin(t * 0.4) * 4;
      fill.current.position.z = Math.cos(t * 0.4) * 4;
    }
  });

  return (
    <>
      <pointLight ref={key} position={[0, 6, 2]} color={skin.gemGlow} intensity={16} distance={40} />
      <pointLight ref={fill} position={[3, 3, 3]} color={skin.gem} intensity={8} distance={30} />
      <pointLight position={[-4, 2, -3]} color={skin.bomb} intensity={4} distance={24} />
    </>
  );
}

/** A vast emissive backdrop dome — gives the void depth and a coloured horizon. */
function SkyDome({ skin }: { skin: (typeof BOARD_SKINS)[BoardSkin] }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((s) => {
    if (mat.current) {
      const t = s.clock.elapsedTime;
      mat.current.opacity = 0.05 + Math.sin(t * 0.3) * 0.015;
    }
  });
  return (
    <mesh position={[0, 4, -26]}>
      <sphereGeometry args={[16, 32, 24]} />
      <meshBasicMaterial ref={mat} color={skin.gem} transparent opacity={0.05} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

/** Per-environment mood — procedural, fully self-contained (no external assets). */
function Atmosphere({ env, skin }: { env: WorldSpec['environment']; skin: (typeof BOARD_SKINS)[BoardSkin] }) {
  return (
    <>
      {(env === 'void' || env === 'nebula') && (
        <Stars radius={90} depth={50} count={env === 'nebula' ? 2200 : 1400} factor={4} saturation={0} fade speed={0.7} />
      )}
      {(env === 'nebula' || env === 'arena') && (
        <Sparkles count={44} scale={[11, 5, 11]} size={4} speed={0.4} color={skin.gemGlow} position={[0, 1.6, 0]} />
      )}
      {env === 'grid' && (
        <Sparkles count={30} scale={[12, 2, 12]} size={3} speed={0.3} color={skin.gem} position={[0, 0.4, 0]} />
      )}
      {env === 'sunset' && (
        <>
          <mesh position={[0, 3.5, -18]}>
            <sphereGeometry args={[7, 32, 32]} />
            <meshBasicMaterial color="#ff7a3c" />
          </mesh>
          <Sparkles count={30} scale={[14, 6, 14]} size={5} speed={0.25} color="#ffb078" position={[0, 2, 0]} />
        </>
      )}
      <SkyDome skin={skin} />
      {/* horizon glow ring — grounds the board in a "place" */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <ringGeometry args={[9, 13, 64]} />
        <meshBasicMaterial color={skin.gem} transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** A placed decorative object — cosmetic, gently animated. */
function Prop({ prop }: { prop: WorldProp }) {
  const ref = useRef<THREE.Group>(null);
  const a = (prop.angle * Math.PI) / 180;
  const x = Math.cos(a) * prop.radius;
  const z = Math.sin(a) * prop.radius;
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.3 + prop.angle;
    ref.current.position.y = prop.height + Math.sin(t * 1.1 + prop.angle) * 0.08;
  });
  const mat = { color: prop.color, emissive: prop.color, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.25 };
  const geo = () => {
    switch (prop.type) {
      case 'ring': return <mesh rotation={[Math.PI / 2.4, 0, 0]}><torusGeometry args={[0.7, 0.09, 14, 40]} /><meshStandardMaterial {...mat} /></mesh>;
      case 'pillar': return <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.16, 0.22, 2.2, 12]} /><meshStandardMaterial {...mat} /></mesh>;
      case 'arch': return <mesh rotation={[0, 0, 0]} position={[0, 0.7, 0]}><torusGeometry args={[0.8, 0.12, 12, 24, Math.PI]} /><meshStandardMaterial {...mat} /></mesh>;
      case 'totem': return (
        <group>
          <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial {...mat} /></mesh>
          <mesh position={[0, 0.85, 0]}><boxGeometry args={[0.38, 0.5, 0.38]} /><meshStandardMaterial {...mat} /></mesh>
          <mesh position={[0, 1.3, 0]}><octahedronGeometry args={[0.28, 0]} /><meshStandardMaterial {...mat} emissiveIntensity={1.4} /></mesh>
        </group>
      );
      case 'orb': return (
        <group position={[0, 0.7, 0]}>
          <mesh><sphereGeometry args={[0.4, 20, 20]} /><meshStandardMaterial {...mat} emissiveIntensity={1.3} /></mesh>
          <mesh rotation={[Math.PI / 2.2, 0, 0]}><torusGeometry args={[0.62, 0.04, 10, 30]} /><meshStandardMaterial color={prop.color} emissive={prop.color} emissiveIntensity={1.2} /></mesh>
        </group>
      );
      default: return <mesh position={[0, 0.7, 0]} scale={[1, 1.7, 1]}><octahedronGeometry args={[0.42, 0]} /><meshStandardMaterial {...mat} flatShading emissiveIntensity={1.2} /></mesh>;
    }
  };
  return <group ref={ref} position={[x, 0, z]} scale={prop.scale}>{geo()}</group>;
}

function Scene({ spec, revealed, bombSet, showBombs, playing, hitIndex, onReveal, heat }: World3DProps) {
  const env = envDef(spec.environment);
  const skin = BOARD_SKINS[spec.board.skin];
  const { rows, cols } = spec.board;
  const auto = spec.camera === 'cinematic';
  const camPos: [number, number, number] = spec.camera === 'iso' ? [6.5, 7, 6.5] : spec.camera === 'cinematic' ? [0, 6.2, 8.5] : [0, 6.5, 7.5];

  return (
    <>
      <color attach="background" args={[env.fog]} />
      <fog attach="fog" args={[env.fog, 12, 26]} />
      <ambientLight intensity={env.ambient} />
      <Rig spec={spec} heat={heat} />
      <Atmosphere env={spec.environment} skin={skin} />
      {spec.props.map((p) => <Prop key={p.id} prop={p} />)}

      {/* ground — lacquered, so the board's glow catches in it */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshPhysicalMaterial color={env.ground} metalness={0.7} roughness={0.45} clearcoat={0.5} clearcoatRoughness={0.4} />
      </mesh>
      <gridHelper args={[60, 60, skin.gem, '#1b2036']} position={[0, -0.19, 0]} />

      {/* tiles */}
      {Array.from({ length: rows * cols }, (_, i) => (
        <Tile
          key={i}
          index={i}
          col={i % cols}
          row={Math.floor(i / cols)}
          cols={cols}
          rows={rows}
          skin={skin}
          revealed={revealed.has(i)}
          isBomb={showBombs && bombSet.has(i)}
          isHit={hitIndex === i}
          playing={playing}
          onReveal={onReveal}
          heat={heat}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={6}
        maxDistance={16}
        autoRotate={auto}
        autoRotateSpeed={0.6}
        target={[0, 0.2, 0]}
      />
      <PerspectiveSetter pos={camPos} />

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.9 + heat * 1.1} luminanceThreshold={0.25} luminanceSmoothing={0.9} />
        <ChromaticAberration offset={new THREE.Vector2(0.0004, 0.0006)} radialModulation modulationOffset={0.4} />
        <Noise premultiply opacity={0.06} />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

/** Sets the initial camera position once (OrbitControls owns it afterwards). */
function PerspectiveSetter({ pos }: { pos: [number, number, number] }) {
  const done = useRef(false);
  useFrame((state) => {
    if (done.current) return;
    state.camera.position.set(...pos);
    state.camera.lookAt(0, 0.2, 0);
    done.current = true;
  });
  return null;
}

/** Keeps a WebGL failure from taking down the whole page. */
class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function World3D(props: World3DProps) {
  return (
    <GLErrorBoundary fallback={<div className="grid h-full min-h-[340px] place-items-center rounded-2xl bg-void-950/60 p-8 text-center text-sm text-slate-500">3D isn&apos;t available on this device — the board still plays with full provably-fair logic.</div>}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 42, position: [0, 6.5, 7.5] }}>
        <Scene {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

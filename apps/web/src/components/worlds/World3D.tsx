'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { WorldSpec } from '@/lib/forge/world';
import { envDef } from '@/lib/forge/world';
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

/** A single board tile — a rounded slab that lifts + glows when revealed. */
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
    const mat = slab.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, open ? (isBomb ? 0.8 : 0.55 + heat * 0.6) : 0, 8, dt);
    // floating gem bob + spin
    if (gem.current) {
      const t = state.clock.elapsedTime;
      gem.current.visible = open;
      const s = open ? THREE.MathUtils.damp(gem.current.scale.x, isHit ? 0.001 + 0 : 0.32, 10, dt) : 0.001;
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
        <meshStandardMaterial
          color={open ? gemColor : new THREE.Color(skin.tile[0])}
          emissive={glowColor}
          emissiveIntensity={0}
          metalness={0.55}
          roughness={0.28}
        />
      </RoundedBox>
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
      {/* horizon glow ring — grounds the board in a "place" */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <ringGeometry args={[9, 13, 64]} />
        <meshBasicMaterial color={skin.gem} transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
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

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={env.ground} metalness={0.6} roughness={0.5} />
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

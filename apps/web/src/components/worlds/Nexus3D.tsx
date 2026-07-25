'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Sparkles, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { clampRisk, exitsFrom, findRoom, roomGain, type NexusRoom, type NexusSpec } from '@/lib/forge/nexus';
import { envDef, type EnvironmentId } from '@/lib/forge/world';
import { BOARD_SKINS, type BoardSkin } from '@/lib/forge/board';

export interface Nexus3DProps {
  spec: NexusSpec;
  environment: EnvironmentId;
  skin: BoardSkin;
  /** room the player currently stands in */
  currentId: string;
  /** rooms already cleared, in order */
  cleared: string[];
  /** the room that killed the run, or null */
  hitId: string | null;
  reveal: boolean;
  playing: boolean;
  onEnter: (id: string) => void;
  heat: number;
}

/** Danger reads as colour: calm cyan → molten red as risk climbs. */
function riskColor(risk: number, skin: (typeof BOARD_SKINS)[BoardSkin]) {
  const t = (clampRisk(risk) - 0.05) / 0.55;
  return new THREE.Color(skin.gem).lerp(new THREE.Color(skin.bomb), Math.min(1, Math.max(0, t)));
}

/** A room — a faceted crystal chamber whose halo tightens as its danger rises. */
function Room({
  room, skin, state, reachable, onEnter, heat,
}: {
  room: NexusRoom;
  skin: (typeof BOARD_SKINS)[BoardSkin];
  state: 'ahead' | 'current' | 'cleared' | 'trap' | 'hit';
  reachable: boolean;
  onEnter: (id: string) => void;
  heat: number;
}) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const hover = useRef(false);

  const danger = clampRisk(room.risk);
  const color = useMemo(() => riskColor(room.risk, skin), [room.risk, skin]);
  const isTrap = state === 'trap' || state === 'hit';

  useFrame((s, dt) => {
    const g = group.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    // A sprung trap collapses; everything else drifts on its own rhythm.
    const targetScale = state === 'hit' ? 0.001 : reachable && hover.current ? 1.18 : state === 'current' ? 1.12 : 1;
    const sc = THREE.MathUtils.damp(g.scale.x, targetScale, state === 'hit' ? 4 : 9, dt);
    g.scale.setScalar(Math.max(0.001, sc));
    g.position.y = room.y + Math.sin(t * 0.9 + room.x) * 0.06;

    if (core.current) {
      core.current.rotation.y += dt * (0.3 + danger * 0.9);
      core.current.rotation.x = Math.sin(t * 0.5 + room.z) * 0.2;
      const mat = core.current.material as THREE.MeshStandardMaterial;
      const target =
        state === 'cleared' ? 1.5 + heat * 0.8
          : state === 'current' ? 2.2
            : isTrap ? 2.4
              : reachable ? 0.9 + Math.sin(t * 3) * 0.35
                : 0.22;
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, target, 7, dt);
    }
    // The halo spins faster the more lethal the room — danger you can feel.
    if (halo.current) halo.current.rotation.z += dt * (0.4 + danger * 2.6);
  });

  return (
    <group
      ref={group}
      position={[room.x, room.y, room.z]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); hover.current = true; document.body.style.cursor = reachable ? 'pointer' : 'default'; }}
      onPointerOut={() => { hover.current = false; document.body.style.cursor = 'default'; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (reachable) onEnter(room.id); }}
    >
      <mesh ref={core} scale={0.42}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.4} roughness={0.18} flatShading />
      </mesh>
      {/* danger halo — thicker + faster on lethal rooms */}
      <mesh ref={halo} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.018 + danger * 0.05, 8, 36]} />
        <meshBasicMaterial color={color} transparent opacity={state === 'ahead' && !reachable ? 0.18 : 0.75} />
      </mesh>
      {state === 'current' && <pointLight color={skin.gemGlow} intensity={9} distance={6} />}
      {isTrap && <pointLight color={skin.bomb} intensity={14} distance={8} />}
    </group>
  );
}

/** A path between rooms — a light beam that brightens when it's a live option. */
function Link({ a, b, color, live, walked }: { a: NexusRoom; b: NexusRoom; color: string; live: boolean; walked: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const { mid, len, quat } = useMemo(() => {
    const from = new THREE.Vector3(a.x, a.y, a.z);
    const to = new THREE.Vector3(b.x, b.y, b.z);
    const dir = to.clone().sub(from);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { mid: from.clone().add(to).multiplyScalar(0.5), len: dir.length(), quat: q };
  }, [a, b]);

  useFrame((s, dt) => {
    const mat = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (!mat) return;
    const t = s.clock.elapsedTime;
    const target = walked ? 0.85 : live ? 0.4 + Math.sin(t * 4) * 0.22 : 0.08;
    mat.opacity = THREE.MathUtils.damp(mat.opacity, target, 6, dt);
  });

  return (
    <mesh ref={ref} position={mid} quaternion={quat}>
      <cylinderGeometry args={[live || walked ? 0.035 : 0.014, live || walked ? 0.035 : 0.014, len, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} />
    </mesh>
  );
}

/** The player's shard — flies room to room, so movement is felt, not teleported. */
function Traveller({ target, skin, alive }: { target: NexusRoom | undefined; skin: (typeof BOARD_SKINS)[BoardSkin]; alive: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    const g = ref.current;
    if (!g || !target) return;
    const t = s.clock.elapsedTime;
    g.position.x = THREE.MathUtils.damp(g.position.x, target.x, 5, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, target.z, 5, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, alive ? target.y + 0.05 + Math.sin(t * 2) * 0.05 : target.y - 4, alive ? 5 : 2, dt);
    g.rotation.y += dt * 2.4;
  });
  return (
    <group ref={ref}>
      <mesh scale={[0.14, 0.26, 0.14]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" emissive={skin.gemGlow} emissiveIntensity={2.6} flatShading />
      </mesh>
      <pointLight color={skin.gemGlow} intensity={7} distance={5} />
    </group>
  );
}

/** Camera drifts to keep the player and their live options in frame. */
function NexusCam({ focus }: { focus: NexusRoom | undefined }) {
  const look = useRef(new THREE.Vector3());
  useFrame((s, dt) => {
    if (!focus) return;
    look.current.set(
      THREE.MathUtils.damp(look.current.x, focus.x, 3, dt),
      THREE.MathUtils.damp(look.current.y, focus.y + 0.4, 3, dt),
      THREE.MathUtils.damp(look.current.z, focus.z, 3, dt),
    );
    s.camera.lookAt(look.current);
  });
  return null;
}

function Scene({ spec, environment, skin: skinId, currentId, cleared, hitId, reveal, playing, onEnter, heat }: Nexus3DProps) {
  const env = envDef(environment);
  const skin = BOARD_SKINS[skinId];
  const current = findRoom(spec, currentId);
  const nextIds = useMemo(
    () => new Set(playing ? exitsFrom(spec, currentId).map((r) => r.id) : []),
    [spec, currentId, playing],
  );
  const clearedSet = useMemo(() => new Set(cleared), [cleared]);
  const walked = useMemo(() => {
    // highlight the route actually taken: start -> cleared[0] -> cleared[1] ...
    const seq = [spec.startId, ...cleared];
    const s = new Set<string>();
    for (let i = 0; i < seq.length - 1; i++) s.add(`${seq[i]}>${seq[i + 1]}`);
    return s;
  }, [spec.startId, cleared]);

  return (
    <>
      <color attach="background" args={[env.fog]} />
      <fog attach="fog" args={[env.fog, 9, 30]} />
      <ambientLight intensity={env.ambient * 0.8} />
      <pointLight position={[0, 6, 4]} color={skin.gemGlow} intensity={12 + heat * 24} distance={40} />
      <Stars radius={70} depth={50} count={1600} factor={4} saturation={0} fade speed={0.4} />
      <Sparkles count={36} scale={[10, 5, 10]} size={3} speed={0.3} color={skin.gemGlow} position={[0, 1, 0]} />

      {spec.links.map(([from, to]) => {
        const a = findRoom(spec, from);
        const b = findRoom(spec, to);
        if (!a || !b) return null;
        return (
          <Link
            key={`${from}>${to}`}
            a={a}
            b={b}
            color={skin.gem}
            live={from === currentId && nextIds.has(to)}
            walked={walked.has(`${from}>${to}`)}
          />
        );
      })}

      {spec.rooms.map((room) => {
        const state: 'ahead' | 'current' | 'cleared' | 'trap' | 'hit' =
          room.id === hitId ? 'hit'
            : room.id === currentId ? 'current'
              : clearedSet.has(room.id) ? 'cleared'
                : reveal && room.risk >= 0.4 ? 'trap'
                  : 'ahead';
        return (
          <Room
            key={room.id}
            room={room}
            skin={skin}
            state={state}
            reachable={nextIds.has(room.id)}
            onEnter={onEnter}
            heat={heat}
          />
        );
      })}

      <Traveller target={current} skin={skin} alive={hitId === null} />
      <NexusCam focus={current} />
      <OrbitControls enablePan={false} minDistance={5} maxDistance={16} minPolarAngle={0.25} maxPolarAngle={Math.PI / 2.05} />

      <EffectComposer>
        <Bloom mipmapBlur intensity={1.1 + heat * 1.2} luminanceThreshold={0.2} luminanceSmoothing={0.9} />
        <Vignette eskil={false} offset={0.22} darkness={0.82} />
      </EffectComposer>
    </>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function Nexus3D(props: Nexus3DProps) {
  return (
    <GLErrorBoundary fallback={<div className="grid h-full min-h-[340px] place-items-center rounded-2xl bg-void-950/60 p-8 text-center text-sm text-slate-500">3D isn&apos;t available on this device — the Nexus still plays with full provably-fair logic.</div>}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 48, position: [0, 5.5, 8] }}>
        <Scene {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

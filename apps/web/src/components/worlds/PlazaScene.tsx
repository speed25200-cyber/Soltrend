'use client';

import { Component, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { ShipMesh, shipById, SHIP_SKINS, type ShipSkin } from './ships';
import type { PlazaPeer } from '@/hooks/usePlaza';

export interface PlazaSceneProps {
  skin: ShipSkin;
  peers: PlazaPeer[];
  ambient: boolean; // solo: spawn wandering bots so the plaza feels alive offline
  onMove: (x: number, z: number) => void;
}

const SPEED = 7;
const rand = (n: number) => (Math.random() * 2 - 1) * n;

function LocalShip({ skin, target, onMove }: { skin: ShipSkin; target: React.MutableRefObject<THREE.Vector3>; onMove: (x: number, z: number) => void }) {
  const grp = useRef<THREE.Group>(null);
  const acc = useRef(0);
  useFrame((state, dt) => {
    const g = grp.current;
    if (!g) return;
    const dir = target.current.clone().sub(g.position); dir.y = 0;
    const dist = dir.length();
    if (dist > 0.06) {
      dir.normalize();
      g.position.addScaledVector(dir, Math.min(dist, SPEED * dt));
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.atan2(dir.x, dir.z), 8, dt);
    }
    const cam = state.camera;
    const desired = new THREE.Vector3(g.position.x, 7.5, g.position.z + 9);
    cam.position.lerp(desired, 1 - Math.pow(0.0015, dt));
    cam.lookAt(g.position.x, 0.6, g.position.z);
    acc.current += dt;
    if (acc.current > 0.1) { acc.current = 0; onMove(g.position.x, g.position.z); }
  });
  return (
    <group ref={grp} position={[0, 0.4, 4]}>
      <group rotation={[Math.PI / 2, 0, 0]}><ShipMesh skin={skin} scale={0.72} /></group>
      <pointLight color={skin.color} intensity={7} distance={11} />
    </group>
  );
}

function PeerShip({ peer }: { peer: PlazaPeer }) {
  const grp = useRef<THREE.Group>(null);
  const sk = useMemo(() => shipById(peer.ship), [peer.ship]);
  useFrame((_s, dt) => {
    const g = grp.current;
    if (!g) return;
    const before = g.position.clone();
    g.position.lerp(new THREE.Vector3(peer.x, 0.4, peer.z), 1 - Math.pow(0.003, dt));
    const vel = g.position.clone().sub(before); vel.y = 0;
    if (vel.length() > 0.001) g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.atan2(vel.x, vel.z), 8, dt);
  });
  return (
    <group ref={grp} position={[peer.x, 0.4, peer.z]}>
      <group rotation={[Math.PI / 2, 0, 0]}><ShipMesh skin={sk} scale={0.62} /></group>
    </group>
  );
}

function AmbientShip({ seed }: { seed: number }) {
  const grp = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(rand(16), 0.4, rand(16)));
  const skin = SHIP_SKINS[seed % SHIP_SKINS.length];
  useFrame((_s, dt) => {
    const g = grp.current;
    if (!g) return;
    const dir = target.current.clone().sub(g.position); dir.y = 0;
    const d = dir.length();
    if (d < 0.5) target.current.set(rand(17), 0.4, rand(17));
    else {
      dir.normalize();
      g.position.addScaledVector(dir, Math.min(d, 3.4 * dt));
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.atan2(dir.x, dir.z), 6, dt);
    }
  });
  return (
    <group ref={grp} position={[(seed * 5) % 30 - 15, 0.4, (seed * 7) % 30 - 15]}>
      <group rotation={[Math.PI / 2, 0, 0]}><ShipMesh skin={skin} scale={0.55} emissive={0.9} /></group>
    </group>
  );
}

function Plaza({ skin, peers, ambient, onMove }: PlazaSceneProps) {
  const target = useRef(new THREE.Vector3(0, 0.4, 4));
  const bots = useMemo(() => (ambient ? Array.from({ length: 6 }, (_, i) => i + 1) : []), [ambient]);
  const setTarget = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); target.current.set(e.point.x, 0.4, e.point.z); };
  return (
    <>
      <color attach="background" args={['#060713']} />
      <fog attach="fog" args={['#060713', 22, 52]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[0, 12, 0]} color={skin.glow} intensity={22} distance={60} />
      <pointLight position={[14, 6, 14]} color="#22d3ee" intensity={8} distance={40} />
      <pointLight position={[-14, 6, -14]} color="#a855f7" intensity={8} distance={40} />
      <Stars radius={110} depth={60} count={2200} factor={4} saturation={0} fade speed={0.5} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerDown={setTarget} receiveShadow>
        <circleGeometry args={[26, 64]} />
        <meshStandardMaterial color="#0b0f1f" metalness={0.6} roughness={0.45} />
      </mesh>
      <gridHelper args={[52, 52, skin.color, '#141a2e']} position={[0, 0.01, 0]} />
      {/* central pad */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.6, 48]} />
        <meshBasicMaterial color={skin.glow} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      <LocalShip skin={skin} target={target} onMove={onMove} />
      {peers.map((p) => <PeerShip key={p.id} peer={p} />)}
      {bots.map((b) => <AmbientShip key={b} seed={b} />)}
    </>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function PlazaScene(props: PlazaSceneProps) {
  const fallback = useMemo(() => <div className="grid h-full min-h-[380px] place-items-center text-sm text-slate-500">3D unavailable on this device.</div>, []);
  return (
    <GLErrorBoundary fallback={fallback}>
      <Canvas dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: 52, position: [0, 7.5, 13] }}>
        <Plaza {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

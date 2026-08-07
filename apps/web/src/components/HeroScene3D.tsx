'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The lobby's hero jewellery — a gold coin, a violet gem and a cyan die
 * drifting over the aurora, leaning with the pointer. Pure ornament, so it
 * stays cheap: three floating meshes, two lights, no postprocessing, and the
 * whole canvas is skipped on phones.
 */

function Coin() {
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9a334', metalness: 0.95, roughness: 0.25 }), []);
  const face = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffd25f', metalness: 0.85, roughness: 0.2, emissive: '#9a6a14', emissiveIntensity: 0.8 }),
    [],
  );
  return (
    <Float speed={1.4} rotationIntensity={1.2} floatIntensity={1.3}>
      <mesh rotation={[Math.PI / 2.6, 0, 0.5]} position={[-0.7, 0.95, 0.2]} material={[edge, face, face]}>
        <cylinderGeometry args={[0.5, 0.5, 0.11, 40]} />
      </mesh>
    </Float>
  );
}

function Gem() {
  return (
    <Float speed={1.1} rotationIntensity={1.4} floatIntensity={1.1}>
      <mesh position={[0.45, -0.2, 0.4]}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial
          color="#a855f7"
          metalness={0.35}
          roughness={0.12}
          emissive="#8b5cf6"
          emissiveIntensity={1.1}
          flatShading
        />
      </mesh>
    </Float>
  );
}

function Die() {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0891b2', metalness: 0.55, roughness: 0.25, emissive: '#164e63', emissiveIntensity: 0.9 }),
    [],
  );
  const pip = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e0faff', toneMapped: false }), []);
  const pipGeo = useMemo(() => new THREE.SphereGeometry(0.042, 8, 8), []);
  return (
    <Float speed={1.7} rotationIntensity={1.7} floatIntensity={1.4}>
      <group position={[1.45, 0.85, -0.2]} rotation={[0.5, 0.7, 0.2]}>
        <mesh material={mat}>
          <boxGeometry args={[0.55, 0.55, 0.55]} />
        </mesh>
        {/* five pips on the facing side */}
        {[[-0.14, 0.14], [0.14, 0.14], [0, 0], [-0.14, -0.14], [0.14, -0.14]].map(([x, y], i) => (
          <mesh key={i} geometry={pipGeo} material={pip} position={[x, y, 0.283]} />
        ))}
      </group>
    </Float>
  );
}

function Rig() {
  const { pointer, camera } = useThree();
  useFrame((_s, dt) => {
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 0.45, 2.5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.4 + pointer.y * 0.3, 2.5, dt);
    camera.lookAt(0.2, 0.4, 0);
  });
  return null;
}

export default function HeroScene3D() {
  return (
    <Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} camera={{ fov: 40, position: [0, 0.4, 5.6] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1.7} color="#f3e8ff" />
      <pointLight position={[-3, 1, 3]} color="#a855f7" intensity={7} distance={12} decay={2} />
      <pointLight position={[3, -1, 2]} color="#22d3ee" intensity={5} distance={12} decay={2} />
      <Coin />
      <Gem />
      <Die />
      <Sparkles count={40} scale={[6, 4, 3]} size={2} speed={0.25} color="#c4b5fd" opacity={0.6} position={[0.3, 0.5, 0]} />
      <Rig />
    </Canvas>
  );
}

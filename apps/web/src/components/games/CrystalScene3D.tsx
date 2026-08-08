'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The oracle crystal — a shared ambience layer for the number games (Dice,
 * Limbo). A faceted crystal floats behind the readout: it idles slowly,
 * tumbles hard while the round is in the air, and rings green or red the
 * moment the verdict lands, bleeding back to violet. The number itself stays
 * DOM — this layer only gives it a heart.
 *
 * Cheap on purpose: two meshes, two lights, an alpha canvas, no
 * postprocessing, and every frame writes refs — React renders nothing.
 */

export interface CrystalScene3DProps {
  /** true while the round is unresolved — the crystal tumbles */
  spin: boolean;
  /** the last round's verdict, or null before the first round */
  verdict: 'win' | 'loss' | null;
}

const VIOLET = new THREE.Color('#7c3aed');
const WIN = new THREE.Color('#10b981');
const LOSS = new THREE.Color('#e11d48');

function Crystal({ spin, verdict }: CrystalScene3DProps) {
  const shell = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const speed = useRef(0.35);
  const tint = useRef(VIOLET.clone());
  const wasSpin = useRef(false);
  const flashAt = useRef(-10);

  useFrame(({ clock }, dt) => {
    const s = shell.current;
    const c = core.current;
    if (!s || !c) return;
    const t = clock.elapsedTime;

    // the verdict flash arms on the spin→rest edge
    if (wasSpin.current && !spin && verdict) flashAt.current = t;
    wasSpin.current = spin;

    speed.current = THREE.MathUtils.damp(speed.current, spin ? 7 : 0.35, 3, dt);
    s.rotation.y += speed.current * dt;
    s.rotation.x += speed.current * 0.55 * dt;
    c.rotation.y -= speed.current * 0.7 * dt;
    const bob = Math.sin(t * 1.3) * 0.08;
    s.position.y = bob;
    c.position.y = bob;

    // colour: verdict ring decaying back to violet
    const age = t - flashAt.current;
    const hot = age >= 0 && age < 1.6 ? Math.exp(-age * 2.2) : 0;
    tint.current.copy(VIOLET);
    if (hot > 0 && verdict) tint.current.lerp(verdict === 'win' ? WIN : LOSS, hot);
    const shellMat = s.material as THREE.MeshStandardMaterial;
    const coreMat = c.material as THREE.MeshStandardMaterial;
    shellMat.emissive.copy(tint.current);
    shellMat.emissiveIntensity = 0.5 + hot * 1.6 + (spin ? 0.35 : 0);
    coreMat.emissive.copy(tint.current);
    coreMat.emissiveIntensity = 1.1 + hot * 2.2 + (spin ? 0.6 : 0);
    if (light.current) {
      light.current.color.copy(tint.current);
      light.current.intensity = 5 + hot * 14 + (spin ? 3 : 0);
    }
  });

  return (
    <group>
      <mesh ref={shell}>
        <octahedronGeometry args={[1.05, 0]} />
        <meshStandardMaterial
          color="#6d28d9"
          metalness={0.4}
          roughness={0.15}
          emissive="#7c3aed"
          emissiveIntensity={0.5}
          transparent
          opacity={0.55}
          flatShading
        />
      </mesh>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#c4b5fd" metalness={0.2} roughness={0.1} emissive="#8b5cf6" emissiveIntensity={1.1} flatShading />
      </mesh>
      <pointLight ref={light} position={[0, 0.4, 1.6]} color="#7c3aed" intensity={5} distance={9} decay={2} />
    </group>
  );
}

export default function CrystalScene3D(props: CrystalScene3DProps) {
  return (
    <Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} camera={{ fov: 42, position: [0, 0, 4.6] }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 3, 4]} intensity={0.9} color="#e9d5ff" />
      <Crystal {...props} />
      <Sparkles count={34} scale={[7, 4.5, 3]} size={1.9} speed={0.22} color="#c4b5fd" opacity={0.5} />
    </Canvas>
  );
}

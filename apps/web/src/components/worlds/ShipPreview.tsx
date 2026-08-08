'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Component, type ReactNode } from 'react';
import * as THREE from 'three';
import { ShipMesh, type ShipSkin } from './ships';

function Spin({ skin }: { skin: ShipSkin }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_s, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.9; });
  return (
    <group ref={ref} rotation={[0.35, 0, 0]}>
      <ShipMesh skin={skin} scale={1.3} />
    </group>
  );
}

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function ShipPreview({ skin }: { skin: ShipSkin }) {
  return (
    <GLBoundary>
      <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [0, 0.4, 3.4] }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[3, 3, 3]} color={skin.glow} intensity={12} distance={20} />
        <pointLight position={[-3, -1, 2]} color={skin.color} intensity={6} distance={18} />
        <Spin skin={skin} />
      </Canvas>
    </GLBoundary>
  );
}

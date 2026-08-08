'use client';

import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The coin, for real this time — a WebGL disc with engraved faces that leaps,
 * tumbles and lands on the seed's answer. The old CSS coin faked thickness
 * with nine stacked divs; this one has an actual edge, actual light, a
 * landing bounce, and a verdict ring that bursts where it settles.
 *
 * The outcome never depends on the animation: the seed decided it before the
 * coin left the ground, the flip just performs it.
 */

export interface CoinflipScene3DProps {
  /** increments once per flip — arms the tumble */
  spinKey: number;
  /** the round's outcome, known at launch (null before the first flip) */
  resultHeads: boolean | null;
  win: boolean | null;
}

const FLIP_S = 1.05;

/** An engraved coin face painted once: gold for heads' moon, violet for tails' bolt. */
function faceTexture(heads: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(180, 150, 40, 256, 256, 300);
  if (heads) {
    g.addColorStop(0, '#fef3c7');
    g.addColorStop(0.55, '#f59e0b');
    g.addColorStop(1, '#92400e');
  } else {
    g.addColorStop(0, '#ede9fe');
    g.addColorStop(0.55, '#a855f7');
    g.addColorStop(1, '#6b21a8');
  }
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 512);
  // engraved rings
  x.strokeStyle = heads ? 'rgba(120,53,15,0.55)' : 'rgba(76,29,149,0.5)';
  x.lineWidth = 10;
  x.beginPath();
  x.arc(256, 256, 216, 0, Math.PI * 2);
  x.stroke();
  x.setLineDash([16, 12]);
  x.lineWidth = 6;
  x.beginPath();
  x.arc(256, 256, 178, 0, Math.PI * 2);
  x.stroke();
  x.setLineDash([]);
  // glyph — carved on its own layer so destination-out can't hole the gradient
  x.fillStyle = heads ? 'rgba(69,26,3,0.85)' : 'rgba(46,16,101,0.85)';
  if (heads) {
    const layer = document.createElement('canvas');
    layer.width = 512;
    layer.height = 512;
    const lx = layer.getContext('2d')!;
    lx.fillStyle = 'rgba(69,26,3,0.85)';
    lx.beginPath();
    lx.arc(256, 256, 96, 0, Math.PI * 2);
    lx.fill();
    lx.globalCompositeOperation = 'destination-out';
    lx.beginPath();
    lx.arc(300, 222, 84, 0, Math.PI * 2);
    lx.fill();
    x.drawImage(layer, 0, 0);
  } else {
    // bolt
    x.beginPath();
    x.moveTo(282, 140);
    x.lineTo(206, 280);
    x.lineTo(252, 280);
    x.lineTo(226, 380);
    x.lineTo(312, 234);
    x.lineTo(262, 234);
    x.closePath();
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}

function Coin({ spinKey, resultHeads, win }: CoinflipScene3DProps) {
  const grp = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const burst = useRef<THREE.Mesh>(null);
  const start = useRef(-10);
  const from = useRef(0);
  const target = useRef(0);
  const landedAt = useRef(-10);
  const lastKey = useRef(0);

  const heads = useMemo(() => faceTexture(true), []);
  const tails = useMemo(() => faceTexture(false), []);
  useEffect(() => () => { heads.dispose(); tails.dispose(); }, [heads, tails]);

  const mats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: '#8a5f22', metalness: 0.9, roughness: 0.35 }),
      new THREE.MeshStandardMaterial({ map: heads, metalness: 0.55, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: tails, metalness: 0.55, roughness: 0.3 }),
    ],
    [heads, tails],
  );

  // A new spinKey launches the tumble toward this round's face.
  useEffect(() => {
    if (spinKey === lastKey.current || resultHeads === null) return;
    lastKey.current = spinKey;
    start.current = performance.now();
    from.current = target.current;
    const spins = 5;
    // rotX ≡ 0 (mod 2π) shows heads; π shows tails
    const face = resultHeads ? 0 : Math.PI;
    const base = Math.ceil(from.current / (Math.PI * 2)) * Math.PI * 2;
    target.current = base + spins * Math.PI * 2 + face;
  }, [spinKey, resultHeads]);

  useFrame(({ clock }) => {
    const g = grp.current;
    if (!g) return;
    const now = performance.now();
    const t01 = Math.min(1, (now - start.current) / (FLIP_S * 1000));
    const ease = 1 - Math.pow(1 - t01, 3);
    g.rotation.x = from.current + (target.current - from.current) * ease;

    // leap: up and back down over the flip, with a landing bounce
    const h = Math.sin(t01 * Math.PI) * 1.15;
    const bounceAge = (now - start.current) / 1000 - FLIP_S;
    const bounce = bounceAge > 0 && bounceAge < 0.4 ? Math.abs(Math.sin(bounceAge * 16)) * 0.06 * (1 - bounceAge / 0.4) : 0;
    g.position.y = h + bounce;
    // idle breathing once at rest
    if (t01 >= 1) g.position.y += Math.sin(clock.elapsedTime * 1.6) * 0.03;

    if (t01 >= 1 && landedAt.current < start.current) landedAt.current = now;

    if (shadow.current) {
      const s = 1 - h * 0.35;
      shadow.current.scale.set(s, s, 1);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - h * 0.5);
    }
    // verdict ring
    if (burst.current) {
      const m = burst.current.material as THREE.MeshBasicMaterial;
      const age = (now - landedAt.current) / 550;
      if (win !== null && age >= 0 && age < 1) {
        const s = 1 + age * 1.6;
        burst.current.scale.set(s, s, s);
        m.opacity = (1 - age) * 0.85;
        m.color.set(win ? '#10f5a0' : '#ff3b6b');
      } else {
        m.opacity = 0;
      }
    }
  });

  return (
    <group>
      <group ref={grp} rotation={[0, 0, 0]}>
        <mesh material={mats} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1, 1, 0.13, 48]} />
        </mesh>
      </group>
      {/* pedestal shadow */}
      <mesh ref={shadow} position={[0, -1.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {/* verdict ring where the coin settles */}
      <mesh ref={burst} position={[0, -1.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.08, 48]} />
        <meshBasicMaterial transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Rig() {
  const { pointer, camera } = useThree();
  useFrame((_s, dt) => {
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 0.5, 2.5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.35 + pointer.y * 0.3, 2.5, dt);
    camera.lookAt(0, 0.1, 0);
  });
  return null;
}

class GLBoundary extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() { return { broken: true }; }
  render() { return this.state.broken ? null : this.props.children; }
}

export default function CoinflipScene3D(props: CoinflipScene3DProps) {
  return (
    <GLBoundary>
      <Canvas dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} camera={{ fov: 42, position: [0, 0.35, 4.4] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2.5, 4, 4]} intensity={1.6} color="#fff4dc" />
        <pointLight position={[-3, 1.5, 2.5]} color="#a855f7" intensity={6} distance={12} decay={2} />
        <pointLight position={[3, -0.5, 2.5]} color="#22d3ee" intensity={3.5} distance={12} decay={2} />
        <Coin {...props} />
        <Sparkles count={26} scale={[6, 4, 3]} size={1.8} speed={0.2} color="#fde68a" opacity={0.5} position={[0, 0.4, 0]} />
        <Rig />
      </Canvas>
    </GLBoundary>
  );
}

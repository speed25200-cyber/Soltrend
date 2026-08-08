'use client';

import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

/**
 * The wheel as a carnival machine — a real disc with the multipliers printed
 * on the face, a brass rim ringed with strobing lamps, a jewelled hub and a
 * sprung brass pointer, tilted into the light so it reads as an object, not
 * a chart. The spin itself matches the game's 4-second brake exactly: the
 * scene tweens to the same target angle the engine chose.
 */

export interface WheelSegment {
  mult: number;
  color: string;
}

export interface WheelScene3DProps {
  ring: WheelSegment[];
  /** target rotation in degrees — same value the DOM wheel used to animate to */
  rotation: number;
  spinning: boolean;
  /** result multiplier once the wheel settles (null while turning) */
  result: number | null;
}

const COLORS: Record<string, string> = {
  loss: '#242a4d',
  violet: '#a855f7',
  cyan: '#22d3ee',
  gold: '#ffd25f',
};

const SPIN_MS = 4000;

const fmt = (m: number) => (m >= 10 ? m.toFixed(0) : m >= 1 ? String(Math.round(m * 10) / 10) : m.toFixed(1)) + '×';

/** Paint the wheel face once per ring: coloured wedges, separators, labels. */
function paintFace(ring: WheelSegment[]): HTMLCanvasElement {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const n = ring.length;
  const cx = S / 2;
  const seg = (Math.PI * 2) / n;
  // wedges — segment i spans [i, i+1]·seg clockwise from 12 o'clock, exactly
  // the arc the engine's rotation target assumes
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * seg;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.arc(cx, cx, S / 2, a0, a0 + seg);
    ctx.closePath();
    ctx.fillStyle = COLORS[ring[i].color] ?? '#242a4d';
    ctx.fill();
    // wedge shading toward the rim
    const g = ctx.createRadialGradient(cx, cx, S * 0.1, cx, cx, S * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = g;
    ctx.fill();
    // separator
    ctx.strokeStyle = 'rgba(6,8,20,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.lineTo(cx + Math.cos(a0) * (S / 2), cx + Math.sin(a0) * (S / 2));
    ctx.stroke();
  }
  // labels — printed upright along each wedge's spoke
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const mid = -Math.PI / 2 + (i + 0.5) * seg;
    const isLoss = ring[i].mult < 1;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * S * 0.415, cx + Math.sin(mid) * S * 0.415);
    ctx.rotate(mid + Math.PI / 2);
    ctx.font = `900 ${S * 0.032}px Archivo, system-ui, sans-serif`;
    ctx.fillStyle = isLoss ? 'rgba(148,163,184,0.75)' : 'rgba(8,10,24,0.9)';
    ctx.fillText(fmt(ring[i].mult), 0, 0);
    ctx.restore();
  }
  return c;
}

function Wheel({ ring, rotation, spinning }: { ring: WheelSegment[]; rotation: number; spinning: boolean }) {
  const disc = useRef<THREE.Group>(null);
  const tween = useRef({ from: 0, to: 0, start: 0 });

  const face = useMemo(() => {
    const t = new THREE.CanvasTexture(paintFace(ring));
    t.anisotropy = 4;
    return t;
  }, [ring]);
  useEffect(() => () => face.dispose(), [face]);

  // A new rotation target arms the tween; the brake matches the game's 4s.
  useEffect(() => {
    tween.current = { from: tween.current.to, to: rotation, start: performance.now() };
  }, [rotation]);

  useFrame(() => {
    const d = disc.current;
    if (!d) return;
    const { from, to, start } = tween.current;
    const t = Math.min(1, (performance.now() - start) / SPIN_MS);
    const eased = 1 - Math.pow(1 - t, 4); // hard launch, long brake
    const deg = from + (to - from) * eased;
    // CSS rotate() is clockwise-positive; three's z axis is counter-clockwise.
    d.rotation.z = -THREE.MathUtils.degToRad(deg);
  });

  return (
    <group ref={disc}>
      {/* the printed face — in front of the solid rim cylinder's front cap */}
      <mesh position={[0, 0, 0.12]}>
        <circleGeometry args={[2.6, 90]} />
        <meshStandardMaterial map={face} metalness={0.35} roughness={0.45} />
      </mesh>
      {/* glass coat */}
      <mesh position={[0, 0, 0.14]}>
        <circleGeometry args={[2.6, 90]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.06} roughness={0.1} metalness={0} />
      </mesh>
    </group>
  );
}

function Lamps({ spinning }: { spinning: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 20;
  const geo = useMemo(() => new THREE.SphereGeometry(0.075, 10, 8), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      o.position.set(Math.cos(a) * 2.86, Math.sin(a) * 2.86, 0.24);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < N; i++) {
      const phase = clock.elapsedTime * (spinning ? 10 : 1.6) + i * 0.63;
      const v = 0.4 + Math.max(0, Math.sin(phase)) * (spinning ? 1.6 : 0.5);
      col.setRGB(v * 1.5, v * 1.1, v * 0.4);
      m.setColorAt(i, col);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, N]} />;
}

function Pointer({ result }: { result: number | null }) {
  const grp = useRef<THREE.Group>(null);
  const kick = useRef(0);
  useEffect(() => {
    if (result !== null) kick.current = performance.now();
  }, [result]);
  useFrame(({ clock }) => {
    const g = grp.current;
    if (!g) return;
    const since = (performance.now() - kick.current) / 1000;
    const wobble = since < 0.6 ? Math.sin(since * 26) * 0.25 * (1 - since / 0.6) : 0;
    g.rotation.z = wobble + Math.sin(clock.elapsedTime * 0.001) * 0;
  });
  return (
    <group ref={grp} position={[0, 3.02, 0.3]}>
      <mesh rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.16, 0.5, 4]} />
        <meshStandardMaterial color="#f4f6ff" metalness={0.8} roughness={0.2} emissive="#8a90c0" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Rig() {
  const { pointer, camera } = useThree();
  useFrame((_s, dt) => {
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 0.6, 2.5, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.2 + pointer.y * 0.4, 2.5, dt);
    camera.lookAt(0, 0.1, 0);
  });
  return null;
}

function Scene({ ring, rotation, spinning, result }: WheelScene3DProps) {
  return (
    <>
      <color attach="background" args={['#0a0c20']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 6]} intensity={1.5} color="#f1e8ff" />
      <pointLight position={[-5, 1, 4]} color="#a855f7" intensity={7} distance={16} decay={2} />
      <pointLight position={[5, -1, 4]} color="#22d3ee" intensity={5} distance={16} decay={2} />

      {/* backdrop glow */}
      <mesh position={[0, 0, -2.2]}>
        <circleGeometry args={[4.6, 64]} />
        <meshBasicMaterial color="#221a4d" transparent opacity={0.85} />
      </mesh>

      <group rotation={[-0.12, 0, 0]}>
        {/* brass rim */}
        <mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.95, 2.95, 0.26, 90]} />
          <meshStandardMaterial color="#c9932e" metalness={0.9} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <torusGeometry args={[2.95, 0.09, 14, 90]} />
          <meshStandardMaterial color="#e6b455" metalness={0.95} roughness={0.2} />
        </mesh>
        <Wheel ring={ring} rotation={rotation} spinning={spinning} />
        <Lamps spinning={spinning} />
        {/* hub */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.72, 0.78, 0.18, 48]} />
          <meshStandardMaterial color="#1a1f3d" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.3]}>
          <torusGeometry args={[0.72, 0.05, 12, 48]} />
          <meshStandardMaterial color="#e6b455" metalness={0.95} roughness={0.2} />
        </mesh>
        <Pointer result={result} />
      </group>

      <Sparkles count={30} scale={[9, 6, 3]} size={2} speed={0.2} color="#c4b5fd" opacity={0.5} position={[0, 0, 1]} />
      <Rig />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.85} luminanceSmoothing={0.3} />
        <Vignette eskil={false} offset={0.22} darkness={0.74} />
      </EffectComposer>
    </>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Wheel rotation semantics: positive degrees turn the wheel clockwise on
 *  screen, exactly like the DOM version — the cylinder is viewed face-on. */
export default function WheelScene3D(props: WheelScene3DProps) {
  return (
    <GLErrorBoundary fallback={null}>
      <Canvas dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 42, position: [0, 0.2, 8.6] }}>
        <Scene {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

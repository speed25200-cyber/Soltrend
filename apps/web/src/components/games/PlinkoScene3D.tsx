'use client';

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Trail, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

/**
 * Plinko in 3D — a jewelled board: polished brass pins that flash as the ball
 * strikes them, bucket wells lit by how hot their multiplier runs (cool cyan
 * in the safe middle, burning amber at the edges), a glowing ball with a
 * comet trail, and a camera that leans with the pointer. Buckets stay DOM
 * (crisp labels, exact values); the 3D layer owns the drama.
 *
 * Perf: the pin field is two instanced meshes (body + flash shell) whatever
 * the row count, every animation writes refs inside useFrame, and React
 * renders nothing per frame.
 */

export interface PlinkoBall {
  id: string;
  /** 0/1 per row: 0 = left, 1 = right */
  path: number[];
  bucket: number;
}

export interface PlinkoScene3DProps {
  rows: number;
  balls: PlinkoBall[];
  onLand: (ball: PlinkoBall) => void;
}

const SPEED_PER_ROW = 0.085; // seconds per row, matches the DOM deal
const PEG_GAP_X = 0.62;
const ROW_GAP_Y = 0.52;
const TOP_Y = 3.1;

/** Board x for a given path state: sr rights taken after r rows. */
const ballX = (sr: number, r: number, rows: number) => ((2 * sr - r) / (2 * rows)) * (rows * PEG_GAP_X);

/** First peg index of row r in the packed field (row r holds r+3 pegs). */
const rowBase = (r: number) => (r * (r + 5)) / 2;

/** A bucket's temperature 0..1 — how far it sits from the safe centre. */
const bucketHeat = (i: number, buckets: number) => Math.abs(i - (buckets - 1) / 2) / ((buckets - 1) / 2);

const heatColor = (h: number) => {
  // cyan → violet → amber, the same ramp the DOM labels imply
  const c = new THREE.Color();
  if (h < 0.5) c.lerpColors(new THREE.Color('#22d3ee'), new THREE.Color('#a855f7'), h * 2);
  else c.lerpColors(new THREE.Color('#a855f7'), new THREE.Color('#ffb84d'), (h - 0.5) * 2);
  return c;
};

/* ------------------------------------------------------------ the pin field */

function PegField({ rows, hits }: { rows: number; hits: React.MutableRefObject<Float32Array> }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.InstancedMesh>(null);
  const pegs = useMemo(() => {
    const out: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      const count = r + 3;
      const y = TOP_Y - r * ROW_GAP_Y;
      for (let i = 0; i < count; i++) out.push([(i - (count - 1) / 2) * PEG_GAP_X, y]);
    }
    return out;
  }, [rows]);

  const bodyGeo = useMemo(() => new THREE.SphereGeometry(0.075, 12, 10), []);
  const flashGeo = useMemo(() => new THREE.SphereGeometry(0.105, 10, 8), []);
  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f0d493',
        metalness: 0.9,
        roughness: 0.22,
        emissive: '#3a2c10',
        emissiveIntensity: 0.5,
      }),
    [],
  );
  const flashMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  // Lay the field out once per row-count.
  useEffect(() => {
    const o = new THREE.Object3D();
    const dark = new THREE.Color('#000000');
    for (const m of [bodyRef.current, flashRef.current]) {
      if (!m) continue;
      pegs.forEach(([x, y], i) => {
        o.position.set(x, y, 0);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        if (m === flashRef.current) m.setColorAt(i, dark);
      });
      m.count = pegs.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [pegs]);

  // Decay every strike flash toward black; struck pins ring violet-white.
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const m = flashRef.current;
    if (!m) return;
    const now = clock.elapsedTime;
    const h = hits.current;
    let any = false;
    for (let i = 0; i < pegs.length; i++) {
      const dt = now - h[i];
      const v = h[i] > 0 && dt < 1.2 ? Math.exp(-dt * 5.5) : 0;
      if (v > 0.003) any = true;
      col.setRGB(v * 1.6, v * 1.1, v * 2.2);
      m.setColorAt(i, col);
    }
    if (m.instanceColor && any) m.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[bodyGeo, bodyMat, pegs.length]} />
      <instancedMesh ref={flashRef} args={[flashGeo, flashMat, pegs.length]} />
    </group>
  );
}

/* ----------------------------------------------------------------- the ball */

function Ball({
  rows,
  ball,
  onLand,
  hits,
}: {
  rows: number;
  ball: PlinkoBall;
  onLand: (b: PlinkoBall) => void;
  hits: React.MutableRefObject<Float32Array>;
}) {
  const grp = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  const lastRow = useRef(-1);
  const done = useRef(false);
  const total = rows * SPEED_PER_ROW;

  useFrame(({ clock }, dt) => {
    const g = grp.current;
    if (!g || done.current) return;
    t.current += dt;
    const x01 = Math.min(1, t.current / total);
    const progress = x01 * rows;
    const r = Math.min(rows, Math.floor(progress));
    const frac = progress - r;

    // position along the path: smooth between row r and r+1
    const sr = ball.path.slice(0, r).reduce((a, b) => a + b, 0);
    const srNext = sr + (ball.path[r] ?? 0);
    const x0 = ballX(sr, r, rows);
    const x1 = ballX(srNext, Math.min(rows, r + 1), rows);
    // sine ease between rows + a little gravity dip
    const k = (1 - Math.cos(frac * Math.PI)) / 2;
    const x = x0 + (x1 - x0) * k;
    const y = TOP_Y - progress * ROW_GAP_Y - Math.sin(frac * Math.PI) * 0.09;
    g.position.set(x, y, 0.1);

    // ring the pin the ball just kissed
    if (r !== lastRow.current && r > 0 && r <= rows) {
      lastRow.current = r;
      const pegId = rowBase(r - 1) + sr + 1;
      if (pegId >= 0 && pegId < hits.current.length) hits.current[pegId] = clock.elapsedTime;
    }

    // squash each time the ball crosses a pin
    const pulse = Math.abs(Math.sin(frac * Math.PI));
    g.scale.set(1 - pulse * 0.18, 1 - pulse * 0.3, 1 - pulse * 0.18);
    if (glow.current) glow.current.intensity = 6 + pulse * 5;

    if (x01 >= 1) {
      done.current = true;
      onLand(ball);
    }
  });

  return (
    <group ref={grp} position={[0, TOP_Y, 0.1]}>
      <Trail width={1.2} length={5} color={new THREE.Color('#a855f7')} attenuation={(tt) => tt * tt}>
        <mesh>
          <sphereGeometry args={[0.11, 16, 14]} />
          <meshStandardMaterial color="#f3e8ff" emissive="#b06bff" emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
      </Trail>
      <pointLight ref={glow} color="#a855f7" intensity={7} distance={3.5} decay={2} />
    </group>
  );
}

/* -------------------------------------------------------------- bucket wells */

function BucketWells({ rows, landed }: { rows: number; landed: number | null }) {
  const buckets = rows + 1;
  const floorY = TOP_Y - rows * ROW_GAP_Y - 0.42;
  const glowRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const flare = useRef({ bucket: -1, t: 0 });

  useEffect(() => {
    if (landed !== null) flare.current = { bucket: landed, t: performance.now() };
  }, [landed]);

  useFrame(({ clock }) => {
    const now = performance.now();
    for (let i = 0; i < buckets; i++) {
      const m = glowRefs.current[i];
      if (!m) continue;
      const heat = bucketHeat(i, buckets);
      const idle = 0.16 + heat * 0.3 + Math.sin(clock.elapsedTime * 2 + i * 1.3) * 0.05;
      const hit = flare.current.bucket === i ? Math.exp(-(now - flare.current.t) / 320) : 0;
      m.opacity = Math.min(1, idle + hit * 1.2);
    }
  });

  return (
    <group>
      {Array.from({ length: buckets }).map((_, i) => {
        const x = (i - (buckets - 1) / 2) * PEG_GAP_X * 1.05;
        const heat = bucketHeat(i, buckets);
        const c = heatColor(heat);
        return (
          <group key={i} position={[x, floorY, 0]}>
            {/* the well's glow — a lit column facing the player */}
            <mesh position={[0, 0.14, 0.02]}>
              <planeGeometry args={[PEG_GAP_X * 0.86, 0.6]} />
              <meshBasicMaterial
                ref={(m) => { glowRefs.current[i] = m; }}
                color={c}
                transparent
                opacity={0.2}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0.06]}>
              <planeGeometry args={[PEG_GAP_X * 0.92, 0.44]} />
              <meshBasicMaterial color={c} transparent opacity={0.1 + heat * 0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
      {/* dividers */}
      {Array.from({ length: buckets + 1 }).map((_, i) => (
        <mesh key={`d${i}`} position={[(i - buckets / 2) * PEG_GAP_X * 1.05, floorY + 0.22, -0.02]}>
          <boxGeometry args={[0.05, 0.62, 0.3]} />
          <meshStandardMaterial color="#b7bede" emissive="#4a4f80" emissiveIntensity={0.55} metalness={0.75} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function LandingBurst({ rows, bucket }: { rows: number; bucket: number | null }) {
  const ring = useRef<THREE.Mesh>(null);
  const start = useRef(0);
  useEffect(() => {
    if (bucket !== null) start.current = performance.now();
  }, [bucket]);
  const buckets = rows + 1;
  useFrame(() => {
    const m = ring.current;
    if (!m) return;
    const age = (performance.now() - start.current) / 480;
    const mat = m.material as THREE.MeshBasicMaterial;
    if (bucket === null || age >= 1) {
      mat.opacity = 0;
      return;
    }
    const x = (bucket - (buckets - 1) / 2) * PEG_GAP_X * 1.05;
    m.position.set(x, TOP_Y - rows * ROW_GAP_Y - 0.42, 0.12);
    const s = 0.25 + age * 1.15;
    m.scale.set(s, s, s);
    mat.opacity = (1 - age) * 0.9;
    mat.color.copy(heatColor(bucketHeat(bucket, buckets)));
  });
  return (
    <mesh ref={ring}>
      <ringGeometry args={[0.42, 0.52, 40]} />
      <meshBasicMaterial transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------- the set */

/** Deep-space backdrop: a violet core glowing behind the board, falling away
 *  to black — painted once, one quad. */
function Backdrop({ rows }: { rows: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(256, 230, 40, 256, 256, 340);
    g.addColorStop(0, '#2b2158');
    g.addColorStop(0.45, '#171238');
    g.addColorStop(1, '#07091c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const midY = TOP_Y - rows * ROW_GAP_Y * 0.5 + 0.3;
  return (
    <group>
      <mesh position={[0, midY, -3.2]}>
        <planeGeometry args={[34, 22]} />
        <meshBasicMaterial map={tex} fog={false} />
      </mesh>
      {/* light shaft behind the funnel */}
      <mesh position={[0, midY + 1.2, -1.4]}>
        <planeGeometry args={[2.6, 14]} />
        <meshBasicMaterial color="#7c5cff" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CamRig({ rows }: { rows: number }) {
  const { pointer } = useThree();
  const look = useMemo(() => new THREE.Vector3(0, TOP_Y - rows * ROW_GAP_Y * 0.5, 0), [rows]);
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const tx = Math.sin(t * 0.22) * 0.22 + pointer.x * 0.5;
    const ty = look.y + 0.7 + pointer.y * 0.3;
    s.camera.position.x = THREE.MathUtils.damp(s.camera.position.x, tx, 2.5, dt);
    s.camera.position.y = THREE.MathUtils.damp(s.camera.position.y, ty, 2.5, dt);
    s.camera.position.z = THREE.MathUtils.damp(s.camera.position.z, 4.4 + rows * 0.42, 2, dt);
    s.camera.lookAt(look);
  });
  return null;
}

function Board({ rows, balls, onLand }: PlinkoScene3DProps) {
  const [landedBucket, setLandedBucket] = useState<number | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // one shared strike ledger: Ball writes timestamps, PegField reads them
  const hits = useRef(new Float32Array(rowBase(16) + 32));
  const width = (rows + 2) * PEG_GAP_X + 0.6;
  const height = rows * ROW_GAP_Y + 1.9;
  const midY = TOP_Y - rows * ROW_GAP_Y * 0.5 + 0.3;

  const handleLand = (b: PlinkoBall) => {
    setLandedBucket(b.bucket);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setLandedBucket(null), 900);
    onLand(b);
  };

  return (
    <>
      <color attach="background" args={['#07091c']} />
      <fog attach="fog" args={['#0b0e22', 10, 26]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 3, 6]} intensity={1.25} color="#dbe4ff" />
      {/* stage rims: cyan from the left, magenta from the right */}
      <pointLight position={[-width * 0.9, midY, 2.2]} color="#22d3ee" intensity={8} distance={16} decay={2} />
      <pointLight position={[width * 0.9, midY, 2.2]} color="#d946ef" intensity={8} distance={16} decay={2} />
      <pointLight position={[0, TOP_Y + 2, 3]} color="#a855f7" intensity={7} distance={14} decay={2} />

      <Backdrop rows={rows} />

      {/* board backplate — smoked glass with a jewelled edge */}
      <mesh position={[0, midY, -0.35]}>
        <boxGeometry args={[width, height, 0.14]} />
        <meshStandardMaterial color="#141936" emissive="#0d1230" emissiveIntensity={0.5} metalness={0.7} roughness={0.4} />
      </mesh>
      {/* neon edge lines riding the front face of the rails */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2), midY, 0.09]}>
          <planeGeometry args={[0.06, height]} />
          <meshBasicMaterial color={s < 0 ? '#22d3ee' : '#d946ef'} transparent opacity={1} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      {/* rails */}
      {[-width / 2, width / 2].map((x, i) => (
        <mesh key={i} position={[x, midY, -0.1]}>
          <boxGeometry args={[0.14, height, 0.34]} />
          <meshStandardMaterial color="#d9b264" emissive="#553a10" emissiveIntensity={0.4} metalness={0.92} roughness={0.24} />
        </mesh>
      ))}
      {/* funnel */}
      <mesh position={[0, TOP_Y + 0.55, 0]}>
        <cylinderGeometry args={[0.42, 0.16, 0.5, 24, 1, true]} />
        <meshStandardMaterial color="#d9b264" emissive="#553a10" emissiveIntensity={0.4} metalness={0.92} roughness={0.24} side={THREE.DoubleSide} />
      </mesh>

      <PegField rows={rows} hits={hits} />
      <BucketWells rows={rows} landed={landedBucket} />
      <Sparkles count={40} scale={[width + 2, height + 2, 3]} size={2.2} speed={0.2} color="#8b7cf7" position={[0, midY, 0.8]} opacity={0.5} />
      {balls.map((b) => (
        <Ball key={b.id} rows={rows} ball={b} onLand={handleLand} hits={hits} />
      ))}
      <LandingBurst rows={rows} bucket={landedBucket} />

      <CamRig rows={rows} />
      <EffectComposer multisampling={0}>
        {/* only true emitters bloom: the ball, pin flashes, neon edges, wells */}
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.78} luminanceSmoothing={0.3} />
        <Vignette eskil={false} offset={0.24} darkness={0.78} />
      </EffectComposer>
    </>
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function PlinkoScene3D(props: PlinkoScene3DProps) {
  return (
    <GLErrorBoundary fallback={null}>
      <Canvas dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 48, position: [0, 1, 9] }}>
        <Board {...props} />
      </Canvas>
    </GLErrorBoundary>
  );
}

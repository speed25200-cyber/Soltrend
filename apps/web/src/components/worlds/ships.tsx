'use client';

/**
 * Ship avatars — the player's identity across the 3D layer (Crash rocket, lobby
 * plaza, orbiting ships). Each skin is a fully procedural, multi-part model —
 * hull, cockpit canopy, wings, engine nozzles with emissive thrusters — so
 * there are no external assets and everything renders self-contained on the
 * static site. The emissive thrusters are picked up by the scene bloom, which
 * is what makes the ships read as "lit from within" rather than flat plastic.
 */

export type ShipKind = 'dart' | 'delta' | 'orbiter' | 'saucer' | 'comet' | 'talon';

export interface ShipSkin {
  id: ShipKind;
  label: string;
  color: string;
  glow: string;
  trail: number; // relative trail length
}

export const SHIP_SKINS: ShipSkin[] = [
  { id: 'dart', label: 'Dart', color: '#a855f7', glow: '#d8b4fe', trail: 7 },
  { id: 'delta', label: 'Delta', color: '#22d3ee', glow: '#67e8f9', trail: 6 },
  { id: 'orbiter', label: 'Orbiter', color: '#10f5a0', glow: '#6ee7b7', trail: 5 },
  { id: 'saucer', label: 'Saucer', color: '#ffd25f', glow: '#fde68a', trail: 4 },
  { id: 'comet', label: 'Comet', color: '#ec4899', glow: '#f9a8d4', trail: 10 },
  { id: 'talon', label: 'Talon', color: '#fb923c', glow: '#fdba74', trail: 6 },
];

export const shipById = (id: string): ShipSkin => SHIP_SKINS.find((s) => s.id === id) ?? SHIP_SKINS[0];

/** Brushed-metal hull. */
const hullMat = (color: string, emissive: number) => ({
  color,
  emissive: color,
  emissiveIntensity: 0.18 * emissive,
  metalness: 0.85,
  roughness: 0.24,
});

/** Smoked-glass cockpit canopy. */
const canopyMat = {
  color: '#9fd8ff',
  emissive: '#67e8f9',
  emissiveIntensity: 0.35,
  metalness: 0.1,
  roughness: 0.06,
  transparent: true,
  opacity: 0.6,
};

/** Dark structural parts (intakes, wing roots, rings). */
const darkMat = { color: '#12162a', metalness: 0.9, roughness: 0.35 };

/** Engine thruster — hot emissive core that the bloom pass blows out nicely. */
const glowMat = (glow: string, emissive: number) => ({
  color: glow,
  emissive: glow,
  emissiveIntensity: 2.6 * emissive,
  toneMapped: false,
});

/** One engine: a dark nozzle with a glowing core at its mouth. */
function Thruster({ position, radius = 0.09, glow, emissive }: { position: [number, number, number]; radius?: number; glow: string; emissive: number }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius * 1.5, radius * 2.4, 12]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>
      <mesh position={[0, -radius * 1.5, 0]}>
        <sphereGeometry args={[radius * 0.8, 10, 10]} />
        <meshStandardMaterial {...glowMat(glow, emissive)} />
      </mesh>
    </group>
  );
}

/** The mesh for a ship skin. Parent positions/orients it; nose points +Y. */
export function ShipMesh({ skin, scale = 1, emissive = 1.3 }: { skin: ShipSkin; scale?: number; emissive?: number }) {
  const hull = hullMat(skin.color, emissive);
  switch (skin.id) {
    case 'delta':
      return (
        <group scale={scale}>
          {/* wide delta wing */}
          <mesh scale={[1.7, 1, 0.28]} rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[0.9, 0.9, 0.9]} />
            <meshStandardMaterial {...hull} flatShading />
          </mesh>
          {/* central spine */}
          <mesh position={[0, 0.15, 0]}>
            <coneGeometry args={[0.24, 1.1, 4]} />
            <meshStandardMaterial {...hull} flatShading />
          </mesh>
          {/* canopy */}
          <mesh position={[0, 0.22, 0.02]} scale={[1, 1.4, 0.8]}>
            <sphereGeometry args={[0.13, 14, 12]} />
            <meshStandardMaterial {...canopyMat} />
          </mesh>
          {/* twin tail fins */}
          <mesh position={[0.3, -0.42, 0]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.05, 0.3, 0.16]} />
            <meshStandardMaterial {...darkMat} />
          </mesh>
          <mesh position={[-0.3, -0.42, 0]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.05, 0.3, 0.16]} />
            <meshStandardMaterial {...darkMat} />
          </mesh>
          <Thruster position={[0.24, -0.5, 0]} glow={skin.glow} emissive={emissive} />
          <Thruster position={[-0.24, -0.5, 0]} glow={skin.glow} emissive={emissive} />
        </group>
      );
    case 'orbiter':
      return (
        <group scale={scale}>
          {/* capsule cockpit */}
          <mesh scale={[1, 1.25, 1]}>
            <sphereGeometry args={[0.34, 20, 18]} />
            <meshStandardMaterial {...hull} />
          </mesh>
          <mesh position={[0, 0.16, 0]} scale={[1, 0.9, 1]}>
            <sphereGeometry args={[0.2, 16, 14]} />
            <meshStandardMaterial {...canopyMat} />
          </mesh>
          {/* gyro ring */}
          <mesh rotation={[Math.PI / 2.2, 0, 0]}>
            <torusGeometry args={[0.58, 0.045, 12, 36]} />
            <meshStandardMaterial {...darkMat} metalness={0.95} roughness={0.2} />
          </mesh>
          <mesh rotation={[Math.PI / 2.2, 0, 0]}>
            <torusGeometry args={[0.58, 0.018, 8, 36]} />
            <meshStandardMaterial {...glowMat(skin.glow, emissive * 0.7)} />
          </mesh>
          <Thruster position={[0.3, -0.42, 0]} radius={0.07} glow={skin.glow} emissive={emissive} />
          <Thruster position={[-0.3, -0.42, 0]} radius={0.07} glow={skin.glow} emissive={emissive} />
        </group>
      );
    case 'saucer':
      return (
        <group scale={scale}>
          {/* disc */}
          <mesh scale={[1, 0.3, 1]}>
            <sphereGeometry args={[0.62, 28, 18]} />
            <meshStandardMaterial {...hull} />
          </mesh>
          {/* rim band */}
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.5]}>
            <torusGeometry args={[0.6, 0.05, 10, 40]} />
            <meshStandardMaterial {...darkMat} />
          </mesh>
          {/* dome */}
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.27, 18, 14]} />
            <meshStandardMaterial {...canopyMat} />
          </mesh>
          {/* rim lights */}
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.52, -0.06, Math.sin(a) * 0.52]}>
                <sphereGeometry args={[0.045, 8, 8]} />
                <meshStandardMaterial {...glowMat(skin.glow, emissive)} />
              </mesh>
            );
          })}
          {/* under-glow engine */}
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial {...glowMat(skin.glow, emissive * 1.2)} />
          </mesh>
        </group>
      );
    case 'comet':
      return (
        <group scale={scale}>
          {/* faceted crystal hull */}
          <mesh>
            <icosahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial {...hull} flatShading metalness={0.7} roughness={0.18} />
          </mesh>
          {/* molten core visible through the facets */}
          <mesh scale={0.62}>
            <icosahedronGeometry args={[0.42, 1]} />
            <meshStandardMaterial {...glowMat(skin.glow, emissive)} />
          </mesh>
          {/* tail fins */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, -0.42, 0]} rotation={[0.5, (i / 3) * Math.PI * 2, 0]}>
              <boxGeometry args={[0.05, 0.34, 0.2]} />
              <meshStandardMaterial {...darkMat} />
            </mesh>
          ))}
          <mesh position={[0, -0.52, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshStandardMaterial {...glowMat(skin.glow, emissive * 1.4)} />
          </mesh>
        </group>
      );
    case 'talon':
      return (
        <group scale={scale}>
          {/* fuselage */}
          <mesh>
            <coneGeometry args={[0.26, 1.25, 3]} />
            <meshStandardMaterial {...hull} flatShading />
          </mesh>
          {/* canopy slit */}
          <mesh position={[0, 0.2, 0.02]} scale={[1, 1.8, 0.7]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial {...canopyMat} />
          </mesh>
          {/* forward-swept blades */}
          <mesh position={[0.34, 0.05, 0]} rotation={[0, 0, -0.9]}>
            <boxGeometry args={[0.62, 0.05, 0.16]} />
            <meshStandardMaterial {...hull} />
          </mesh>
          <mesh position={[-0.34, 0.05, 0]} rotation={[0, 0, 0.9]}>
            <boxGeometry args={[0.62, 0.05, 0.16]} />
            <meshStandardMaterial {...hull} />
          </mesh>
          {/* blade tips */}
          <mesh position={[0.58, 0.28, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial {...glowMat(skin.glow, emissive)} />
          </mesh>
          <mesh position={[-0.58, 0.28, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial {...glowMat(skin.glow, emissive)} />
          </mesh>
          <Thruster position={[0, -0.58, 0]} glow={skin.glow} emissive={emissive} />
        </group>
      );
    default: // dart
      return (
        <group scale={scale}>
          {/* fuselage */}
          <mesh>
            <coneGeometry args={[0.3, 1.3, 24]} />
            <meshStandardMaterial {...hull} />
          </mesh>
          {/* canopy */}
          <mesh position={[0, 0.14, 0]} scale={[1, 1.6, 1]}>
            <sphereGeometry args={[0.14, 16, 14]} />
            <meshStandardMaterial {...canopyMat} />
          </mesh>
          {/* swept wings */}
          <mesh position={[0.26, -0.34, 0]} rotation={[0, 0, -0.35]}>
            <boxGeometry args={[0.5, 0.05, 0.2]} />
            <meshStandardMaterial {...hull} />
          </mesh>
          <mesh position={[-0.26, -0.34, 0]} rotation={[0, 0, 0.35]}>
            <boxGeometry args={[0.5, 0.05, 0.2]} />
            <meshStandardMaterial {...hull} />
          </mesh>
          {/* wing tip lights */}
          <mesh position={[0.5, -0.42, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial {...glowMat(skin.glow, emissive)} />
          </mesh>
          <mesh position={[-0.5, -0.42, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial {...glowMat(skin.glow, emissive)} />
          </mesh>
          {/* engine block + twin thrusters */}
          <mesh position={[0, -0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.24, 0.3, 16]} />
            <meshStandardMaterial {...darkMat} />
          </mesh>
          <Thruster position={[0.09, -0.72, 0]} radius={0.06} glow={skin.glow} emissive={emissive} />
          <Thruster position={[-0.09, -0.72, 0]} radius={0.06} glow={skin.glow} emissive={emissive} />
        </group>
      );
  }
}

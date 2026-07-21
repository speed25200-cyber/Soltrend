'use client';

/**
 * Ship avatars — the player's identity across the 3D layer (Crash rocket, lobby
 * plaza, orbiting ships). Each skin is a small procedural mesh, so there are no
 * external assets and everything renders self-contained on the static site.
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

/** The mesh for a ship skin. Parent positions/orients it; nose points +Y. */
export function ShipMesh({ skin, scale = 1, emissive = 1.3 }: { skin: ShipSkin; scale?: number; emissive?: number }) {
  const mat = { color: skin.color, emissive: skin.glow, emissiveIntensity: emissive, metalness: 0.5, roughness: 0.22 };
  switch (skin.id) {
    case 'delta':
      return (
        <group scale={scale}>
          <mesh><coneGeometry args={[0.5, 1.0, 4]} /><meshStandardMaterial {...mat} /></mesh>
          <mesh position={[0, -0.35, 0]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[1.2, 0.06, 0.28]} /><meshStandardMaterial {...mat} /></mesh>
        </group>
      );
    case 'orbiter':
      return (
        <group scale={scale}>
          <mesh><sphereGeometry args={[0.42, 20, 20]} /><meshStandardMaterial {...mat} /></mesh>
          <mesh rotation={[Math.PI / 2.2, 0, 0]}><torusGeometry args={[0.62, 0.05, 12, 32]} /><meshStandardMaterial color={skin.glow} emissive={skin.glow} emissiveIntensity={1.4} /></mesh>
        </group>
      );
    case 'saucer':
      return (
        <group scale={scale}>
          <mesh scale={[1, 0.32, 1]}><sphereGeometry args={[0.6, 24, 16]} /><meshStandardMaterial {...mat} /></mesh>
          <mesh position={[0, 0.16, 0]}><sphereGeometry args={[0.28, 16, 12]} /><meshStandardMaterial color={skin.glow} emissive={skin.glow} emissiveIntensity={1.2} transparent opacity={0.85} /></mesh>
        </group>
      );
    case 'comet':
      return (
        <group scale={scale}>
          <mesh><icosahedronGeometry args={[0.44, 0]} /><meshStandardMaterial {...mat} flatShading /></mesh>
        </group>
      );
    case 'talon':
      return (
        <group scale={scale}>
          <mesh><coneGeometry args={[0.34, 1.1, 3]} /><meshStandardMaterial {...mat} /></mesh>
          <mesh position={[0.3, -0.2, 0]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.5, 0.05, 0.18]} /><meshStandardMaterial {...mat} /></mesh>
          <mesh position={[-0.3, -0.2, 0]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.5, 0.05, 0.18]} /><meshStandardMaterial {...mat} /></mesh>
        </group>
      );
    default: // dart
      return (
        <group scale={scale}>
          <mesh><coneGeometry args={[0.36, 1.15, 18]} /><meshStandardMaterial {...mat} /></mesh>
          <mesh position={[0, -0.5, 0]}><cylinderGeometry args={[0.12, 0.3, 0.5, 12]} /><meshStandardMaterial color="#ffffff" emissive={skin.glow} emissiveIntensity={0.5} metalness={0.6} roughness={0.3} /></mesh>
        </group>
      );
  }
}

'use client';

import { useMemo } from 'react';
import { pixelAt, type Sprite } from '@/lib/sprites';

/**
 * Crisp, dependency-free sprite renderer. Emits one <rect> per painted cell so
 * it scales sharply at any size and stays theme-agnostic (works in static
 * export, no canvas ref lifecycle). Transparent cells are simply skipped.
 */
export function SpriteGlyph({ sprite, size = 32, className }: { sprite: Sprite; size?: number; className?: string }) {
  const rects = useMemo(() => {
    const out: { x: number; y: number; fill: string }[] = [];
    for (let y = 0; y < sprite.grid; y++) {
      for (let x = 0; x < sprite.grid; x++) {
        const c = pixelAt(sprite, x, y);
        const fill = sprite.palette[c];
        if (c > 0 && fill && fill !== 'transparent') out.push({ x, y, fill });
      }
    }
    return out;
  }, [sprite]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${sprite.grid} ${sprite.grid}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={sprite.name}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={1.02} height={1.02} fill={r.fill} />
      ))}
    </svg>
  );
}

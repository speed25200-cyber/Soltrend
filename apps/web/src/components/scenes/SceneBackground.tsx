'use client';

import { useEffect, useRef } from 'react';
import type { BackgroundId, Palette } from '@/lib/presentation';

/** Animated backdrop behind a game scene. Canvas for coins/grid/stars; the
 *  aurora is a soft CSS gradient. Kept lightweight (one rAF loop). */
export function SceneBackground({ background, palette }: { background: BackgroundId; palette: Palette }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (background === 'none' || background === 'aurora') return;
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const rnd = (() => {
      let s = 123456789;
      return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    })();

    type Particle = { x: number; y: number; v: number; size: number; a: number };
    let parts: Particle[] = [];
    const init = (n: number) =>
      (parts = Array.from({ length: n }, () => ({ x: rnd() * 1000, y: rnd() * 600, v: 0.4 + rnd() * 1.6, size: 1 + rnd() * 3, a: rnd() })));

    if (background === 'coins') init(26);
    if (background === 'stars') init(70);

    let t = 0;
    const draw = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      t += 1;

      if (background === 'grid') {
        const gap = 34;
        const pulse = 0.05 + 0.04 * (0.5 + 0.5 * Math.sin(t / 40));
        ctx.strokeStyle = hexA(palette.primary, pulse);
        ctx.lineWidth = 1;
        const off = (t / 2) % gap;
        for (let x = -off; x < w; x += gap) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = -off; y < h; y += gap) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      } else if (background === 'stars') {
        for (const p of parts) {
          p.x -= p.v * 0.4;
          if (p.x < 0) { p.x = w; p.y = rnd() * h; }
          const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t / 20 + p.a * 10));
          ctx.fillStyle = hexA(p.a > 0.6 ? palette.secondary : '#ffffff', 0.6 * tw);
          ctx.fillRect(p.x % w, p.y % h, p.size * 0.8, p.size * 0.8);
        }
      } else if (background === 'coins') {
        for (const p of parts) {
          p.y += p.v * 1.4;
          p.x += Math.sin((t + p.a * 100) / 30) * 0.4;
          if (p.y > h + 10) { p.y = -10; p.x = rnd() * w; }
          ctx.beginPath();
          ctx.ellipse(p.x % w, p.y, p.size * 2.4, p.size * 3, 0, 0, Math.PI * 2);
          ctx.fillStyle = hexA('#ffd25f', 0.16);
          ctx.fill();
          ctx.strokeStyle = hexA('#f59e0b', 0.22);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [background, palette]);

  if (background === 'none') return null;
  if (background === 'aurora') {
    return (
      <div
        className="pointer-events-none absolute inset-0 animate-pulse-glow"
        style={{ background: `radial-gradient(60% 60% at 30% 20%, ${hexA(palette.primary, 0.18)}, transparent 60%), radial-gradient(50% 50% at 80% 90%, ${hexA(palette.secondary, 0.16)}, transparent 60%)` }}
      />
    );
  }
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

function hexA(color: string, a: number): string {
  // Supports #rrggbb and hsl(...) → wrap alpha via rgba/hsla best-effort.
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  if (color.startsWith('hsl')) return color.replace('hsl', 'hsla').replace(')', ` / ${a})`);
  return color;
}

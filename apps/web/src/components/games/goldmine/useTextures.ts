'use client';

import { useEffect, useState } from 'react';

/**
 * Procedural material textures, painted once per session on a 2D canvas and
 * served as data URIs. Real wood grain, parchment and brushed brass — because
 * they are plain canvas drawings (no WebGL, no external assets), they render
 * identically on every device, from a phone to a retina desktop.
 */

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Honeyed oak: long grain streaks, knots, subtle tone variation. */
function paintWood(size = 512): string | null {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const rnd = mulberry(20260801);

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#8a5f2e');
  g.addColorStop(0.5, '#7a5230');
  g.addColorStop(1, '#5b3a1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // long grain streaks
  for (let i = 0; i < 130; i++) {
    const y = rnd() * size;
    const dark = rnd() > 0.45;
    ctx.strokeStyle = dark ? `rgba(46,26,10,${0.05 + rnd() * 0.14})` : `rgba(255,220,160,${0.04 + rnd() * 0.08})`;
    ctx.lineWidth = 0.6 + rnd() * 2.2;
    ctx.beginPath();
    let x = -20;
    ctx.moveTo(x, y);
    while (x < size + 20) {
      x += 30 + rnd() * 60;
      ctx.lineTo(x, y + (rnd() - 0.5) * 10);
    }
    ctx.stroke();
  }
  // knots
  for (let i = 0; i < 5; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    for (let r = 3; r < 16; r += 2.5) {
      ctx.strokeStyle = `rgba(40,22,8,${0.1 - r * 0.004})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r, rnd() * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // speckle
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '30,18,6' : '255,230,170'},${rnd() * 0.05})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1, 1);
  }
  return c.toDataURL('image/png');
}

/** Old parchment: cream base, fibers, faint stains, soft vignette. */
function paintParchment(size = 256): string | null {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const rnd = mulberry(70777);

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#faf0d8');
  g.addColorStop(0.55, '#f2dfae');
  g.addColorStop(1, '#e2c184');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // fibers
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = `rgba(160,120,60,${0.03 + rnd() * 0.06})`;
    ctx.lineWidth = 0.5 + rnd();
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 26, y + (rnd() - 0.5) * 26);
    ctx.stroke();
  }
  // stains
  for (let i = 0; i < 7; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 12 + rnd() * 30;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
    sg.addColorStop(0, `rgba(150,100,40,${0.05 + rnd() * 0.06})`);
    sg.addColorStop(1, 'rgba(150,100,40,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // vignette
  const v = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.75);
  v.addColorStop(0, 'rgba(122,72,20,0)');
  v.addColorStop(1, 'rgba(122,72,20,0.22)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, size, size);
  return c.toDataURL('image/png');
}

/** Brushed brass for the frame fittings: warm metal with fine strokes. */
function paintBrass(size = 128): string | null {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const rnd = mulberry(4242);

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#f3d98b');
  g.addColorStop(0.5, '#c9a35a');
  g.addColorStop(1, '#8a6528');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 240; i++) {
    const y = rnd() * size;
    ctx.strokeStyle = rnd() > 0.5 ? `rgba(255,240,190,${0.05 + rnd() * 0.1})` : `rgba(90,60,15,${0.05 + rnd() * 0.1})`;
    ctx.lineWidth = 0.5 + rnd();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rnd() - 0.5) * 4);
    ctx.stroke();
  }
  return c.toDataURL('image/png');
}

export interface ProcTextures {
  wood: string | null;
  parchment: string | null;
  brass: string | null;
}

/** Paints the three material textures once, client-side (null on SSR/failure). */
export function useProcTextures(): ProcTextures {
  const [tex, setTex] = useState<ProcTextures>({ wood: null, parchment: null, brass: null });
  useEffect(() => {
    try {
      setTex({ wood: paintWood(), parchment: paintParchment(), brass: paintBrass() });
    } catch {
      /* fall back to the flat gradients declared in CSS */
    }
  }, []);
  return tex;
}

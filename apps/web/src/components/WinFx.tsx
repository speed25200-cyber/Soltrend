'use client';

import { useEffect, useRef } from 'react';

type Shape = 'rect' | 'coin' | 'spark';
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  shape: Shape;
}
interface Ring {
  r: number;
  life: number;
  color: string;
}

const COLORS = ['#10f5a0', '#a855f7', '#d946ef', '#22d3ee', '#ffd25f', '#ffffff'];

/**
 * Full-screen celebration layer. Listens for `soltrend:win` / `soltrend:jackpot`
 * and plays the win-effect STYLE the game chose (confetti / coins / sparks /
 * rings), in the game's colours, scaled to the multiplier.
 */
export function WinFx() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<P[]>([]);
  const rings = useRef<Ring[]>([]);
  const shock = useRef<{ r: number; life: number } | null>(null);
  const raf = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (count: number, big: boolean, style: string, colors: string[]) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.34;
      const pick = () => colors[(Math.random() * colors.length) | 0];

      if (style === 'rings') {
        for (let k = 0; k < 3; k++) rings.current.push({ r: k * 18, life: 0, color: pick() });
        if (big) shock.current = { r: 0, life: 0 };
        return;
      }
      const shape: Shape = style === 'coins' ? 'coin' : style === 'sparks' ? 'spark' : 'rect';
      for (let i = 0; i < count; i++) {
        const a = Math.PI * 2 * (i / count) + Math.random() * 0.5;
        const speed = 4 + Math.random() * (big ? 12 : 7);
        particles.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 3,
          life: 0,
          max: 60 + Math.random() * 50,
          size: (shape === 'coin' ? 5 : 4) + Math.random() * (big ? 7 : 4),
          color: shape === 'coin' ? (Math.random() < 0.7 ? '#ffd25f' : '#f59e0b') : pick(),
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          shape,
        });
      }
      if (big) shock.current = { r: 0, life: 0 };
    };

    const onWin = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      const mult = d.mult ?? 2;
      const big = mult >= 10;
      spawn(big ? 160 : mult >= 3 ? 90 : 46, big, d.style || 'confetti', d.colors || COLORS);
    };
    const onJackpot = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      spawn(220, true, 'coins', d.colors || ['#ffd25f', '#f59e0b', '#fde68a']);
    };
    window.addEventListener('soltrend:win', onWin);
    window.addEventListener('soltrend:jackpot', onJackpot as EventListener);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.34;

      if (shock.current) {
        const s = shock.current;
        s.r += 14;
        s.life += 1;
        ctx.beginPath();
        ctx.arc(cx, cy, s.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,210,95,${Math.max(0, 0.5 - s.life / 40)})`;
        ctx.lineWidth = 6;
        ctx.stroke();
        if (s.life > 40) shock.current = null;
      }

      for (let i = rings.current.length - 1; i >= 0; i--) {
        const r = rings.current[i];
        r.r += 9;
        r.life += 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(r.color, Math.max(0, 0.6 - r.life / 60));
        ctx.lineWidth = 4;
        ctx.stroke();
        if (r.life > 60) rings.current.splice(i, 1);
      }

      const arr = particles.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life += 1;
        p.vy += 0.16;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const alpha = Math.max(0, 1 - p.life / p.max);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.shape === 'coin') {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'spark') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          const len = p.size * 1.8;
          const ang = Math.atan2(p.vy, p.vx);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
          ctx.stroke();
        } else {
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }
        ctx.restore();
        if (p.life >= p.max || p.y > canvas.height + 40) arr.splice(i, 1);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('soltrend:win', onWin);
      window.removeEventListener('soltrend:jackpot', onJackpot as EventListener);
      cancelAnimationFrame(raf.current!);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[150]" aria-hidden />;
}

function withAlpha(color: string, a: number): string {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  if (color.startsWith('hsl')) return color.replace('hsl', 'hsla').replace(')', ` / ${a})`);
  return color;
}

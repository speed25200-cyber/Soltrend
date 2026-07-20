'use client';

import { useEffect, useRef } from 'react';

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
}

const COLORS = ['#10f5a0', '#a855f7', '#d946ef', '#22d3ee', '#ffd25f', '#ffffff'];

/**
 * Full-screen, pointer-events-none celebration layer. Listens for
 * `soltrend:win` / `soltrend:jackpot` and rains confetti scaled to the win —
 * bigger multipliers get more particles and a golden shockwave.
 */
export function WinFx() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<P[]>([]);
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

    const spawn = (count: number, big: boolean) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.34;
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
          size: 4 + Math.random() * (big ? 7 : 4),
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
        });
      }
      if (big) shock.current = { r: 0, life: 0 };
    };

    const onWin = (e: Event) => {
      const mult = (e as CustomEvent).detail?.mult ?? 2;
      const big = mult >= 10;
      spawn(big ? 160 : mult >= 3 ? 90 : 46, big);
    };
    const onJackpot = () => spawn(220, true);
    window.addEventListener('soltrend:win', onWin);
    window.addEventListener('soltrend:jackpot', onJackpot as EventListener);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (shock.current) {
        const s = shock.current;
        s.r += 14;
        s.life += 1;
        ctx.beginPath();
        ctx.arc(window.innerWidth / 2, window.innerHeight * 0.34, s.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,210,95,${Math.max(0, 0.5 - s.life / 40)})`;
        ctx.lineWidth = 6;
        ctx.stroke();
        if (s.life > 40) shock.current = null;
      }

      const arr = particles.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life += 1;
        p.vy += 0.16; // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const alpha = Math.max(0, 1 - p.life / p.max);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
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

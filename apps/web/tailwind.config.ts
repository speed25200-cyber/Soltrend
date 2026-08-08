import type { Config } from 'tailwindcss';

/**
 * Soltrend design system.
 *
 * Colour psychology for a high-end crypto casino:
 *  - Deep near-black "void" backgrounds reduce eye strain over long sessions
 *    and make neon accents pop (contrast = perceived value / premium feel).
 *  - Violet→magenta is the Solana-adjacent "degen luxury" signature.
 *  - Emerald is reserved *exclusively* for wins/cash-out (positive reinforcement).
 *  - Rose/red is reserved for losses/danger (mines, crash bust).
 *  - Gold is reserved for jackpots, VIP and leaderboards (scarcity/status).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          950: '#05060f',
          900: '#080a18',
          800: '#0d1024',
          700: '#141733',
          600: '#1c2044',
        },
        neon: {
          violet: '#8b5cf6',
          purple: '#a855f7',
          magenta: '#d946ef',
          pink: '#ec4899',
          blue: '#3b82f6',
          cyan: '#22d3ee',
        },
        win: {
          DEFAULT: '#10f5a0',
          soft: '#34d399',
          deep: '#059669',
        },
        loss: {
          DEFAULT: '#ff3b6b',
          soft: '#fb7185',
          deep: '#e11d48',
        },
        gold: {
          DEFAULT: '#ffd25f',
          soft: '#fde68a',
          deep: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-violet': '0 0 24px -4px rgba(139,92,246,0.55), 0 0 60px -12px rgba(217,70,239,0.35)',
        'glow-win': '0 0 24px -4px rgba(16,245,160,0.6), 0 0 64px -12px rgba(16,245,160,0.35)',
        'glow-loss': '0 0 24px -4px rgba(255,59,107,0.55), 0 0 64px -12px rgba(255,59,107,0.3)',
        'glow-gold': '0 0 24px -4px rgba(255,210,95,0.6), 0 0 60px -12px rgba(245,158,11,0.35)',
        'glow-cyan': '0 0 24px -4px rgba(34,211,238,0.55), 0 0 60px -12px rgba(34,211,238,0.3)',
        'inner-top': 'inset 0 1px 0 0 rgba(255,255,255,0.08)',
        card: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 48px -24px rgba(0,0,0,0.85)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, transparent, #05060f), radial-gradient(circle at 50% 0%, rgba(139,92,246,0.12), transparent 60%)',
        'aurora':
          'radial-gradient(60% 60% at 20% 10%, rgba(139,92,246,0.20), transparent 60%), radial-gradient(50% 50% at 90% 20%, rgba(217,70,239,0.16), transparent 55%), radial-gradient(60% 60% at 50% 110%, rgba(34,211,238,0.10), transparent 60%)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.85', filter: 'brightness(1.25)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'float-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'count-pop': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(0, -18px, 0) scale(1.04)' },
        },
        'aurora-pan': {
          '0%, 100%': { transform: 'translate(-6%, -4%) rotate(-2deg)' },
          '50%': { transform: 'translate(6%, 4%) rotate(2deg)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'float-up': 'float-up 0.4s ease-out both',
        'count-pop': 'count-pop 0.4s cubic-bezier(0.2,1.4,0.4,1) both',
        'spin-slow': 'spin-slow 8s linear infinite',
        'float-slow': 'float-slow 7s ease-in-out infinite',
        'aurora-pan': 'aurora-pan 14s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;

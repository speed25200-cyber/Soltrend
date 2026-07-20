'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectButton } from './ConnectButton';
import { Icon } from './Icon';
import { fmtCompact } from '@/lib/format';

export function Hero() {
  const { connected } = useWallet();
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-void-900/40 px-6 py-12 md:px-12 md:py-16">
      {/* aurora backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-aurora opacity-80" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-violet/50 to-transparent" />

      <div className="relative z-10 max-w-3xl">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="chip !border-neon-violet/40 !bg-neon-violet/10 !text-neon-violet"
        >
          <Icon name="bolt" size={12} /> Provably fair on Solana — settle in &lt;1s
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-4 font-display text-4xl font-bold leading-[1.05] text-white md:text-6xl"
        >
          The casino <span className="neon-text">the community builds.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 max-w-xl text-lg text-slate-400"
        >
          Play instant on-chain Originals, or design your own game no-code and earn royalties every
          time someone plays it. Connect Phantom and go.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-7 flex flex-wrap items-center gap-3"
        >
          {connected ? (
            <Link href="/play/dice" className="btn-primary">
              Play Dice now
            </Link>
          ) : (
            <ConnectButton />
          )}
          <Link href="/studio" className="btn-ghost">
            Create a game
          </Link>
        </motion.div>

        <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3">
          <Stat label="Wagered (24h)" value={`◎ ${fmtCompact(1_284_920)}`} />
          <Stat label="Bets settled" value={fmtCompact(9_120_004)} />
          <Stat label="Community games" value="312" />
          <Stat label="House edge" value="1–5%" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

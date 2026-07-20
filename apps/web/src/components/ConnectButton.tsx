'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';
import { shortAddr } from '@/lib/format';

/**
 * Custom connect button. We drive wallet-adapter's modal directly so the trigger
 * matches the Soltrend design language instead of the stock adapter chrome.
 */
export function ConnectButton({ compact = false }: { compact?: boolean }) {
  const { publicKey, connected, disconnect, connecting, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);

  if (!connected) {
    return (
      <button className="btn-primary !py-2.5 !px-4 text-sm" onClick={() => setVisible(true)}>
        <PhantomGlyph />
        {connecting ? 'Connecting…' : compact ? 'Connect' : 'Connect Wallet'}
      </button>
    );
  }

  const addr = publicKey?.toBase58() ?? '';
  return (
    <div className="relative">
      <button
        className="btn-ghost !py-2 !px-3 text-sm font-mono"
        onClick={() => setOpen((o) => !o)}
      >
        {wallet?.adapter.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" className="h-4 w-4 rounded" />
        )}
        {shortAddr(addr)}
        <svg width="12" height="12" viewBox="0 0 24 24" className="opacity-60">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-52 glass p-2 animate-float-up">
            <button
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 text-slate-300"
              onClick={() => {
                navigator.clipboard?.writeText(addr);
                setOpen(false);
              }}
            >
              Copy address
            </button>
            <button
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 text-slate-300"
              onClick={() => {
                setVisible(true);
                setOpen(false);
              }}
            >
              Change wallet
            </button>
            <button
              className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-loss/10 text-loss"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PhantomGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 128 128" aria-hidden>
      <rect width="128" height="128" rx="28" fill="#111327" />
      <path
        d="M110 63.6c0 26-21.4 47.4-49.4 47.4C36 111 18 92 18 63.6 18 39 37 20 61 20c25 0 49 19 49 43.6z"
        fill="url(#pg)"
      />
      <circle cx="52" cy="60" r="7" fill="#fff" />
      <circle cx="78" cy="60" r="7" fill="#fff" />
      <defs>
        <linearGradient id="pg" x1="18" y1="20" x2="110" y2="111" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
    </svg>
  );
}

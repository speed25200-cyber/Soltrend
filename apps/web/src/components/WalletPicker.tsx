'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { Modal } from './Modal';
import { clusterName } from './WalletProviders';

/**
 * Our own wallet picker, replacing wallet-adapter's stock modal.
 *
 * The stock modal fails silently in the exact case players hit most: when an
 * adapter is not detected it quietly opens the vendor's site in a new tab, so a
 * blocked popup — or a wallet that is installed but hasn't injected yet — looks
 * like a button that does nothing at all. This lists each wallet's real
 * readyState, connects explicitly so failures can be caught and shown, and says
 * plainly when a wallet isn't there instead of leaving the player guessing.
 */
export function WalletPicker({ onClose }: { onClose: () => void }) {
  const { wallets, select, connect, connected, connecting, wallet } = useWallet();
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const installed = useMemo(
    () => wallets.filter((w) => w.readyState === WalletReadyState.Installed),
    [wallets],
  );
  const others = useMemo(
    () => wallets.filter((w) => w.readyState !== WalletReadyState.Installed),
    [wallets],
  );

  // Selection is async: once the provider has actually adopted the wallet we
  // asked for, drive the connection ourselves so a rejection surfaces here
  // rather than vanishing inside the adapter.
  useEffect(() => {
    if (!pending || connected || connecting) return;
    if (wallet?.adapter.name !== pending) return;
    let alive = true;
    connect().catch((e: unknown) => {
      if (!alive) return;
      const msg = e instanceof Error ? e.message : String(e);
      setNote(
        /reject|declin|denied/i.test(msg)
          ? 'You declined the request in your wallet.'
          : `${pending} could not connect: ${msg}`,
      );
      setPending(null);
    });
    return () => {
      alive = false;
    };
  }, [pending, wallet, connected, connecting, connect]);

  useEffect(() => {
    if (connected) onClose();
  }, [connected, onClose]);

  const choose = (name: string) => {
    setNote(null);
    setPending(name);
    select(name as Parameters<typeof select>[0]);
  };

  const openInstall = (name: string, url: string) => {
    // Say it out loud as well as opening the tab — a blocked popup is exactly
    // the case where the player sees nothing happen.
    setNote(`${name} isn't detected in this browser. Opening its install page — if nothing opens, allow popups or install it manually, then reload.`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal title="Connect a wallet" onClose={onClose}>
      <p className="text-xs text-slate-500">
        Soltrend is running on <b className="text-slate-300">{clusterName()}</b>. Make sure your
        wallet is set to the same network.
      </p>

      {installed.length === 0 && (
        <div className="mt-3 rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs text-slate-200">
          No Solana wallet detected in this browser. Install one below, then reload this page.
          On a phone, open Soltrend from inside your wallet app&apos;s built-in browser — extensions
          don&apos;t exist on mobile.
        </div>
      )}

      <div className="mt-4 space-y-2">
        {installed.map((w) => (
          <button
            key={w.adapter.name}
            onClick={() => choose(w.adapter.name)}
            disabled={!!pending}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-void-900/60 px-3 py-2.5 text-left transition hover:border-neon-violet/50 hover:bg-void-700/50 disabled:opacity-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.adapter.icon} alt="" className="h-7 w-7 rounded-lg" />
            <span className="flex-1 font-semibold text-white">{w.adapter.name}</span>
            <span className="text-[0.62rem] font-bold uppercase text-win">
              {pending === w.adapter.name ? 'Connecting' : 'Detected'}
            </span>
          </button>
        ))}

        {others.map((w) => (
          <button
            key={w.adapter.name}
            onClick={() => openInstall(w.adapter.name, w.adapter.url)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-void-950/50 px-3 py-2.5 text-left opacity-70 transition hover:opacity-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.adapter.icon} alt="" className="h-7 w-7 rounded-lg grayscale" />
            <span className="flex-1 font-semibold text-slate-300">{w.adapter.name}</span>
            <span className="text-[0.62rem] font-bold uppercase text-slate-500">Not installed</span>
          </button>
        ))}
      </div>

      {note && (
        <p className="mt-3 rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs text-slate-200">{note}</p>
      )}
    </Modal>
  );
}

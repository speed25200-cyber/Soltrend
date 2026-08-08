'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { useCasino } from '@/lib/store';
import { fmtSol, SOL_USD } from '@/lib/format';
import { Modal } from './Modal';
import { useWalletBalance } from '@/hooks/useWalletBalance';

export function BalanceWidget() {
  const { connected } = useWallet();
  const balance = useCasino((s) => s.balance);
  const [open, setOpen] = useState(false);
  if (!connected) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-2 rounded-xl border border-white/[0.08] bg-void-900/70 pl-3 pr-2 py-1.5 transition hover:border-neon-violet/40"
      >
        <SolMark />
        <span className="font-mono text-sm font-semibold text-white tabular-nums">{fmtSol(balance)}</span>
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-neon-violet to-neon-magenta text-void-950 text-lg leading-none font-bold">
          +
        </span>
      </button>
      {open && <CashierModal onClose={() => setOpen(false)} />}
    </>
  );
}

function CashierModal({ onClose }: { onClose: () => void }) {
  const { balance, deposit, withdraw } = useCasino();
  const onChainSol = useWalletBalance();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amt, setAmt] = useState('1');
  const value = Math.max(0, parseFloat(amt) || 0);

  return (
    <Modal title="Cashier" onClose={onClose}>
      <div className="flex gap-1 rounded-xl bg-void-900/80 p-1">
        {(['deposit', 'withdraw'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
              tab === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-void-900/50 p-4">
        <div className="label-eyebrow">Amount (SOL)</div>
        <div className="mt-1 flex items-center gap-2">
          <SolMark />
          <input
            className="w-full bg-transparent font-mono text-2xl font-bold text-white outline-none"
            value={amt}
            onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
          />
          <span className="text-sm text-slate-500">≈ ${(value * SOL_USD).toFixed(0)}</span>
        </div>
        <div className="mt-3 flex gap-2">
          {[0.5, 1, 5, 10].map((v) => (
            <button key={v} className="chip hover:border-neon-violet/50" onClick={() => setAmt(String(v))}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-2.5">
          <div className="label-eyebrow">In wallet (on-chain)</div>
          <div className="font-mono text-sm font-bold text-white">
            {onChainSol === null ? '—' : `◎${fmtSol(onChainSol, 3)}`}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-2.5">
          <div className="label-eyebrow">Play balance</div>
          <div className="font-mono text-sm font-bold text-white">◎{fmtSol(balance, 3)}</div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {onChainSol === null
          ? 'Wallet balance unavailable — check your network. The play balance below is a local demo ledger.'
          : 'Your wallet balance is read live from the chain. Deposits move SOL into the audited '}
        {onChainSol !== null && <span className="text-slate-300">House Vault</span>}
        {onChainSol !== null && ' PDA; staking and royalty claims already settle on-chain.'}
      </p>

      <button
        className={`btn-primary mt-4 w-full ${tab === 'withdraw' ? '!bg-none btn-win' : ''}`}
        disabled={
          value <= 0 ||
          (tab === 'withdraw' && value > balance) ||
          (tab === 'deposit' && onChainSol !== null && value > onChainSol)
        }
        onClick={() => {
          tab === 'deposit' ? deposit(value) : withdraw(value);
          onClose();
        }}
      >
        {tab === 'deposit' ? 'Deposit' : 'Withdraw'} {value > 0 ? fmtSol(value) : ''} SOL
      </button>
    </Modal>
  );
}

export function SolMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden>
      <defs>
        <linearGradient id="sol" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ffa3" />
          <stop offset="1" stopColor="#dc1fff" />
        </linearGradient>
      </defs>
      <path d="M26 88a5 5 0 013.5-1.5H108a2.5 2.5 0 011.8 4.3l-15.3 15.4A5 5 0 0191 108H12.4a2.5 2.5 0 01-1.8-4.3z" fill="url(#sol)" />
      <path d="M26 20a5 5 0 013.5-1.4H108a2.5 2.5 0 011.8 4.3L94.5 38.3A5 5 0 0191 39.7H12.4a2.5 2.5 0 01-1.8-4.3z" fill="url(#sol)" />
      <path d="M94.5 54.3A5 5 0 0091 52.8H12.4a2.5 2.5 0 00-1.8 4.3l15.3 15.4A5 5 0 0029.5 74H108a2.5 2.5 0 001.8-4.3z" fill="url(#sol)" />
    </svg>
  );
}

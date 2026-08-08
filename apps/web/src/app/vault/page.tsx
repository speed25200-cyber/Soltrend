'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCasino } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { SolMark } from '@/components/BalanceWidget';
import { ACCENT_HEX } from '@/lib/catalog';
import { fmtSol, fmtCompact } from '@/lib/format';

// Illustrative APR: edge × bankroll-share (20%) × assumed daily turnover (2×) annualised.
const aprFor = (edge: number) => Math.min(300, Math.round(edge * 0.2 * 2 * 365 * 100));

export default function VaultPage() {
  const ugc = useCasino((s) => s.ugc);
  const stakes = useCasino((s) => s.bankrollStakes);
  const yieldAccrued = useCasino((s) => s.bankrollYield);
  const claim = useCasino((s) => s.claimBankrollYield);
  const balance = useCasino((s) => s.balance);

  const [flash, setFlash] = useState('');
  const games = [...ugc].sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));
  const totalTvl = ugc.reduce((s, g) => s + (g.tvl ?? 0), 0);
  const myStaked = Object.values(stakes).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="Earn · Vaults"
        title="Fund games, earn the edge"
        sub="Stake SOL into a game's bankroll to become the house — you earn a share of every bet's edge, pro-rata."
      />

      {/* Claim + totals */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="glass p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="label-eyebrow">Claimable yield</span>
              <div className="font-display text-3xl font-bold text-win">◎{fmtSol(yieldAccrued, 4)}</div>
              <div className="text-xs text-slate-500">Earned from games you back. Grows as they&apos;re played.</div>
            </div>
            <button
              className="btn-primary btn-win"
              disabled={yieldAccrued <= 0}
              onClick={() => {
                const c = claim();
                if (c > 0) setFlash(`Claimed ◎${fmtSol(c, 4)} yield`);
              }}
            >
              Claim
            </button>
          </div>
          {flash && <p className="mt-2 text-xs text-win">{flash}</p>}
        </div>
        <div className="glass grid grid-cols-2 gap-3 p-5">
          <div>
            <span className="label-eyebrow">Total TVL</span>
            <div className="font-mono text-lg font-bold text-white">◎{fmtCompact(totalTvl)}</div>
          </div>
          <div>
            <span className="label-eyebrow">You staked</span>
            <div className="font-mono text-lg font-bold text-neon-cyan">◎{fmtSol(myStaked, 2)}</div>
          </div>
        </div>
      </div>

      {/* Game vaults */}
      <div className="space-y-3">
        {games.map((g) => (
          <VaultRow key={g.id} game={g} stake={stakes[g.id] ?? 0} apr={aprFor(g.edge)} balance={balance} />
        ))}
      </div>

      <p className="rounded-xl border border-white/[0.06] bg-void-900/50 p-4 text-xs leading-relaxed text-slate-500">
        Backing a game means you provide the liquidity that pays its winners — you earn the edge when
        players lose and share the variance when they win. On mainnet this is a distinct, regulated
        liquidity product; APRs shown are illustrative.
      </p>
    </div>
  );
}

function VaultRow({ game, stake, apr, balance }: { game: any; stake: number; apr: number; balance: number }) {
  const hex = ACCENT_HEX[(game.theme.accent as keyof typeof ACCENT_HEX) ?? 'violet'];
  const stakeB = useCasino((s) => s.stakeBankroll);
  const unstakeB = useCasino((s) => s.unstakeBankroll);
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState('1');
  const value = Math.max(0, parseFloat(amt) || 0);

  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ color: hex, background: `${hex}22` }}>
          <Icon name={game.theme.icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/play/ugc?id=${game.id}`} className="font-display font-bold text-white hover:text-neon-violet">{game.name}</Link>
          <div className="text-xs text-slate-500">by {game.creator} · {(game.edge * 100).toFixed(1)}% edge</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">TVL</div>
          <div className="font-mono text-sm font-bold text-white">◎{fmtCompact(game.tvl ?? 0)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Est. APR</div>
          <div className="font-mono text-sm font-bold text-win">{apr}%</div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-xs text-slate-500">Your stake</div>
          <div className="font-mono text-sm font-bold text-neon-cyan">◎{fmtSol(stake, 2)}</div>
        </div>
        <button className="btn-ghost !py-2" onClick={() => setOpen((o) => !o)}>{open ? 'Close' : 'Manage'}</button>
      </div>

      {open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] bg-void-900/40 p-4">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-void-900/80 px-3">
            <SolMark />
            <input className="w-full bg-transparent py-2.5 font-mono text-white outline-none" value={amt} inputMode="decimal" onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
          <button className="btn-primary !py-2.5" disabled={value <= 0 || value > balance} onClick={() => stakeB(game.id, value)}>Stake</button>
          <button className="btn-ghost !py-2.5" disabled={value <= 0 || value > stake} onClick={() => unstakeB(game.id, value)}>Unstake</button>
        </div>
      )}
    </div>
  );
}

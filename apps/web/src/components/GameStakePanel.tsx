'use client';

import { useState } from 'react';
import { useCasino } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { maxBetFor, stakerApr, RUIN_K, EDGE_SPLIT } from '@/lib/economics';
import { fmtSol } from '@/lib/format';

/**
 * "Stake behind a game" — the community bankroll UI. A game's house is funded by
 * whoever stakes here; they earn 60% of its edge pro-rata and set the max bet
 * (capped at 1/RUIN_K of the bankroll so one lucky player can't drain it).
 */
export function GameStakePanel({ gameId }: { gameId: string }) {
  const game = useCasino((s) => s.ugc.find((g) => g.id === gameId));
  const balance = useCasino((s) => s.balance);
  const myStake = useCasino((s) => s.bankrollStakes[gameId] ?? 0);
  const pendingYield = useCasino((s) => s.bankrollYield);
  const stakeBankroll = useCasino((s) => s.stakeBankroll);
  const unstakeBankroll = useCasino((s) => s.unstakeBankroll);
  const claimYield = useCasino((s) => s.claimBankrollYield);

  const [amt, setAmt] = useState(0.5);
  const [daily, setDaily] = useState(0);

  if (!game) return null;
  const tvl = game.tvl ?? 0;
  const maxWin = game.maxWin ?? 100;
  const edge = game.edge;
  const maxBet = maxBetFor(tvl, maxWin);
  const share = tvl > 0 ? myStake / tvl : 0;
  const modeledDaily = daily || Math.max(1, Math.round(tvl));
  const apr = stakerApr(modeledDaily, tvl || 1, edge);

  return (
    <div className="glass space-y-4 p-5">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">Back this game · earn its edge</span>
        <span className="rounded-md bg-win/15 px-2 py-0.5 text-[0.62rem] font-bold text-win">{(EDGE_SPLIT.bankroll * 100).toFixed(0)}% of edge → stakers</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Bankroll (TVL)" value={`◎${fmtSol(tvl, 2)}`} icon="shield" />
        <Stat label="Max bet now" value={maxBet > 0 ? `◎${fmtSol(maxBet, 3)}` : '—'} icon="bolt" sub={`cap 1/${RUIN_K} of pool`} />
        <Stat label="Your stake" value={`◎${fmtSol(myStake, 3)}`} icon="coin" />
        <Stat label="Your share" value={`${(share * 100).toFixed(1)}%`} icon="trend" />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-void-950/50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Est. APR</span>
          <span className="font-mono font-bold text-win">{apr > 0 ? `${(apr * 100).toFixed(0)}%` : '—'}</span>
        </div>
        <label className="mt-1.5 flex items-center gap-2 text-[0.62rem] text-slate-500">
          if daily volume ◎
          <input type="number" min={0} value={daily || ''} placeholder={String(modeledDaily)} onChange={(e) => setDaily(Math.max(0, parseFloat(e.target.value) || 0))} className="w-20 rounded bg-void-900 px-1.5 py-0.5 text-right font-mono text-white outline-none" />
        </label>
        <p className="mt-1 text-[0.58rem] leading-tight text-slate-600">Yield is variance — a lucky player run costs the pool short-term; the edge makes it profit long-run.</p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="label-eyebrow">Amount</span>
          <span className="font-mono text-xs text-slate-400">bal ◎{fmtSol(balance, 2)}</span>
        </div>
        <input type="range" min={0.05} max={Math.max(1, Math.min(balance, myStake + balance))} step={0.05} value={amt} onChange={(e) => setAmt(parseFloat(e.target.value))} className="mt-2 w-full accent-neon-violet" />
        <div className="mt-1 text-center font-mono text-sm font-bold text-white">◎{fmtSol(amt, 2)}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => stakeBankroll(gameId, amt)} disabled={amt > balance} className="btn-primary !py-2 text-xs disabled:opacity-40">Stake</button>
          <button onClick={() => unstakeBankroll(gameId, amt)} disabled={amt > myStake} className="btn-ghost !py-2 text-xs disabled:opacity-40">Unstake</button>
        </div>
      </div>

      {pendingYield > 0 && (
        <button onClick={() => claimYield()} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-win/40 bg-win/10 py-2 text-xs font-bold text-win">
          <Icon name="spark" size={13} /> Claim ◎{fmtSol(pendingYield, 4)} yield
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, icon, sub }: { label: string; value: string; icon: Parameters<typeof Icon>[0]['name']; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="flex items-center gap-1.5 text-slate-500"><Icon name={icon} size={12} /><span className="label-eyebrow">{label}</span></div>
      <div className="mt-0.5 font-mono text-base font-bold text-white">{value}</div>
      {sub && <div className="text-[0.56rem] text-slate-600">{sub}</div>}
    </div>
  );
}

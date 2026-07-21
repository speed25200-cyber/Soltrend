'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { BetAmount } from '@/components/BetControls';
import { useDuel } from '@/hooks/useDuel';
import { usePlay } from '@/hooks/usePlay';
import { useShipSkin } from '@/hooks/useShipSkin';
import { shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';

export default function DuelPage() {
  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="PvP · Duel"
        title="1v1 Duel"
        sub="Queue with an ante, get matched, and let a provably-fair coin decide it. Winner takes the pot minus a small rake — server-authoritative, commit-reveal verifiable."
      />
      <DuelRoom />
    </div>
  );
}

function DuelRoom() {
  const { state, queue, leaveQueue, reset, enabled } = useDuel();
  const { publicKey } = useWallet();
  const { guard, settle } = usePlay();
  const [ship] = useShipSkin();
  const [ante, setAnte] = useState(0.1);
  const settledRef = useRef<string | null>(null);
  const wallet = publicKey ? shortAddr(publicKey.toBase58()) : 'you';

  // Settle the wager to the local ledger exactly once per resolved match.
  useEffect(() => {
    if (state.phase !== 'result' || !state.matchId || settledRef.current === state.matchId) return;
    settledRef.current = state.matchId;
    const won = state.youWon === true;
    settle(
      {
        game: 'Duel',
        template: 'coinflip',
        bet: ante,
        multiplier: won ? state.payout / ante : 0,
        payout: won ? state.payout : 0,
        win: won,
        meta: { matchId: state.matchId, draw: state.draw ?? undefined },
        seeds: {
          serverSeed: state.serverSeed ?? '',
          serverSeedHash: state.hash ?? '',
          clientSeed: state.matchSeed ?? '',
          nonce: state.nonce ?? 0,
        },
      },
      { quiet: true },
    );
    if (won) {
      sfx.win(state.payout / ante);
      burstWin(state.payout / ante);
    } else {
      sfx.loss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.matchId]);

  if (!enabled) return <OfflinePanel />;

  const onQueue = () => {
    const g = guard(ante);
    if (!g.ok) return;
    queue(ante, wallet, ship.id);
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="glass flex items-center justify-between p-4 text-sm">
        <span className={`flex items-center gap-2 ${state.connected ? 'text-win' : 'text-slate-500'}`}>
          <span className={`h-2 w-2 rounded-full ${state.connected ? 'bg-win' : 'bg-slate-600'}`} />
          {state.connected ? 'Connected' : 'Connecting…'}
        </span>
        <span className="text-slate-400">{state.waiting} in queue</span>
      </div>

      {(state.phase === 'idle' || state.phase === 'offline') && (
        <div className="glass space-y-4 p-6">
          <BetAmount value={ante} onChange={setAnte} />
          <button className="btn-primary w-full" onClick={onQueue} disabled={!state.connected}>Find a duel · ◎{ante}</button>
          <p className="text-center text-xs text-slate-500">You&apos;re matched with the next player in queue. Bigger antes are settled fairly by stake-weighted odds.</p>
        </div>
      )}

      {state.phase === 'queued' && (
        <div className="glass grid place-items-center gap-3 p-10 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-neon-violet/30 border-t-neon-violet" />
          <p className="font-display font-bold text-white">Searching for an opponent…</p>
          <button className="btn-ghost" onClick={leaveQueue}>Cancel</button>
        </div>
      )}

      {state.phase === 'matched' && state.you && state.opponent && (
        <div className="glass grid place-items-center gap-4 p-8 text-center">
          <div className="flex w-full items-center justify-around">
            <Fighter name={state.you.wallet} ante={state.you.ante} tint="#10f5a0" />
            <span className="font-display text-2xl font-bold text-slate-500">VS</span>
            <Fighter name={state.opponent.wallet} ante={state.opponent.ante} tint="#ff3b6b" />
          </div>
          <p className="text-sm text-slate-400">Pot ◎{state.pot} · settling…</p>
          <code className="max-w-full truncate rounded bg-void-950/60 px-2 py-1 text-[10px] text-slate-500">commit {state.hash?.slice(0, 24)}…</code>
        </div>
      )}

      {state.phase === 'result' && (
        <div className="glass grid place-items-center gap-3 p-8 text-center">
          <span className={`grid h-14 w-14 place-items-center rounded-2xl ${state.youWon ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>
            <Icon name={state.youWon ? 'crown' : 'close'} size={28} />
          </span>
          <h3 className="font-display text-xl font-bold text-white">{state.youWon ? `You won ◎${state.payout}` : 'You lost this duel'}</h3>
          {state.serverSeed && (
            <code className="max-w-full truncate rounded bg-void-950/60 px-2 py-1 text-[10px] text-slate-500">
              seed {state.serverSeed.slice(0, 20)}… · draw {state.draw?.toFixed(4)}
            </code>
          )}
          <button className="btn-primary mt-1" onClick={reset}>Duel again</button>
        </div>
      )}
    </div>
  );
}

function Fighter({ name, ante, tint }: { name: string; ante: number; tint: string }) {
  return (
    <div className="grid place-items-center gap-1">
      <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: `${tint}22`, color: tint }}>
        <Icon name="target" size={26} />
      </span>
      <span className="text-sm font-semibold text-white">{name}</span>
      <span className="font-mono text-xs text-slate-500">◎{ante}</span>
    </div>
  );
}

function OfflinePanel() {
  return (
    <div className="glass mx-auto max-w-2xl space-y-4 p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-neon-violet/15 text-neon-violet"><Icon name="target" size={26} /></span>
      <h3 className="font-display text-lg font-bold text-white">Duels need a hosted server</h3>
      <p className="mx-auto max-w-lg text-sm text-slate-400">
        PvP matchmaking is server-authoritative — pairing and the commit-reveal settle run on a hosted Node process a static host can&apos;t provide. The gateway is built and ready in{' '}
        <code className="rounded bg-void-900 px-1.5 py-0.5 text-xs text-slate-300">apps/api</code>.
      </p>
      <div className="rounded-xl border border-white/10 bg-void-950/60 p-4 text-left text-xs text-slate-400">
        <div className="label-eyebrow mb-2">To go live</div>
        <ol className="list-inside list-decimal space-y-1.5">
          <li>Deploy <code className="text-slate-300">apps/api</code> (Dockerfile, render.yaml &amp; fly.toml included).</li>
          <li>Set <code className="text-slate-300">NEXT_PUBLIC_REALTIME_URL=https://your-api-host</code> and rebuild.</li>
          <li>This page connects automatically and matchmaking goes live.</li>
        </ol>
      </div>
    </div>
  );
}

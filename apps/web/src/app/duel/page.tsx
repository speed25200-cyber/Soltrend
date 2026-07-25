'use client';

import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { BetAmount } from '@/components/BetControls';
import { useDuel } from '@/hooks/useDuel';
import { useJackpot } from '@/hooks/useJackpot';
import { useShowdown } from '@/hooks/useShowdown';
import { useHeist } from '@/hooks/useHeist';
import { usePlay } from '@/hooks/usePlay';
import { useShipSkin } from '@/hooks/useShipSkin';
import { shortAddr, fmtMult } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import type { IconName } from '@/components/Icon';

type Mode = 'duel' | 'jackpot' | 'showdown' | 'heist';
const SUBS: Record<Mode, { title: string; sub: string }> = {
  duel: { title: '1v1 Duel', sub: 'Queue with an ante, get matched, and let a provably-fair coin decide it. Winner takes the pot minus a small rake — server-authoritative, commit-reveal verifiable.' },
  jackpot: { title: 'Shared Jackpot', sub: 'Everyone enters one growing community pot; a provably-fair weighted draw picks the winner. Your win chance equals your share of the pot.' },
  showdown: { title: 'Game Show', sub: 'Buy in for the table stake and survive the elimination — contestants drop one at a time until one provably-fair winner takes the pot.' },
  heist: { title: 'Co-op Heist', sub: 'Ride one shared multiplier with the crew and grab your loot before the bust. A crew vault pays a bonus only if everyone makes it out — pull for each other.' },
};

export default function DuelPage() {
  const [mode, setMode] = useState<Mode>('duel');
  return (
    <div className="space-y-6">
      <SectionHead eyebrow="Live · Duels" title={SUBS[mode].title} sub={SUBS[mode].sub} />
      <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 rounded-xl bg-void-900/80 p-1">
        <TabBtn active={mode === 'duel'} onClick={() => setMode('duel')} icon="target" label="Duel" />
        <TabBtn active={mode === 'jackpot'} onClick={() => setMode('jackpot')} icon="crown" label="Jackpot" />
        <TabBtn active={mode === 'showdown'} onClick={() => setMode('showdown')} icon="sparkle" label="Show" />
        <TabBtn active={mode === 'heist'} onClick={() => setMode('heist')} icon="bolt" label="Heist" />
      </div>
      {mode === 'duel' ? <DuelRoom /> : mode === 'jackpot' ? <JackpotRoom /> : mode === 'showdown' ? <ShowdownRoom /> : <HeistRoom />}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${active ? 'bg-neon-violet/20 text-white' : 'text-slate-400 hover:text-white'}`}>
      <Icon name={icon} size={15} /> {label}
    </button>
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

function JackpotRoom() {
  const { state, enter, enabled } = useJackpot();
  const { publicKey } = useWallet();
  const { guard, settle } = usePlay();
  const [ship] = useShipSkin();
  const [amount, setAmount] = useState(0.1);
  const settledRef = useRef<number | null>(null);
  const wallet = publicKey ? shortAddr(publicKey.toBase58()) : 'you';
  const mine = state.entries.find((e) => e.wallet === wallet);

  // Settle once per resolved round, only if I had entered.
  useEffect(() => {
    if (state.phase !== 'result' || settledRef.current === state.roundId) return;
    settledRef.current = state.roundId;
    if (!mine) return;
    const won = state.winnerWallet === wallet;
    settle(
      {
        game: 'Shared Jackpot',
        template: 'wheel',
        bet: mine.amount,
        multiplier: won ? state.payout / mine.amount : 0,
        payout: won ? state.payout : 0,
        win: won,
        meta: { roundId: state.roundId, pot: state.pot },
        seeds: { serverSeed: state.serverSeed ?? '', serverSeedHash: state.hash ?? '', clientSeed: '', nonce: state.roundId },
      },
      { quiet: true },
    );
    if (won) { sfx.jackpot(); burstWin(state.payout / mine.amount); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.roundId]);

  if (!enabled) return <OfflinePanel kind="jackpot" />;

  const onEnter = () => {
    const g = guard(amount);
    if (!g.ok) return;
    enter(amount, wallet, ship.id);
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="glass grid place-items-center gap-1 p-6 text-center">
        <span className="label-eyebrow">Community pot</span>
        <span className="font-display text-4xl font-bold text-gold">◎{state.pot.toFixed(2)}</span>
        <span className="text-xs text-slate-500">
          {state.phase === 'open' ? `Draw in ${Math.ceil(state.endsInMs / 1000)}s` : 'Drawing…'} · {state.entries.length} players
        </span>
      </div>

      {state.phase === 'result' && state.winnerWallet && (
        <div className={`glass grid place-items-center gap-2 p-6 text-center ${state.winnerWallet === wallet ? 'ring-1 ring-win/50' : ''}`}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold"><Icon name="crown" size={24} /></span>
          <h3 className="font-display text-lg font-bold text-white">
            {state.winnerWallet === wallet ? `You won ◎${state.payout}` : `${state.winnerWallet} won ◎${state.payout}`}
          </h3>
          {state.serverSeed && <code className="max-w-full truncate rounded bg-void-950/60 px-2 py-1 text-[10px] text-slate-500">seed {state.serverSeed.slice(0, 20)}… · draw {state.draw?.toFixed(4)}</code>}
        </div>
      )}

      {state.phase === 'open' && (
        <div className="glass space-y-3 p-6">
          <BetAmount value={amount} onChange={setAmount} />
          <button className="btn-primary w-full" onClick={onEnter} disabled={!state.connected}>
            {mine ? `Add ◎${amount} · you're in for ◎${mine.amount}` : `Enter · ◎${amount}`}
          </button>
          {mine && <p className="text-center text-xs text-slate-500">Your win chance: {mine.chance}%</p>}
        </div>
      )}

      {state.entries.length > 0 && (
        <div className="glass space-y-2 p-4">
          <span className="label-eyebrow">In the pot</span>
          {state.entries.slice(0, 8).map((e) => (
            <div key={e.wallet} className="flex items-center justify-between text-sm">
              <span className={e.wallet === wallet ? 'font-semibold text-win' : 'text-slate-300'}>{e.wallet}</span>
              <span className="font-mono text-slate-400">◎{e.amount} · {e.chance}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShowdownRoom() {
  const { state, join, enabled } = useShowdown();
  const { publicKey } = useWallet();
  const { guard, settle } = usePlay();
  const [ship] = useShipSkin();
  const settledRef = useRef<number | null>(null);
  const wallet = publicKey ? shortAddr(publicKey.toBase58()) : 'you';
  const mine = state.players.find((p) => p.wallet === wallet);

  useEffect(() => {
    if (state.phase !== 'result' || settledRef.current === state.showId) return;
    settledRef.current = state.showId;
    if (!mine) return;
    const won = state.winnerWallet === wallet;
    settle(
      {
        game: 'Game Show',
        template: 'wheel',
        bet: state.buyIn,
        multiplier: won ? state.payout / state.buyIn : 0,
        payout: won ? state.payout : 0,
        win: won,
        meta: { showId: state.showId, pot: state.pot },
        seeds: { serverSeed: state.serverSeed ?? '', serverSeedHash: state.hash ?? '', clientSeed: '', nonce: state.showId },
      },
      { quiet: true },
    );
    if (won) { sfx.jackpot(); burstWin(state.payout / state.buyIn); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.showId]);

  if (!enabled) return <OfflinePanel kind="showdown" />;

  const onJoin = () => {
    const g = guard(state.buyIn);
    if (!g.ok) return;
    join(wallet, ship.id);
  };
  const aliveCount = state.players.filter((p) => p.alive).length;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="glass grid place-items-center gap-1 p-6 text-center">
        <span className="label-eyebrow">{state.phase === 'showing' ? 'Elimination live' : 'Table pot'}</span>
        <span className="font-display text-4xl font-bold text-gold">◎{state.pot.toFixed(2)}</span>
        <span className="text-xs text-slate-500">
          {state.phase === 'open' ? `Starts in ${Math.ceil(state.endsInMs / 1000)}s` : state.phase === 'showing' ? `${aliveCount} still standing` : 'Show over'} · buy-in ◎{state.buyIn}
        </span>
        {state.phase === 'showing' && state.lastEliminated && (
          <span className="text-sm text-loss">Eliminated: {state.lastEliminated}</span>
        )}
      </div>

      {state.phase === 'result' && state.winnerWallet && (
        <div className={`glass grid place-items-center gap-2 p-6 text-center ${state.winnerWallet === wallet ? 'ring-1 ring-win/50' : ''}`}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold"><Icon name="crown" size={24} /></span>
          <h3 className="font-display text-lg font-bold text-white">
            {state.winnerWallet === wallet ? `You survived — ◎${state.payout}` : `${state.winnerWallet} took the pot · ◎${state.payout}`}
          </h3>
          {state.serverSeed && <code className="max-w-full truncate rounded bg-void-950/60 px-2 py-1 text-[10px] text-slate-500">seed {state.serverSeed.slice(0, 24)}…</code>}
        </div>
      )}

      {state.phase === 'open' && (
        <div className="glass space-y-3 p-6 text-center">
          <p className="text-sm text-slate-400">Buy in for ◎{state.buyIn} and take your seat. One winner takes the whole pot.</p>
          <button className="btn-primary w-full" onClick={onJoin} disabled={!state.connected || !!mine}>
            {mine ? "You're seated — waiting for the show" : `Take a seat · ◎${state.buyIn}`}
          </button>
        </div>
      )}

      {state.players.length > 0 && (
        <div className="glass grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {state.players.map((p) => (
            <div key={p.wallet} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${p.alive ? '' : 'opacity-40 line-through'}`}>
              <span className={`h-2 w-2 rounded-full ${p.alive ? 'bg-win' : 'bg-loss'}`} />
              <span className={p.wallet === wallet ? 'font-semibold text-win' : 'text-slate-300'}>{p.wallet}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeistRoom() {
  const { state, join, grab, enabled } = useHeist();
  const { publicKey } = useWallet();
  const { guard, settle } = usePlay();
  const [ship] = useShipSkin();
  const [ante, setAnte] = useState(0.1);
  const settledRef = useRef<number | null>(null);
  const wallet = publicKey ? shortAddr(publicKey.toBase58()) : 'you';
  const me = state.crew.find((m) => m.wallet === wallet);

  useEffect(() => {
    if (state.phase !== 'result' || settledRef.current === state.runId || !me) return;
    settledRef.current = state.runId;
    const won = (me.won ?? 0) > 0;
    settle(
      {
        game: 'Co-op Heist',
        template: 'limbo',
        bet: me.ante,
        multiplier: me.ante > 0 ? (me.won ?? 0) / me.ante : 0,
        payout: me.won ?? 0,
        win: won,
        meta: { runId: state.runId, lockedM: me.lockedM ?? 0, allGrabbed: state.allGrabbed },
        seeds: { serverSeed: state.serverSeed ?? '', serverSeedHash: state.hash ?? '', clientSeed: '', nonce: state.runId },
      },
      { quiet: true },
    );
    if (won) { sfx.win((me.won ?? 0) / me.ante); burstWin((me.won ?? 0) / me.ante); } else { sfx.loss(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.runId]);

  if (!enabled) return <OfflinePanel kind="heist" />;

  const onJoin = () => {
    const g = guard(ante);
    if (!g.ok) return;
    join(ante, wallet, ship.id);
  };
  const grabbed = me?.lockedM != null;
  const busted = state.phase === 'result' && me && (me.won ?? 0) === 0;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="glass grid place-items-center gap-1 p-6 text-center">
        <span className="label-eyebrow">{state.phase === 'running' ? 'Loot multiplier' : state.phase === 'result' ? 'Busted at' : 'Crew gathering'}</span>
        <span className={`font-display text-5xl font-bold ${state.phase === 'result' ? 'text-loss' : 'text-win'}`}>
          {fmtMult(state.phase === 'result' ? state.bust ?? 0 : state.multiplier)}
        </span>
        <span className="text-xs text-slate-500">
          {state.phase === 'gather' ? `Sets off in ${Math.ceil(state.gatherInMs / 1000)}s · ` : ''}
          {state.crew.length} in the crew · {Math.round(state.vaultCut * 100)}% feeds the vault
        </span>
      </div>

      {state.phase === 'result' && (
        <div className={`glass grid place-items-center gap-2 p-6 text-center ${(me?.won ?? 0) > 0 ? 'ring-1 ring-win/50' : ''}`}>
          <h3 className="font-display text-lg font-bold text-white">
            {busted ? 'You didn’t grab in time' : (me?.won ?? 0) > 0 ? `You banked ◎${me?.won}` : 'Heist over'}
          </h3>
          {state.allGrabbed && <p className="text-sm text-win">Whole crew made it — vault bonus of ◎{state.vault} split!</p>}
          {state.serverSeed && <code className="max-w-full truncate rounded bg-void-950/60 px-2 py-1 text-[10px] text-slate-500">seed {state.serverSeed.slice(0, 24)}…</code>}
        </div>
      )}

      {state.phase === 'gather' && (
        <div className="glass space-y-3 p-6">
          <BetAmount value={ante} onChange={setAnte} />
          <button className="btn-primary w-full" onClick={onJoin} disabled={!state.connected || !!me}>
            {me ? `You're in for ◎${me.ante}` : `Join the crew · ◎${ante}`}
          </button>
        </div>
      )}

      {state.phase === 'running' && me && (
        <button className="btn-primary btn-win w-full !py-4 text-lg" onClick={grab} disabled={grabbed}>
          {grabbed ? `Loot locked at ${fmtMult(me.lockedM ?? 1)}` : `Grab loot · ${fmtMult(state.multiplier)}`}
        </button>
      )}

      {state.crew.length > 0 && (
        <div className="glass grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
          {state.crew.map((m) => (
            <div key={m.wallet} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
              <span className={m.wallet === wallet ? 'font-semibold text-win' : 'text-slate-300'}>{m.wallet}</span>
              <span className="font-mono text-xs text-slate-400">{m.lockedM != null ? fmtMult(m.lockedM) : state.phase === 'result' ? '✕' : '…'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OfflinePanel({ kind = 'duel' }: { kind?: 'duel' | 'jackpot' | 'showdown' | 'heist' }) {
  return (
    <div className="glass mx-auto max-w-2xl space-y-4 p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-neon-violet/15 text-neon-violet"><Icon name={kind === 'jackpot' ? 'crown' : kind === 'showdown' ? 'sparkle' : kind === 'heist' ? 'bolt' : 'target'} size={26} /></span>
      <h3 className="font-display text-lg font-bold text-white">{kind === 'jackpot' ? 'Shared jackpot' : kind === 'showdown' ? 'The game show' : kind === 'heist' ? 'The co-op heist' : 'Duels'} need a hosted server</h3>
      <p className="mx-auto max-w-lg text-sm text-slate-400">
        {kind === 'jackpot' ? 'The shared pot and its provably-fair draw' : kind === 'showdown' ? 'The live elimination and its provably-fair order' : kind === 'heist' ? 'The shared multiplier and the crew vault' : 'PvP matchmaking and the commit-reveal settle'} run on a hosted Node process a static host can&apos;t provide. The gateway is built and ready in{' '}
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

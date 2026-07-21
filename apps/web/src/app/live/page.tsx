'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from '@/components/games/BetButton';
import { useCrashRoom, REALTIME_URL } from '@/hooks/useCrashRoom';
import { usePlay } from '@/hooks/usePlay';
import { useShipSkin } from '@/hooks/useShipSkin';
import { ShipPicker } from '@/components/worlds/ShipPicker';
import { firstFloat } from '@/lib/provably-fair';
import { round2 } from '@/lib/games';
import { shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import type { CrashShip } from '@/components/worlds/CrashScene3D';

const CrashScene3D = dynamic(() => import('@/components/worlds/CrashScene3D'), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[340px] place-items-center text-sm text-slate-500">Loading 3D…</div>,
});

const EDGE = 0.02;
const liveMultiplier = (elapsedMs: number) => Math.max(1, Math.floor(Math.pow(Math.E, 0.00007 * elapsedMs) * 100) / 100);

export default function LivePage() {
  const [mode, setMode] = useState<'solo' | 'live'>('solo');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead eyebrow="Live · Crash" title="Crash — 3D" sub="Fly the rocket, cash out before it blows. Solo runs in your browser; Live rooms are one shared round for everyone, server-authoritative and provably fair." />
        <Link href="/duel" className="btn-ghost mb-1"><Icon name="target" size={14} /> 1v1 Duel</Link>
      </div>
      <div className="flex w-full max-w-xs gap-1 rounded-xl bg-void-900/80 p-1">
        <TabBtn active={mode === 'solo'} onClick={() => setMode('solo')} icon="bolt" label="Solo · 3D" />
        <TabBtn active={mode === 'live'} onClick={() => setMode('live')} icon="orbit" label="Live rooms" />
      </div>
      {mode === 'solo' ? <SoloCrash /> : <LiveRoom />}
    </div>
  );
}

/* --------------------------------------------------------------- solo (offline) */

function SoloCrash() {
  const { guard, reserveSeeds, settle } = usePlay();
  const [ship, setShip] = useShipSkin();
  const [bet, setBet] = useState(0.1);
  const [mult, setMult] = useState(1);
  const [status, setStatus] = useState<'idle' | 'flying' | 'busted' | 'cashed'>('idle');
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const crash = useRef(0);
  const started = useRef(0);
  const raf = useRef(0);
  const seeds = useRef<ReturnType<typeof reserveSeeds> | null>(null);
  const cashed = useRef(false);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const settleRound = (won: boolean, m: number) => {
    if (!seeds.current) return;
    settle({ game: 'Crash 3D', template: 'limbo', bet, multiplier: won ? m : 0, payout: won ? round2(bet * m) : 0, win: won, meta: { crash: crash.current }, seeds: seeds.current }, { quiet: true });
  };

  const loop = () => {
    const m = liveMultiplier(performance.now() - started.current);
    if (m >= crash.current) {
      setMult(crash.current);
      cancelAnimationFrame(raf.current);
      setStatus('busted');
      if (!cashed.current) { sfx.loss(); settleRound(false, 0); }
      setTimeout(() => setStatus('idle'), 2600);
      return;
    }
    setMult(m);
    if (m >= 2 && Math.floor(m * 10) % 5 === 0) sfx.tick(m);
    raf.current = requestAnimationFrame(loop);
  };

  const start = () => {
    const s = reserveSeeds();
    const u = firstFloat(s.serverSeed, s.clientSeed, s.nonce);
    crash.current = Math.max(1, Math.min(1000, Math.floor(((1 - EDGE) / (1 - u)) * 100) / 100));
    seeds.current = s; cashed.current = false; started.current = performance.now();
    setCashedAt(null); setMult(1); setStatus('flying');
    raf.current = requestAnimationFrame(loop);
  };

  const cashOut = () => {
    if (status !== 'flying' || cashed.current) return;
    cashed.current = true;
    cancelAnimationFrame(raf.current);
    const m = mult;
    setCashedAt(m); setStatus('cashed');
    sfx.cashout(); burstWin(m);
    settleRound(true, m);
    setTimeout(() => setStatus('idle'), 2600);
  };

  const g = guard(bet);
  const flying = status === 'flying';
  const busted = status === 'busted';
  const color = busted ? '#ff3b6b' : status === 'cashed' ? '#10f5a0' : '#a855f7';

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="glass relative min-h-[380px] overflow-hidden p-2">
        <div className="relative h-[380px] overflow-hidden rounded-2xl sm:h-[460px]">
          <CrashScene3D multiplier={mult} status={flying ? 'flying' : busted ? 'busted' : 'idle'} accent={color} skin={ship} />
          <div className="pointer-events-none absolute inset-x-0 top-0 grid place-items-center p-5">
            <div className="rounded-2xl border border-white/10 bg-void-950/60 px-6 py-2 backdrop-blur">
              <span className="font-mono text-5xl font-black md:text-6xl" style={{ color, textShadow: `0 0 34px ${color}` }}>
                {busted ? `${crash.current.toFixed(2)}×` : `${mult.toFixed(2)}×`}
              </span>
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">
              {flying ? 'cash out!' : busted ? 'busted' : status === 'cashed' ? `secured ${cashedAt?.toFixed(2)}×` : 'ready'}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="glass space-y-4 p-5">
          <BetAmount value={bet} onChange={setBet} disabled={flying} />
          {flying ? (
            <button className="btn-primary btn-win w-full" onClick={cashOut}>Cash out ◎{(bet * mult).toFixed(4)}</button>
          ) : (
            <BetButton guard={g} onClick={start} busy={busted || status === 'cashed'}>Launch ◎{bet}</BetButton>
          )}
          <p className="text-center text-[0.68rem] text-slate-600">Provably fair · runs entirely in your browser</p>
        </div>
        <div className="glass p-5">
          <span className="label-eyebrow">Your ship</span>
          <div className="mt-2"><ShipPicker value={ship} onChange={setShip} /></div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- live room */

function LiveRoom() {
  const { publicKey } = useWallet();
  const { state, placeBet, cashOut, enabled } = useCrashRoom();
  const [ship] = useShipSkin();
  const [bet, setBet] = useState(0.1);
  const wallet = publicKey ? shortAddr(publicKey.toBase58()) : 'guest';
  const me = useMemo(() => state.players.find((p) => p.wallet === wallet), [state.players, wallet]);

  if (!enabled) return <OfflinePanel />;

  const climbing = state.phase === 'running';
  const busted = state.phase === 'result';
  const color = busted ? '#ff3b6b' : climbing ? '#10f5a0' : '#a855f7';
  const ships: CrashShip[] = state.players.map((p) => ({ wallet: p.wallet, cashedAt: p.cashedAt, ship: p.ship }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="glass relative min-h-[380px] overflow-hidden p-2">
          <div className="relative h-[380px] overflow-hidden rounded-2xl sm:h-[460px]">
            <CrashScene3D multiplier={state.multiplier} status={climbing ? 'flying' : busted ? 'busted' : 'idle'} accent={color} ships={ships} skin={ship} />
            <div className="pointer-events-none absolute inset-x-0 top-0 grid place-items-center p-5">
              <div className="rounded-2xl border border-white/10 bg-void-950/60 px-6 py-2 backdrop-blur">
                <span className="font-mono text-5xl font-black md:text-6xl" style={{ color, textShadow: `0 0 34px ${color}` }}>
                  {busted ? `${state.crashPoint?.toFixed(2)}×` : `${state.multiplier.toFixed(2)}×`}
                </span>
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                {state.phase === 'betting' ? 'place your bets' : climbing ? 'in flight' : busted ? 'busted' : 'waiting'}
              </div>
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-void-950/70 px-2 py-1 text-[0.62rem] backdrop-blur">
              <span className={`h-1.5 w-1.5 rounded-full ${state.connected ? 'bg-win' : 'bg-slate-600'}`} /> {state.connected ? 'live' : 'connecting'}
            </div>
          </div>
        </div>
        <div className="glass flex flex-wrap gap-1.5 p-3">
          <span className="label-eyebrow mr-1 self-center">Recent</span>
          {state.history.slice(-18).reverse().map((h) => (
            <span key={h.id} className="rounded-md px-2 py-1 font-mono text-xs font-bold" style={{ background: h.crashPoint >= 2 ? '#10f5a022' : '#ff3b6b22', color: h.crashPoint >= 2 ? '#10f5a0' : '#ff3b6b' }}>{h.crashPoint.toFixed(2)}×</span>
          ))}
          {state.history.length === 0 && <span className="text-xs text-slate-600">No rounds yet</span>}
        </div>
      </div>
      <div className="space-y-4">
        <div className="glass space-y-3 p-5">
          <BetAmount value={bet} onChange={setBet} disabled={state.phase !== 'betting'} />
          {climbing && me && me.cashedAt === null ? (
            <button className="btn-primary btn-win w-full" onClick={cashOut}>Cash out ◎{(me.bet * state.multiplier).toFixed(3)}</button>
          ) : me && me.cashedAt ? (
            <div className="rounded-xl border border-win/40 bg-win/10 p-3 text-center text-sm font-semibold text-win">Cashed {me.cashedAt.toFixed(2)}× · ◎{me.won.toFixed(3)}</div>
          ) : (
            <button className="btn-primary w-full disabled:opacity-40" disabled={state.phase !== 'betting' || !!me} onClick={() => placeBet(bet, wallet, ship.id)}>
              {me ? 'Bet placed' : state.phase === 'betting' ? `Join round #${state.roundId}` : 'Wait for next round'}
            </button>
          )}
          {state.hash && <div className="truncate text-center font-mono text-[0.6rem] text-slate-600">commit: {state.hash.slice(0, 22)}…</div>}
        </div>
        <div className="glass p-4">
          <div className="mb-2 flex items-center justify-between"><span className="label-eyebrow">Players</span><span className="text-xs text-slate-500">{state.players.length}</span></div>
          <div className="max-h-[240px] space-y-1 overflow-auto">
            {state.players.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-void-900/50 px-2.5 py-1.5 text-xs">
                <span className="font-mono text-slate-300">{p.wallet}</span>
                <span className={p.cashedAt ? 'font-bold text-win' : busted ? 'text-loss' : 'text-slate-500'}>{p.cashedAt ? `${p.cashedAt.toFixed(2)}×` : busted ? 'bust' : `◎${p.bet.toFixed(2)}`}</span>
              </div>
            ))}
            {state.players.length === 0 && <p className="py-6 text-center text-xs text-slate-600">Be the first to join.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: Parameters<typeof Icon>[0]['name']; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
      <Icon name={icon} size={14} /> {label}
    </button>
  );
}

function OfflinePanel() {
  return (
    <div className="glass mx-auto max-w-2xl space-y-4 p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-neon-violet/15 text-neon-violet"><Icon name="bolt" size={26} /></span>
      <h3 className="font-display text-lg font-bold text-white">Live rooms need a hosted server</h3>
      <p className="mx-auto max-w-lg text-sm text-slate-400">Multiplayer is server-authoritative — a shared round runs on a hosted Node process, which a static host can&apos;t provide. The gateway is built and ready in <code className="rounded bg-void-900 px-1.5 py-0.5 text-xs text-slate-300">apps/api</code>. Solo · 3D plays right now with no server.</p>
      <div className="rounded-xl border border-white/10 bg-void-950/60 p-4 text-left text-xs text-slate-400">
        <div className="label-eyebrow mb-2">To go live</div>
        <ol className="list-inside list-decimal space-y-1.5">
          <li>Deploy <code className="text-slate-300">apps/api</code> (a Dockerfile, render.yaml &amp; fly.toml are included).</li>
          <li>Set <code className="text-slate-300">NEXT_PUBLIC_REALTIME_URL=https://your-api-host</code> and rebuild.</li>
          <li>This tab connects automatically and the shared round goes live.</li>
        </ol>
      </div>
    </div>
  );
}

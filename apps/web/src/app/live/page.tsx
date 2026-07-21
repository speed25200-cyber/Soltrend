'use client';

import { useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { useCrashRoom, REALTIME_URL } from '@/hooks/useCrashRoom';
import { shortAddr } from '@/lib/format';

export default function LivePage() {
  const { publicKey } = useWallet();
  const { state, placeBet, cashOut, enabled } = useCrashRoom();
  const [bet, setBet] = useState(0.1);
  const wallet = publicKey ? shortAddr(publicKey.toBase58()) : 'guest';

  const me = useMemo(() => state.players.find((p) => p.wallet === wallet), [state.players, wallet]);
  const climbing = state.phase === 'running';
  const busted = state.phase === 'result';
  const color = busted ? '#ff3b6b' : climbing ? '#10f5a0' : '#a855f7';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead eyebrow="Live · Multiplayer" title="Crash rooms" sub="One shared round, hundreds of players, one climbing multiplier. Cash out before the bust. Server-authoritative, provably fair by commit-reveal." />
        <div className="mb-4 flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${state.connected ? 'bg-win' : 'bg-slate-600'}`} />
          <span className="text-slate-400">{enabled ? (state.connected ? 'Connected to live server' : 'Connecting…') : 'Live server offline'}</span>
        </div>
      </div>

      {!enabled ? (
        <OfflinePanel />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Stage */}
          <div className="min-w-0 space-y-4">
            <div className="glass relative grid min-h-[320px] place-items-center overflow-hidden p-8">
              <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 55%, ${color}22, transparent 60%)` }} />
              <div className="relative text-center">
                <div className="font-mono text-6xl font-black tracking-tight md:text-7xl" style={{ color, textShadow: `0 0 40px ${color}` }}>
                  {busted ? `${state.crashPoint?.toFixed(2)}×` : `${state.multiplier.toFixed(2)}×`}
                </div>
                <div className="mt-2 text-sm uppercase tracking-[0.3em] text-slate-400">
                  {state.phase === 'betting' ? 'Place your bets' : climbing ? 'In flight — cash out!' : busted ? 'Busted' : 'Waiting…'}
                </div>
                {busted && state.serverSeed && (
                  <div className="mx-auto mt-3 max-w-md truncate rounded-lg border border-white/10 bg-void-950/70 px-3 py-1.5 font-mono text-[0.6rem] text-slate-500">
                    revealed seed: {state.serverSeed.slice(0, 32)}…
                  </div>
                )}
              </div>
            </div>

            {/* history */}
            <div className="glass flex flex-wrap gap-1.5 p-3">
              <span className="label-eyebrow mr-1 self-center">Recent</span>
              {state.history.slice(-18).reverse().map((h) => (
                <span key={h.id} className="rounded-md px-2 py-1 font-mono text-xs font-bold" style={{ background: h.crashPoint >= 2 ? '#10f5a022' : '#ff3b6b22', color: h.crashPoint >= 2 ? '#10f5a0' : '#ff3b6b' }}>
                  {h.crashPoint.toFixed(2)}×
                </span>
              ))}
              {state.history.length === 0 && <span className="text-xs text-slate-600">No rounds yet</span>}
            </div>
          </div>

          {/* Controls + players */}
          <div className="space-y-4">
            <div className="glass space-y-3 p-5">
              <div className="flex items-center justify-between">
                <span className="label-eyebrow">Your bet</span>
                <span className="font-mono text-sm font-bold text-white">◎{bet.toFixed(2)}</span>
              </div>
              <input type="range" min={0.01} max={5} step={0.01} value={bet} onChange={(e) => setBet(parseFloat(e.target.value))} className="w-full accent-neon-violet" disabled={state.phase !== 'betting'} />

              {climbing && me && me.cashedAt === null ? (
                <button className="btn-primary btn-win w-full" onClick={cashOut}>Cash out ◎{(me.bet * state.multiplier).toFixed(3)}</button>
              ) : me && me.cashedAt ? (
                <div className="rounded-xl border border-win/40 bg-win/10 p-3 text-center text-sm font-semibold text-win">Cashed at {me.cashedAt.toFixed(2)}× · ◎{me.won.toFixed(3)}</div>
              ) : (
                <button className="btn-primary w-full disabled:opacity-40" disabled={state.phase !== 'betting' || !!me} onClick={() => placeBet(bet, wallet)}>
                  {me ? 'Bet placed — good luck' : state.phase === 'betting' ? `Join round #${state.roundId}` : 'Wait for next round'}
                </button>
              )}
              {state.hash && <div className="truncate text-center font-mono text-[0.6rem] text-slate-600">commit: {state.hash.slice(0, 24)}…</div>}
            </div>

            <div className="glass p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="label-eyebrow">Players this round</span>
                <span className="text-xs text-slate-500">{state.players.length}</span>
              </div>
              <div className="max-h-[280px] space-y-1 overflow-auto">
                {state.players.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-void-900/50 px-2.5 py-1.5 text-xs">
                    <span className="font-mono text-slate-300">{p.wallet}</span>
                    <span className={p.cashedAt ? 'font-bold text-win' : busted ? 'text-loss' : 'text-slate-500'}>
                      {p.cashedAt ? `${p.cashedAt.toFixed(2)}× · ◎${p.won.toFixed(2)}` : busted ? 'bust' : `◎${p.bet.toFixed(2)}`}
                    </span>
                  </div>
                ))}
                {state.players.length === 0 && <p className="py-6 text-center text-xs text-slate-600">Be the first to join this round.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OfflinePanel() {
  return (
    <div className="glass mx-auto max-w-2xl space-y-4 p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-neon-violet/15 text-neon-violet"><Icon name="bolt" size={26} /></span>
      <h3 className="font-display text-lg font-bold text-white">Live servers are not connected</h3>
      <p className="mx-auto max-w-lg text-sm text-slate-400">
        Multiplayer Crash rooms are server-authoritative — they run on a hosted Node process, which GitHub Pages (a static host) can&apos;t provide. The gateway is built and ready in <code className="rounded bg-void-900 px-1.5 py-0.5 text-xs text-slate-300">apps/api</code>.
      </p>
      <div className="rounded-xl border border-white/10 bg-void-950/60 p-4 text-left text-xs text-slate-400">
        <div className="label-eyebrow mb-2">To go live</div>
        <ol className="list-inside list-decimal space-y-1.5">
          <li>Deploy <code className="text-slate-300">apps/api</code> to Render / Fly.io / Railway / a VPS (it exposes a Socket.IO <code className="text-slate-300">/live</code> namespace).</li>
          <li>Set <code className="text-slate-300">NEXT_PUBLIC_REALTIME_URL=https://your-api-host</code> and rebuild the site.</li>
          <li>This page connects automatically and the shared round goes live.</li>
        </ol>
      </div>
      <p className="text-xs text-slate-600">Fairness is commit-reveal: the server publishes sha256(serverSeed) before each round and reveals the seed after the bust, so every crash point is independently verifiable.</p>
    </div>
  );
}

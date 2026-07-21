'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { ShipPicker } from '@/components/worlds/ShipPicker';
import { useShipSkin } from '@/hooks/useShipSkin';
import { usePlaza } from '@/hooks/usePlaza';
import { shortAddr } from '@/lib/format';

const PlazaScene = dynamic(() => import('@/components/worlds/PlazaScene'), {
  ssr: false,
  loading: () => <div className="grid h-[440px] place-items-center text-sm text-slate-500">Entering the plaza…</div>,
});

export default function PlazaPage() {
  const { publicKey } = useWallet();
  const [ship, setShip] = useShipSkin();
  const name = publicKey ? shortAddr(publicKey.toBase58()) : 'guest';
  const { peers, online, connected, enabled, move } = usePlaza(name, ship.id);
  const [showBots] = useState(true);
  const ambient = !connected; // real peers replace the ambient bots once connected

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead eyebrow="Plaza · 3D" title="The shared plaza" sub="A living 3D space you explore as your ship. Tap the floor to glide there; when the server is live you see everyone else move with you in real time." />
        <div className="mb-4 flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-win' : 'bg-slate-600'}`} />
          <span className="text-slate-400">{connected ? `${online} online · shared` : enabled ? 'connecting…' : 'solo mode'}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="glass overflow-hidden p-2">
          <div className="relative h-[440px] overflow-hidden rounded-2xl sm:h-[560px]">
            <PlazaScene skin={ship} peers={peers} ambient={ambient && showBots} onMove={move} />
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-void-950/70 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.2em] text-slate-400 backdrop-blur">
              tap the floor to move
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass p-5">
            <span className="label-eyebrow">Your ship</span>
            <div className="mt-2"><ShipPicker value={ship} onChange={setShip} /></div>
          </div>

          <div className="glass p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="label-eyebrow">In the plaza</span>
              <span className="text-xs text-slate-500">{connected ? online : '—'}</span>
            </div>
            {connected ? (
              <div className="max-h-[220px] space-y-1 overflow-auto">
                <PeerRow name={`${name} (you)`} ship={ship.id} me />
                {peers.map((p) => <PeerRow key={p.id} name={p.name} ship={p.ship} />)}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-void-950/50 p-3 text-xs text-slate-400">
                <p><b className="text-slate-200">Solo mode.</b> You&apos;re exploring with ambient ships. Host <code className="rounded bg-void-900 px-1 text-slate-300">apps/api</code> and set <code className="rounded bg-void-900 px-1 text-slate-300">NEXT_PUBLIC_REALTIME_URL</code> to fill the plaza with real players in real time.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PeerRow({ name, ship, me }: { name: string; ship: string; me?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${me ? 'bg-neon-violet/10' : 'bg-void-900/50'}`}>
      <Icon name="orbit" size={12} />
      <span className="truncate font-mono text-slate-300">{name}</span>
      <span className="ml-auto capitalize text-slate-500">{ship}</span>
    </div>
  );
}

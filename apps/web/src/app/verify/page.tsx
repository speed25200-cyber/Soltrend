'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SectionHead } from '@/components/SectionHead';
import { hmacSha256Hex, sha256Hex } from '@/lib/sha256';
import { firstFloat } from '@/lib/provably-fair';
import { crashPointFromFloat, DEFAULT_EDGE } from '@/lib/games';
import type { Template } from '@/lib/games';

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="glass p-10 text-center text-slate-500">Loading verifier…</div>}>
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const sp = useSearchParams();
  const [server, setServer] = useState('');
  const [client, setClient] = useState('');
  const [nonce, setNonce] = useState('0');
  const [game, setGame] = useState<Template>('dice');

  useEffect(() => {
    if (sp.get('server')) setServer(sp.get('server')!);
    if (sp.get('client')) setClient(sp.get('client')!);
    if (sp.get('nonce')) setNonce(sp.get('nonce')!);
    if (sp.get('game')) setGame(sp.get('game') as Template);
  }, [sp]);

  const n = parseInt(nonce) || 0;
  const canCompute = server.length > 0 && client.length > 0;
  const hash = canCompute ? sha256Hex(server) : '';
  const hmac = canCompute ? hmacSha256Hex(server, `${client}:${n}:0`) : '';
  const float = canCompute ? firstFloat(server, client, n) : 0;

  const outcome = describe(game, float);

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="Provably fair"
        title="Verify any bet"
        sub="Recompute a result from the revealed seeds. This runs entirely in your browser — the same function the server used."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="glass space-y-4 p-6">
          <Field label="Server seed (revealed after rotation)">
            <textarea className="input-num !font-mono h-20 resize-none text-xs" value={server} onChange={(e) => setServer(e.target.value.trim())} placeholder="paste server seed…" />
          </Field>
          <Field label="Client seed">
            <input className="input-num text-sm" value={client} onChange={(e) => setClient(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nonce">
              <input className="input-num text-sm" value={nonce} inputMode="numeric" onChange={(e) => setNonce(e.target.value.replace(/[^0-9]/g, ''))} />
            </Field>
            <Field label="Game">
              <select className="input-num text-sm" value={game} onChange={(e) => setGame(e.target.value as Template)}>
                {(['dice', 'limbo', 'coinflip', 'wheel', 'mines', 'plinko'] as Template[]).map((t) => (
                  <option key={t} value={t} className="bg-void-900">
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="glass space-y-4 p-6">
          <span className="label-eyebrow">Computation</span>
          <Mono label="SHA-256(server seed)" value={hash || '—'} />
          <Mono label={`HMAC-SHA256(server, "${client || 'client'}:${n}:0")`} value={hmac || '—'} />
          <Mono label="Float [0,1)" value={canCompute ? float.toFixed(10) : '—'} />

          <div className="rounded-xl border border-neon-violet/30 bg-neon-violet/[0.06] p-4">
            <div className="label-eyebrow">Derived result — {game}</div>
            <div className="mt-1 font-display text-2xl font-bold text-white">{canCompute ? outcome : '—'}</div>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            To fully verify, confirm the SHA-256 above equals the server-seed hash that was shown to you{' '}
            <em>before</em> you bet. If it matches and the float reproduces your result, the bet was fair.
          </p>
        </div>
      </div>
    </div>
  );
}

function describe(game: Template, float: number): string {
  switch (game) {
    case 'dice':
      return `Roll ${(Math.floor(float * 10000) / 100).toFixed(2)}`;
    case 'limbo':
      return `${crashPointFromFloat(float, DEFAULT_EDGE).toFixed(2)}×`;
    case 'coinflip':
      return float < 0.5 ? 'Heads' : 'Tails';
    case 'wheel':
      return `Segment ${Math.floor(float * 30)} of 30`;
    case 'mines':
      return `First shuffle draw → tile ${Math.floor(float * 25)}`;
    case 'plinko':
      return `First peg → ${float < 0.5 ? 'left' : 'right'}`;
    default:
      return float.toFixed(6);
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Mono({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.65rem] uppercase tracking-wider text-slate-600">{label}</div>
      <div className="mt-1 break-all rounded-lg bg-void-900/80 px-3 py-2 font-mono text-xs text-slate-300">{value}</div>
    </div>
  );
}

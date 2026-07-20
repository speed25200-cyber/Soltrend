'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { ForgeEditor } from '@/components/forge/ForgeEditor';
import { GraphGame } from '@/components/games/GraphGame';
import { simulateGraph, normaliseEdge, starterGraph, FORGE_TEMPLATES, type ForgeGraph } from '@/lib/forge/model';
import { clampEdge } from '@/lib/games';
import { AURAS } from '@/lib/auras';
import { ACCENT_HEX, type GameMeta } from '@/lib/catalog';
import { fmtMult, shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';

const accentHex = (a: string) => ACCENT_HEX[(a as keyof typeof ACCENT_HEX)] ?? '#a855f7';

export default function ForgePage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const publishUgc = useCasino((s) => s.publishUgc);

  const [graph, setGraph] = useState<ForgeGraph>(() => starterGraph());
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState<IconName>('orbit');
  const [accent, setAccent] = useState('violet');
  const [aura, setAura] = useState('nebula');
  const [target, setTarget] = useState(2);
  const [testing, setTesting] = useState(false);
  const [published, setPublished] = useState<{ id: string } | null>(null);

  const sim = useMemo(() => simulateGraph(graph, 20000), [graph]);

  const meta: GameMeta = {
    slug: 'forge-preview',
    name: name || 'Untitled forge game',
    icon,
    tagline: tagline || 'A node-forged original',
    template: 'graph',
    tier: 2,
    accent: accent as GameMeta['accent'],
    aura,
  };

  const normalise = () => {
    const scale = normaliseEdge(graph, target / 100);
    setGraph((g) => ({ nodes: g.nodes.map((n) => (n.kind === 'payout' ? { ...n, params: { ...n.params, scale } } : n)) }));
    sfx.click();
  };

  const canPublish = sim.ok && connected && name.trim().length >= 3;
  const publish = () => {
    if (!canPublish) return;
    const game = publishUgc({
      name: name.trim(),
      template: 'graph',
      creator: publicKey ? shortAddr(publicKey.toBase58()) : 'anon',
      edge: clampEdge(sim.edge),
      params: { graph: JSON.stringify(graph) },
      theme: { accent, icon, aura, tagline: tagline.trim() || undefined },
    });
    sfx.jackpot();
    burstWin(12);
    setPublished({ id: game.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead eyebrow="Forge · Beta" title="Node game forge" sub="Wire RNG → transforms → payout to invent a brand-new game. Validated vault-safe, provably fair." />
        <Link href="/studio" className="mb-4 text-sm text-slate-400 hover:text-white">← Back to templates</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Editor */}
        <div className="min-w-0 space-y-4">
          <div className="glass p-4">
            <ForgeEditor graph={graph} onChange={setGraph} />
            <p className="mt-3 text-xs text-slate-500">
              Drag node headers to arrange. Click an <b className="text-slate-300">output</b> dot, then an{' '}
              <b className="text-slate-300">input</b> dot to wire. Click a connected input to detach.
            </p>
          </div>

          <div className="glass flex flex-wrap items-center gap-2 p-3">
            <span className="label-eyebrow mr-1">Load template</span>
            {FORGE_TEMPLATES.map((t) => (
              <button key={t.id} className="chip hover:border-neon-violet/50" title={t.hint} onClick={() => { setGraph(t.build()); sfx.click(); }}>
                {t.label}
              </button>
            ))}
            <button className="btn-ghost ml-auto !py-1.5 text-xs" onClick={() => setTesting((t) => !t)}>{testing ? 'Hide test' : 'Test drive'}</button>
          </div>

          {testing && (
            <div className="glass p-2">
              <p className="px-3 pb-2 pt-1 text-xs text-slate-500">Live demo of your current graph — plays with your balance.</p>
              <GraphGame meta={meta} params={{ graph: JSON.stringify(graph) }} gameName={name || 'Preview'} />
            </div>
          )}
        </div>

        {/* Right: analysis + brand + publish */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="glass p-5">
            <span className="label-eyebrow">Live analysis (20k spins)</span>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="House edge" value={`${(sim.edge * 100).toFixed(2)}%`} tone={sim.ok ? 'win' : 'loss'} />
              <Stat label="RTP" value={`${(sim.rtp * 100).toFixed(1)}%`} />
              <Stat label="Hit rate" value={`${(sim.hitRate * 100).toFixed(0)}%`} />
              <Stat label="Max seen" value={fmtMult(sim.maxMult)} />
            </div>
            <div className="mt-3 flex items-end gap-2">
              <label className="flex-1">
                <span className="text-[0.62rem] text-slate-500">Target edge %</span>
                <input className="input-num mt-1 text-sm" value={target} inputMode="decimal" onChange={(e) => setTarget(Math.max(1, Math.min(5, parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 1)))} />
              </label>
              <button className="btn-ghost" onClick={normalise}>Normalise</button>
            </div>
            {/* distribution histogram */}
            {sim.buckets.some((b) => b.count > 0) && (
              <div className="mt-4">
                <div className="flex items-end gap-1.5" style={{ height: 84 }}>
                  {sim.buckets.map((b, i) => {
                    const maxC = Math.max(...sim.buckets.map((x) => x.count), 1);
                    const h = (b.count / maxC) * 100;
                    const color = b.label === 'Loss' ? '#ff3b6b' : i >= 4 ? '#ffd25f' : i >= 3 ? '#22d3ee' : '#a855f7';
                    return (
                      <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex w-full items-end" style={{ height: 60 }}>
                          <div className="w-full rounded-t" style={{ height: `${Math.max(2, h)}%`, background: color }} />
                        </div>
                        <span className="text-[0.5rem] text-slate-600">{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {sim.errors.map((e) => (
              <p key={e} className="mt-2 flex items-start gap-1.5 rounded-lg bg-loss/10 px-3 py-2 text-xs text-loss"><Icon name="block" size={13} className="mt-px shrink-0" /> {e}</p>
            ))}
            {sim.ok && <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-win/10 px-3 py-2 text-xs text-win"><Icon name="shield" size={13} className="mt-px shrink-0" /> Valid &amp; vault-safe.</p>}
          </div>

          <div className="glass p-5">
            <span className="label-eyebrow">Brand it</span>
            <div className="mt-3 space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Game name" maxLength={28} className="input-num !font-sans" />
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" maxLength={44} className="input-num !font-sans text-sm" />
              <div className="flex flex-wrap gap-1.5">
                {STUDIO_ICONS.map((e) => (
                  <button key={e} onClick={() => setIcon(e)} className={`grid h-8 w-8 place-items-center rounded-lg transition ${icon === e ? 'bg-neon-violet/20 text-neon-violet ring-1 ring-neon-violet/60' : 'bg-void-900/60 text-slate-400 hover:bg-white/5'}`}>
                    <Icon name={e} size={16} />
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <div className="flex gap-2">
                  {['violet', 'cyan', 'gold', 'pink'].map((a) => (
                    <button key={a} onClick={() => setAccent(a)} className={`h-7 w-7 rounded-lg ${accent === a ? 'ring-2 ring-white' : ''}`} style={{ background: accentHex(a) }} />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {AURAS.map((a) => (
                    <button key={a.id} onClick={() => setAura(a.id)} className={`h-7 w-7 rounded-lg border border-white/10 ${aura === a.id ? 'ring-2 ring-white' : ''}`} style={{ background: a.css, backgroundColor: '#0d1024' }} title={a.label} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {published ? (
            <div className="glass grid place-items-center gap-2 p-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-win/15 text-win"><Icon name="check" size={26} /></span>
              <div className="font-display font-bold text-white">Forged &amp; published!</div>
              <button className="btn-primary mt-1" onClick={() => router.push(`/play/ugc?id=${published.id}`)}>Play it →</button>
            </div>
          ) : (
            <button className="btn-primary w-full" disabled={!canPublish} onClick={publish}>
              {!connected ? 'Connect wallet to publish' : !sim.ok ? 'Fix the graph to publish' : name.trim().length < 3 ? 'Name your game' : 'Publish forged game'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'win' | 'loss' }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`font-mono text-base font-bold ${tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : 'text-white'}`}>{value}</div>
    </div>
  );
}

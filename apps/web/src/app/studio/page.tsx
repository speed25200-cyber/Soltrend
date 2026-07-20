'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { CREATABLE_TEMPLATES, validateSpec, type GameSpec } from '@/lib/gamespec';
import { MIN_EDGE, MAX_EDGE, type Template } from '@/lib/games';
import { fmtMult, shortAddr } from '@/lib/format';
import { SectionHead } from '@/components/SectionHead';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { ACCENT_HEX, type GameMeta } from '@/lib/catalog';
import { AURAS, auraCss } from '@/lib/auras';
import { simulate, type SimResult } from '@/lib/simulate';
import { sha256Hex } from '@/lib/provably-fair';
import { GameScreen } from '@/components/games/GameScreen';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';

const accentHex = (a: string) => ACCENT_HEX[(a as keyof typeof ACCENT_HEX)] ?? '#a855f7';

const TEMPLATE_META: Record<string, { icon: IconName; label: string; blurb: string }> = {
  dice: { icon: 'dice', label: 'Dice', blurb: 'Over/under a threshold' },
  limbo: { icon: 'limbo', label: 'Limbo', blurb: 'Aim for a target multiplier' },
  mines: { icon: 'bomb', label: 'Mines', blurb: 'Reveal gems, dodge bombs' },
  plinko: { icon: 'plinko', label: 'Plinko', blurb: 'Drop the ball into buckets' },
  wheel: { icon: 'wheel', label: 'Wheel', blurb: 'Spin weighted segments' },
  coinflip: { icon: 'coin', label: 'Coinflip', blurb: 'Instant 50/50' },
};

type Tab = 'design' | 'simulate' | 'test' | 'publish';
const TABS: { id: Tab; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'test', label: 'Test drive' },
  { id: 'publish', label: 'Publish' },
];

export default function StudioPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const publishUgc = useCasino((s) => s.publishUgc);

  const [tab, setTab] = useState<Tab>('design');
  const [template, setTemplate] = useState<Template>('dice');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState<IconName>('dice');
  const [accent, setAccent] = useState('violet');
  const [aura, setAura] = useState('nebula');
  const [edge, setEdge] = useState(0.01);
  const [bombs, setBombs] = useState(3);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [rows, setRows] = useState<8 | 12 | 16>(12);
  const [target, setTarget] = useState(50);
  const [over, setOver] = useState(true);
  const [simPicks, setSimPicks] = useState(3);

  const params = useMemo<Record<string, number | string>>(() => {
    const p: Record<string, number | string> = {};
    if (template === 'dice') {
      p.target = target;
      p.over = over ? 1 : 0;
    } else if (template === 'limbo') {
      p.target = target < 1.1 ? 2 : target / 25 + 1;
    } else if (template === 'mines') {
      p.grid = 25;
      p.bombs = bombs;
    } else if (template === 'plinko') {
      p.risk = risk;
      p.rows = rows;
    } else if (template === 'wheel') {
      p.risk = risk;
    }
    return p;
  }, [template, target, over, bombs, risk, rows]);

  const spec: GameSpec = { template, name, edge, params, theme: { accent, icon } };
  const v = validateSpec(spec);
  const specHash = useMemo(
    () => sha256Hex(JSON.stringify({ t: template, e: edge, p: params, n: name })),
    [template, edge, params, name],
  );

  const meta: GameMeta = {
    slug: 'preview',
    name: name || 'Untitled game',
    icon,
    tagline: tagline || 'A community original',
    template,
    tier: 2,
    accent: accent as GameMeta['accent'],
    aura,
  };

  const [published, setPublished] = useState<{ id: string } | null>(null);
  const publish = () => {
    if (!v.ok || !connected) return;
    const game = publishUgc({
      name: name.trim(),
      template,
      creator: publicKey ? shortAddr(publicKey.toBase58()) : 'anon',
      edge,
      params,
      theme: { accent, icon, aura, tagline: tagline.trim() || undefined },
    });
    sfx.jackpot();
    burstWin(12);
    setPublished({ id: game.id });
  };

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="Studio"
        title="Design your own game"
        sub="Assemble from audited primitives, stress-test the maths, play it, then publish — no code, no smart contract."
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-void-900/80 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              sfx.click();
              setTab(t.id);
            }}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left: tab content */}
        <div className="min-w-0 space-y-4">
          {tab === 'design' && (
            <DesignTab
              {...{ template, setTemplate, setIcon, edge, setEdge, bombs, setBombs, risk, setRisk, rows, setRows, target, setTarget, over, setOver, name, setName, tagline, setTagline, icon, accent, setAccent, aura, setAura }}
            />
          )}
          {tab === 'simulate' && (
            <SimulateTab template={template} params={params} edge={edge} simPicks={simPicks} setSimPicks={setSimPicks} />
          )}
          {tab === 'test' && (
            <div className="glass p-2">
              <p className="px-3 pb-2 pt-1 text-xs text-slate-500">
                Live demo — plays with your balance, nothing is published yet.
              </p>
              <GameScreen config={{ meta, edge, params, gameName: name || 'Preview' }} />
            </div>
          )}
          {tab === 'publish' && (
            <PublishTab
              meta={meta}
              specHash={specHash}
              v={v}
              connected={connected}
              published={published}
              onPublish={publish}
              onPlay={() => published && router.push(`/play/ugc?id=${published.id}`)}
            />
          )}
        </div>

        {/* Right: persistent live preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <PreviewCard meta={meta} v={v} edge={edge} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Design */

function DesignTab(p: any) {
  return (
    <>
      <div className="glass p-5">
        <span className="label-eyebrow">1 · Choose a mechanic</span>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CREATABLE_TEMPLATES.map((t) => {
            const m = TEMPLATE_META[t];
            const active = p.template === t;
            return (
              <button
                key={t}
                onClick={() => {
                  p.setTemplate(t);
                  p.setIcon(m.icon);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  active ? 'border-neon-violet/60 bg-neon-violet/10 shadow-glow-violet' : 'border-white/[0.06] bg-void-900/50 hover:border-white/20'
                }`}
              >
                <div className={active ? 'text-neon-violet' : 'text-slate-300'}>
                  <Icon name={m.icon} size={26} />
                </div>
                <div className="mt-1.5 font-display text-sm font-bold text-white">{m.label}</div>
                <div className="text-[0.68rem] text-slate-500">{m.blurb}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass p-5">
        <span className="label-eyebrow">2 · Tune the math</span>
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">House edge</span>
            <span className="font-mono font-bold text-white">{(p.edge * 100).toFixed(1)}%</span>
          </div>
          <input type="range" min={MIN_EDGE * 1000} max={MAX_EDGE * 1000} step={5} value={p.edge * 1000} onChange={(e) => p.setEdge(parseInt(e.target.value) / 1000)} className="mt-2 w-full accent-neon-violet" />
          <div className="flex justify-between font-mono text-[0.65rem] text-slate-600"><span>{MIN_EDGE * 100}% (min)</span><span>{MAX_EDGE * 100}% (max)</span></div>
        </div>

        {p.template === 'dice' && (
          <>
            <Range label={`Threshold (${p.target})`} value={p.target} min={2} max={98} onChange={p.setTarget} />
            <Segmented label="Direction" value={p.over ? 'over' : 'under'} options={['under', 'over']} onChange={(x: string) => p.setOver(x === 'over')} />
          </>
        )}
        {p.template === 'limbo' && (
          <Range label={`Default target ≈ ${(p.target / 25 + 1).toFixed(2)}×`} value={p.target} min={2} max={98} onChange={p.setTarget} />
        )}
        {p.template === 'mines' && <Range label={`Mines (${p.bombs})`} value={p.bombs} min={1} max={24} onChange={p.setBombs} />}
        {(p.template === 'plinko' || p.template === 'wheel') && (
          <Segmented label="Risk" value={p.risk} options={['low', 'medium', 'high']} onChange={(x: string) => p.setRisk(x as any)} />
        )}
        {p.template === 'plinko' && (
          <Segmented label="Rows" value={String(p.rows)} options={['8', '12', '16']} onChange={(x: string) => p.setRows(parseInt(x) as any)} />
        )}
      </div>

      <div className="glass p-5">
        <span className="label-eyebrow">3 · Brand it</span>
        <div className="mt-3 space-y-3">
          <input value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="Game name (e.g. Neon Overdrive)" maxLength={28} className="input-num !font-sans" />
          <input value={p.tagline} onChange={(e) => p.setTagline(e.target.value)} placeholder="Tagline (e.g. Pure adrenaline, every roll)" maxLength={44} className="input-num !font-sans text-sm" />
          <div>
            <span className="text-xs text-slate-500">Icon</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {STUDIO_ICONS.map((e) => (
                <button key={e} onClick={() => p.setIcon(e)} className={`grid h-9 w-9 place-items-center rounded-lg transition ${p.icon === e ? 'bg-neon-violet/20 text-neon-violet ring-1 ring-neon-violet/60' : 'bg-void-900/60 text-slate-400 hover:bg-white/5'}`}>
                  <Icon name={e} size={18} />
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500">Accent</span>
              <div className="mt-1.5 flex gap-2">
                {['violet', 'cyan', 'gold', 'pink'].map((a) => (
                  <button key={a} onClick={() => p.setAccent(a)} className={`h-8 w-8 rounded-lg transition ${p.accent === a ? 'ring-2 ring-white' : ''}`} style={{ background: accentHex(a) }} aria-label={a} />
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Aura</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {AURAS.map((a) => (
                  <button key={a.id} onClick={() => p.setAura(a.id)} className={`h-8 w-8 rounded-lg border border-white/10 transition ${p.aura === a.id ? 'ring-2 ring-white' : ''}`} style={{ background: a.css, backgroundColor: '#0d1024' }} title={a.label} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Simulate */

function SimulateTab({ template, params, edge, simPicks, setSimPicks }: { template: Template; params: any; edge: number; simPicks: number; setSimPicks: (n: number) => void }) {
  const [rounds, setRounds] = useState(5000);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    sfx.click();
    // Yield a frame so the button shows "Running…" before the sync loop.
    setTimeout(() => {
      const p = template === 'mines' ? { ...params, picks: simPicks } : params;
      setSim(simulate(template, p, edge, rounds));
      setRunning(false);
    }, 20);
  };

  const maxCount = sim ? Math.max(...sim.buckets.map((b) => b.count), 1) : 1;

  return (
    <div className="space-y-4">
      <div className="glass p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-neon-cyan/15 text-neon-cyan"><Icon name="target" size={16} /></span>
          <div>
            <h3 className="font-display font-bold text-white">Monte-Carlo lab</h3>
            <p className="text-xs text-slate-500">Runs the real provably-fair engine to reveal the true numbers.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <span className="text-xs text-slate-500">Rounds</span>
            <div className="mt-1.5 flex gap-1 rounded-xl bg-void-900/80 p-1">
              {[1000, 5000, 20000].map((r) => (
                <button key={r} onClick={() => setRounds(r)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${rounds === r ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
                  {r >= 1000 ? `${r / 1000}k` : r}
                </button>
              ))}
            </div>
          </div>
          {template === 'mines' && (
            <div className="flex-1 min-w-[160px]">
              <div className="flex justify-between text-xs text-slate-500"><span>Cash out after</span><span className="font-mono text-white">{simPicks} tiles</span></div>
              <input type="range" min={1} max={12} value={simPicks} onChange={(e) => setSimPicks(parseInt(e.target.value))} className="mt-1 w-full accent-neon-violet" />
            </div>
          )}
          <button className="btn-primary ml-auto" disabled={running} onClick={run}>
            {running ? 'Running…' : `Run ${rounds >= 1000 ? rounds / 1000 + 'k' : rounds} spins`}
          </button>
        </div>
      </div>

      {sim && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SimStat label="Actual RTP" value={`${(sim.rtp * 100).toFixed(2)}%`} tone="win" />
            <SimStat label="Realised edge" value={`${(sim.edge * 100).toFixed(2)}%`} />
            <SimStat label="Hit rate" value={`${(sim.hitRate * 100).toFixed(1)}%`} />
            <SimStat label="Avg win" value={fmtMult(sim.avgWinMult)} />
            <SimStat label="Max seen" value={fmtMult(sim.maxMult)} tone="gold" />
            <SimStat label="Volatility" value={sim.volatilityLabel} />
          </div>

          <div className="glass p-5">
            <span className="label-eyebrow">Payout distribution ({sim.rounds.toLocaleString()} spins)</span>
            <div className="mt-4 flex items-end gap-2" style={{ height: 160 }}>
              {sim.buckets.map((b, i) => {
                const h = (b.count / maxCount) * 100;
                const color = b.label === 'Loss' ? '#ff3b6b' : i >= 5 ? '#ffd25f' : i >= 3 ? '#22d3ee' : '#a855f7';
                return (
                  <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                    <div className="text-[0.6rem] font-mono text-slate-500">{((b.count / sim.rounds) * 100).toFixed(0)}%</div>
                    <div className="flex w-full items-end" style={{ height: 110 }}>
                      <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(2, h)}%`, background: color, boxShadow: `0 0 16px -6px ${color}` }} />
                    </div>
                    <div className="text-[0.58rem] text-slate-500">{b.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="rounded-xl border border-white/[0.06] bg-void-900/50 p-4 text-xs leading-relaxed text-slate-400">
            {verdict(sim)}
          </p>
        </>
      )}
      {!sim && (
        <div className="glass grid place-items-center p-12 text-center text-sm text-slate-500">
          Run a simulation to see the true RTP, hit rate, volatility and payout distribution of your design.
        </div>
      )}
    </div>
  );
}

function verdict(s: SimResult): string {
  const bits: string[] = [];
  bits.push(`Over ${s.rounds.toLocaleString()} spins the game returned ${(s.rtp * 100).toFixed(2)}% to players (${(s.edge * 100).toFixed(2)}% house edge).`);
  bits.push(s.hitRate > 0.45 ? `Players win often (${(s.hitRate * 100).toFixed(0)}%) — feels friendly and sticky.` : `Wins are rarer (${(s.hitRate * 100).toFixed(0)}%) but bigger — a thrill-seeker's game.`);
  bits.push(s.volatilityLabel === 'Extreme' || s.volatilityLabel === 'High' ? `${s.volatilityLabel} volatility: big swings, very streamable, needs bankroll.` : `${s.volatilityLabel} volatility: steady sessions, great for newcomers.`);
  return bits.join(' ');
}

/* ----------------------------------------------------------------- Publish */

function PublishTab({ meta, specHash, v, connected, published, onPublish, onPlay }: any) {
  if (published) {
    return (
      <div className="glass grid place-items-center gap-4 p-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-win/15 text-win"><Icon name="check" size={32} /></span>
        <h3 className="font-display text-2xl font-bold text-white">Published!</h3>
        <p className="max-w-sm text-sm text-slate-500">Your game is live in Discover and starts accruing creator royalties the moment people play it.</p>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={onPlay}>Play it now →</button>
          <Link href="/discover" className="btn-ghost">See in Discover</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="glass p-6">
      <h3 className="font-display text-lg font-bold text-white">Review &amp; publish</h3>
      <div className="mt-4 space-y-2 text-sm">
        <Row2 label="Game" value={meta.name} />
        <Row2 label="Mechanic" value={meta.template} />
        <Row2 label="Return to player" value={`${(v.rtp * 100).toFixed(1)}%`} good />
        <Row2 label="Max win" value={fmtMult(v.maxWinMult)} />
      </div>
      <div className="mt-4">
        <div className="label-eyebrow">GameSpec hash (immutable, on-chain reference)</div>
        <div className="mt-1 break-all rounded-lg bg-void-900/80 px-3 py-2 font-mono text-xs text-slate-400">{specHash}</div>
      </div>
      {v.errors.map((e: string) => (
        <p key={e} className="mt-2 flex items-start gap-1.5 rounded-lg bg-loss/10 px-3 py-2 text-xs text-loss"><Icon name="block" size={13} className="mt-px shrink-0" /> {e}</p>
      ))}
      {v.ok && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-win/10 px-3 py-2 text-xs text-win"><Icon name="shield" size={13} className="mt-px shrink-0" /> Valid &amp; vault-safe. RNG is the platform VRF — un-biasable.</p>
      )}
      <button className="btn-primary mt-4 w-full" disabled={!v.ok || !connected} onClick={onPublish}>
        {connected ? 'Publish game' : 'Connect wallet to publish'}
      </button>
      <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-600">
        Royalties accrue to your on-chain creator vault. Claiming requires KYC — a design licence paid by the operator, not a share of player losses.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function PreviewCard({ meta, v, edge }: { meta: GameMeta; v: any; edge: number }) {
  const hex = accentHex(meta.accent);
  return (
    <div className="glass overflow-hidden p-5">
      <span className="label-eyebrow">Live preview</span>
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/[0.06] p-6 text-center" style={{ backgroundColor: '#0d1024' }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: auraCss(meta.aura) }} />
        <div className="relative z-10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl" style={{ color: hex, background: `${hex}1f`, boxShadow: `0 0 30px -10px ${hex}` }}>
            <Icon name={meta.icon} size={34} strokeWidth={1.5} />
          </div>
          <div className="mt-3 font-display text-lg font-bold text-white">{meta.name}</div>
          <div className="text-xs text-slate-500">{meta.tagline}</div>
        </div>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <Row2 label="Return to player" value={`${(v.rtp * 100).toFixed(1)}%`} good />
        <Row2 label="House edge" value={`${(edge * 100).toFixed(1)}%`} />
        <Row2 label="Max win" value={fmtMult(v.maxWinMult)} />
      </dl>
    </div>
  );
}

function Row2({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-mono font-bold capitalize ${good ? 'text-win' : 'text-white'}`}>{value}</dd>
    </div>
  );
}

function SimStat({ label, value, tone }: { label: string; value: string; tone?: 'win' | 'gold' }) {
  return (
    <div className="glass p-4">
      <div className="label-eyebrow">{label}</div>
      <div className={`font-display text-lg font-bold ${tone === 'win' ? 'text-win' : tone === 'gold' ? 'text-gold' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function Range({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-sm"><span className="text-slate-400">{label}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="mt-2 w-full accent-neon-violet" />
    </div>
  );
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="mt-4">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="mt-1.5 flex gap-1 rounded-xl bg-void-900/80 p-1">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold capitalize transition ${value === o ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { CREATABLE_TEMPLATES, validateSpec, type GameSpec } from '@/lib/gamespec';
import { MIN_EDGE, MAX_EDGE, type Template } from '@/lib/games';
import { fmtMult } from '@/lib/format';
import { shortAddr } from '@/lib/format';
import { SectionHead } from '@/components/SectionHead';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { ACCENT_HEX } from '@/lib/catalog';

const accentHex = (a: string) => ACCENT_HEX[(a as keyof typeof ACCENT_HEX)] ?? '#a855f7';

const TEMPLATE_META: Record<string, { icon: IconName; label: string; blurb: string }> = {
  dice: { icon: 'dice', label: 'Dice', blurb: 'Over/under a threshold' },
  limbo: { icon: 'limbo', label: 'Limbo', blurb: 'Aim for a target multiplier' },
  mines: { icon: 'bomb', label: 'Mines', blurb: 'Reveal gems, dodge bombs' },
  plinko: { icon: 'plinko', label: 'Plinko', blurb: 'Drop the ball into buckets' },
  wheel: { icon: 'wheel', label: 'Wheel', blurb: 'Spin weighted segments' },
  coinflip: { icon: 'coin', label: 'Coinflip', blurb: 'Instant 50/50' },
};
const ACCENTS = ['violet', 'cyan', 'gold', 'pink'];

export default function StudioPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const publishUgc = useCasino((s) => s.publishUgc);

  const [template, setTemplate] = useState<Template>('dice');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>('dice');
  const [accent, setAccent] = useState('violet');
  const [edge, setEdge] = useState(0.01);
  const [bombs, setBombs] = useState(3);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [rows, setRows] = useState<8 | 12 | 16>(12);

  const params = useMemo<Record<string, number | string>>(() => {
    const p: Record<string, number | string> = {};
    if (template === 'mines') {
      p.grid = 25;
      p.bombs = bombs;
    } else if (template === 'plinko') {
      p.risk = risk;
      p.rows = rows;
    } else if (template === 'wheel') {
      p.risk = risk;
    }
    return p;
  }, [template, bombs, risk, rows]);

  const spec: GameSpec = { template, name, edge, params, theme: { accent, icon } };
  const v = validateSpec(spec);

  const publish = () => {
    if (!v.ok || !connected) return;
    const game = publishUgc({
      name: name.trim(),
      template,
      creator: publicKey ? shortAddr(publicKey.toBase58()) : 'anon',
      edge,
      params,
      theme: { accent, icon },
    });
    router.push(`/play/ugc?id=${game.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionHead
          eyebrow="Studio"
          title="Design your own game"
          sub="Assemble from audited primitives — no code, no smart contract. You keep a royalty on every bet."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Builder */}
        <div className="space-y-4">
          <div className="glass p-5">
            <span className="label-eyebrow">1 · Choose a mechanic</span>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CREATABLE_TEMPLATES.map((t) => {
                const m = TEMPLATE_META[t];
                const active = template === t;
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setTemplate(t);
                      setIcon(m.icon);
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-neon-violet/60 bg-neon-violet/10 shadow-glow-violet'
                        : 'border-white/[0.06] bg-void-900/50 hover:border-white/20'
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
                <span className="font-mono font-bold text-white">{(edge * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min={MIN_EDGE * 1000}
                max={MAX_EDGE * 1000}
                step={5}
                value={edge * 1000}
                onChange={(e) => setEdge(parseInt(e.target.value) / 1000)}
                className="mt-2 w-full accent-neon-violet"
              />
              <div className="flex justify-between font-mono text-[0.65rem] text-slate-600">
                <span>{MIN_EDGE * 100}% (min)</span>
                <span>{MAX_EDGE * 100}% (max)</span>
              </div>
            </div>

            {template === 'mines' && (
              <ParamRange label="Mines" value={bombs} min={1} max={24} onChange={setBombs} />
            )}
            {(template === 'plinko' || template === 'wheel') && (
              <Segmented
                label="Risk"
                value={risk}
                options={['low', 'medium', 'high']}
                onChange={(x) => setRisk(x as any)}
              />
            )}
            {template === 'plinko' && (
              <Segmented
                label="Rows"
                value={String(rows)}
                options={['8', '12', '16']}
                onChange={(x) => setRows(parseInt(x) as any)}
              />
            )}
          </div>

          <div className="glass p-5">
            <span className="label-eyebrow">3 · Brand it</span>
            <div className="mt-3 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Game name (e.g. Neon Overdrive)"
                maxLength={28}
                className="input-num !font-sans"
              />
              <div>
                <span className="text-xs text-slate-500">Icon</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {STUDIO_ICONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setIcon(e)}
                      className={`grid h-9 w-9 place-items-center rounded-lg transition ${
                        icon === e ? 'bg-neon-violet/20 text-neon-violet ring-1 ring-neon-violet/60' : 'bg-void-900/60 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <Icon name={e} size={18} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">Accent</span>
                <div className="mt-1.5 flex gap-2">
                  {ACCENTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAccent(a)}
                      className={`h-8 w-8 rounded-lg capitalize transition ${accent === a ? 'ring-2 ring-white' : ''}`}
                      style={{ background: { violet: '#a855f7', cyan: '#22d3ee', gold: '#ffd25f', pink: '#ec4899' }[a] }}
                      aria-label={a}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live preview / validation */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass overflow-hidden p-5">
            <span className="label-eyebrow">Live preview</span>
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-void-900/60 p-5 text-center">
              <div
                className="mx-auto grid h-16 w-16 place-items-center rounded-2xl"
                style={{ color: accentHex(accent), background: `${accentHex(accent)}1f`, boxShadow: `0 0 30px -12px ${accentHex(accent)}` }}
              >
                <Icon name={icon} size={34} strokeWidth={1.5} />
              </div>
              <div className="mt-3 font-display text-lg font-bold text-white">{name || 'Untitled game'}</div>
              <div className="text-xs text-slate-500 capitalize">{template}</div>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Return to player" value={`${(v.rtp * 100).toFixed(1)}%`} good />
              <Row label="House edge" value={`${(edge * 100).toFixed(1)}%`} />
              <Row label="Max win" value={fmtMult(v.maxWinMult)} />
            </dl>

            {v.errors.map((e) => (
              <p key={e} className="mt-2 flex items-start gap-1.5 rounded-lg bg-loss/10 px-3 py-2 text-xs text-loss">
                <Icon name="block" size={13} className="mt-px shrink-0" /> {e}
              </p>
            ))}
            {v.ok &&
              v.warnings.map((w) => (
                <p key={w} className="mt-2 flex items-start gap-1.5 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">
                  <Icon name="warn" size={13} className="mt-px shrink-0" /> {w}
                </p>
              ))}
            {v.ok && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-win/10 px-3 py-2 text-xs text-win">
                <Icon name="shield" size={13} className="mt-px shrink-0" /> Spec is valid &amp; vault-safe. RNG is the platform VRF — you can’t bias it.
              </p>
            )}

            <button
              className="btn-primary mt-4 w-full"
              disabled={!v.ok || !connected}
              onClick={publish}
            >
              {connected ? 'Publish game' : 'Connect wallet to publish'}
            </button>
            <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-600">
              Royalties accrue to your on-chain creator vault. Claiming requires KYC verification — a
              design licence paid by the operator, not a share of player losses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-mono font-bold ${good ? 'text-win' : 'text-white'}`}>{value}</dd>
    </div>
  );
}

function ParamRange({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-bold text-white">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="mt-2 w-full accent-neon-violet"
      />
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-4">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="mt-1.5 flex gap-1 rounded-xl bg-void-900/80 p-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold capitalize transition ${
              value === o ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

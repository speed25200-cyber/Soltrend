'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { ForgeEditor } from '@/components/forge/ForgeEditor';
import { WorldGame } from '@/components/games/WorldGame';
import {
  clampSpec, cellCount, BOARD_SKINS, BOARD_FX, BOARD_TEMPLATES, type BoardSkin, type BoardFx,
} from '@/lib/forge/board';
import {
  defaultWorld, worldStats, worldToParams, worldFromParams, normaliseLogic,
  ENVIRONMENTS, CAMERAS, type WorldSpec, type EnvironmentId, type CameraId,
} from '@/lib/forge/world';
import { starterGraph, simulateGraph } from '@/lib/forge/model';
import { BACKGROUNDS, SOUND_PACKS, WIN_EFFECTS, type BackgroundId, type SoundPackId, type WinEffectId } from '@/lib/presentation';
import { ACCENT_HEX, type GameMeta } from '@/lib/catalog';
import { shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';

const World3D = dynamic(() => import('@/components/worlds/World3D'), {
  ssr: false,
  loading: () => <div className="grid h-[340px] place-items-center text-sm text-slate-500">Loading 3D world…</div>,
});

const ACCENTS: GameMeta['accent'][] = ['violet', 'cyan', 'gold', 'pink', 'win'];
type Tab = 'world' | 'logic';

export default function WorldsPage() {
  const { publicKey, connected } = useWallet();
  const publishUgc = useCasino((s) => s.publishUgc);
  const ugc = useCasino((s) => s.ugc);

  const [spec, setSpecRaw] = useState<WorldSpec>(() => defaultWorld(clampSpec(BOARD_TEMPLATES[0].spec)));
  const setBoard = (patch: Partial<WorldSpec['board']>) => setSpecRaw((s) => ({ ...s, board: clampSpec({ ...s.board, ...patch }) }));
  const setWorld = (patch: Partial<WorldSpec>) => setSpecRaw((s) => ({ ...s, ...patch }));
  const [target, setTarget] = useState(2);
  const [tab, setTab] = useState<Tab>('world');

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState<IconName>('gem');
  const [accent, setAccent] = useState<GameMeta['accent']>('cyan');
  const [background, setBackground] = useState<BackgroundId>('aurora');
  const [soundPack, setSoundPack] = useState<SoundPackId>('crystal');
  const [winEffect, setWinEffect] = useState<WinEffectId>('coins');
  const [testing, setTesting] = useState(false);
  const [published, setPublished] = useState<{ id: string } | null>(null);

  const skin = BOARD_SKINS[spec.board.skin];
  const stats = useMemo(() => worldStats(spec, target / 100), [spec, target]);
  const logicSim = useMemo(() => (spec.logic ? simulateGraph(spec.logic, 12000) : null), [spec.logic]);

  const loadTemplate = (t: (typeof BOARD_TEMPLATES)[number]) => {
    setSpecRaw((s) => ({ ...s, board: clampSpec(t.spec) }));
    setTarget(Math.round(t.edge * 100));
    setIcon(BOARD_SKINS[t.spec.skin].icon);
    sfx.click();
  };

  const attachLogic = () => {
    const g = starterGraph();
    setSpecRaw((s) => ({ ...s, logic: g, logicScale: normaliseLogic(g) }));
    setTab('logic');
    sfx.click();
  };
  const detachLogic = () => { setSpecRaw((s) => ({ ...s, logic: null, logicScale: 1 })); sfx.click(); };
  const editLogic = (graph: WorldSpec['logic']) => {
    if (!graph) return;
    setSpecRaw((s) => ({ ...s, logic: graph, logicScale: normaliseLogic(graph) }));
  };

  // Remix a published world via ?remix=<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('remix');
    if (!id) return;
    const src = ugc.find((game) => game.id === id);
    if (!src || src.template !== 'board') return;
    setSpecRaw(worldFromParams(src.params));
    setName(`${src.name} remix`);
    setTagline(src.theme.tagline || '');
    setIcon((src.theme.icon as IconName) || 'gem');
    setAccent((src.theme.accent as GameMeta['accent']) || 'cyan');
    if (src.theme.background) setBackground(src.theme.background as BackgroundId);
    if (src.theme.soundPack) setSoundPack(src.theme.soundPack as SoundPackId);
    if (src.theme.winEffect) setWinEffect(src.theme.winEffect as WinEffectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta: GameMeta = {
    slug: 'world-preview', name: name || 'Untitled world', icon,
    tagline: tagline || 'A 3D world', template: 'board', tier: 2, accent,
    background, soundPack, winEffect, seedKey: name || 'world-preview',
  };

  // Idle preview: sprinkle a few revealed tiles so the 3D scene reads instantly.
  const demoRevealed = useMemo(() => {
    const n = cellCount(spec.board);
    return new Set([1, Math.floor(n / 2), n - 2].filter((i) => i >= 0 && i < n));
  }, [spec.board]);

  const canPublish = stats.ok && connected && name.trim().length >= 3;
  const publish = () => {
    if (!canPublish) return;
    const game = publishUgc({
      name: name.trim(), template: 'board',
      creator: publicKey ? shortAddr(publicKey.toBase58()) : 'anon',
      edge: stats.edge, params: worldToParams(spec),
      theme: { accent, icon, aura: 'nebula', tagline: tagline.trim() || undefined, background, soundPack, winEffect },
    });
    sfx.jackpot();
    burstWin(12);
    setPublished({ id: game.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead eyebrow="Worlds · Beta" title="3D game creator" sub="Design a playable 3D world — a board players reveal in space, with an optional node-graph logic core. Provably fair, vault-safe, runs in your browser." />
        <Link href="/forge" className="mb-4 text-sm text-slate-400 hover:text-white">Pure logic Forge →</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Creator */}
        <div className="min-w-0 space-y-4">
          {/* 3D preview / play-test */}
          <div className="glass overflow-hidden p-2">
            {testing ? (
              <WorldGame meta={meta} edge={stats.edge} params={worldToParams(spec)} gameName={name || 'Preview'} />
            ) : (
              <div className="relative h-[340px] overflow-hidden rounded-2xl sm:h-[400px]">
                <World3D spec={{ ...spec, camera: 'cinematic' }} revealed={demoRevealed} bombSet={new Set()} showBombs={false} playing={false} hitIndex={null} onReveal={() => {}} heat={0.4} />
                <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-void-950/70 px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.2em] text-slate-400 backdrop-blur">Live 3D preview · drag to orbit</div>
              </div>
            )}
          </div>

          {/* templates + play-test */}
          <div className="glass flex flex-wrap items-center gap-2 p-3">
            <span className="label-eyebrow mx-1">templates</span>
            {BOARD_TEMPLATES.map((t) => (
              <button key={t.id} className="chip hover:border-neon-cyan/50" title={t.hint} onClick={() => loadTemplate(t)}>{t.label}</button>
            ))}
            <button className="btn-ghost ml-auto !py-1.5 text-xs" onClick={() => setTesting((v) => !v)}>{testing ? 'Exit test' : 'Play test'}</button>
          </div>

          {/* tabs: World / Logic */}
          <div className="flex gap-1 rounded-xl bg-void-900/80 p-1">
            <TabBtn active={tab === 'world'} onClick={() => setTab('world')} icon="orbit" label="World (body)" />
            <TabBtn active={tab === 'logic'} onClick={() => setTab('logic')} icon="spark" label={spec.logic ? 'Logic (brain) · on' : 'Logic (brain)'} />
          </div>

          {tab === 'world' ? (
            <div className="glass space-y-4 p-4">
              <Slider label="Rows" value={spec.board.rows} min={3} max={6} onChange={(v) => setBoard({ rows: v })} />
              <Slider label="Columns" value={spec.board.cols} min={3} max={6} onChange={(v) => setBoard({ cols: v })} />
              <Slider label="Hazards" value={spec.board.bombs} min={1} max={cellCount(spec.board) - 1} onChange={(v) => setBoard({ bombs: v })} accent={skin.bomb} />

              <PickGrid label="Skin" items={Object.values(BOARD_SKINS).map((s) => ({ id: s.id, label: s.label, color: s.gem }))} value={spec.board.skin} onPick={(v) => { setBoard({ skin: v as BoardSkin }); setIcon(BOARD_SKINS[v as BoardSkin].icon); sfx.click(); }} />
              <PickRow label="Reveal effect" items={BOARD_FX} value={spec.board.fx} onPick={(v) => { setBoard({ fx: v as BoardFx }); sfx.click(); }} />
              <PickRow label="Environment" items={ENVIRONMENTS} value={spec.environment} onPick={(v) => { setWorld({ environment: v as EnvironmentId }); sfx.click(); }} />
              <PickRow label="Camera" items={CAMERAS} value={spec.camera} onPick={(v) => { setWorld({ camera: v as CameraId }); sfx.click(); }} />
            </div>
          ) : (
            <div className="glass space-y-3 p-4">
              {!spec.logic ? (
                <div className="grid place-items-center gap-3 py-6 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-neon-violet/15 text-neon-violet"><Icon name="orbit" size={22} /></span>
                  <div>
                    <div className="font-display text-sm font-bold text-white">Attach a logic core</div>
                    <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">Wire a node graph that reshapes every win into a signature bonus multiplier. It is edge-neutral — pure drama, the house edge stays with the board.</p>
                  </div>
                  <button className="btn-primary !py-1.5 text-xs" onClick={attachLogic}><Icon name="spark" size={13} /> Attach logic core</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="label-eyebrow">Logic core · reshapes the win (edge-neutral)</span>
                    <button className="text-xs text-slate-500 hover:text-loss" onClick={detachLogic}>Remove</button>
                  </div>
                  <ForgeEditor graph={spec.logic} onChange={editLogic} />
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>Bonus spread: <b className="text-white">{stats.logicRange ? `${stats.logicRange[0]}× – ${stats.logicRange[1]}×` : '—'}</b></span>
                    <span>Avg: <b className="text-win">≈ 1.00×</b> (no extra edge)</span>
                    {logicSim && !logicSim.ok && <span className="text-loss">Graph needs a Payout + RNG</span>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="glass p-5">
            <span className="label-eyebrow">Math (exact · closed-form)</span>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="House edge" value={`${(stats.edge * 100).toFixed(2)}%`} color="#10f5a0" />
              <Stat label={stats.capped ? 'Top payout · cap' : 'Top payout'} value={`${stats.maxMult.toFixed(2)}×`} color={skin.gemGlow} />
              <Stat label="Safe tiles" value={`${stats.safe}`} />
              <Stat label="Logic core" value={stats.hasLogic ? 'On' : 'Off'} color={stats.hasLogic ? skin.gem : undefined} />
            </div>

            <div className="mt-4">
              <span className="label-eyebrow">Multiplier ladder</span>
              <div className="mt-2 flex items-end gap-0.5" style={{ height: 64 }}>
                {stats.ladder.map((rung) => {
                  const h = Math.max(4, (Math.log10(Math.max(1, rung.mult)) / Math.log10(Math.max(2, stats.maxMult))) * 100);
                  return <div key={rung.picks} className="flex-1 rounded-t" title={`${rung.picks} → ${rung.mult.toFixed(2)}×`} style={{ height: `${h}%`, background: `linear-gradient(180deg, ${skin.gemGlow}, ${skin.gem})`, opacity: 0.35 + 0.65 * (rung.picks / stats.ladder.length) }} />;
                })}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="label-eyebrow">Target edge %</span>
              <input type="range" min={1} max={5} step={0.5} value={target} onChange={(e) => setTarget(parseFloat(e.target.value))} className="mt-2 w-full accent-neon-violet" />
              <span className="font-mono text-xs text-slate-400">{target.toFixed(1)}%</span>
            </label>

            {stats.ok ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-win"><Icon name="check" size={13} /> Valid &amp; vault-safe</p>
            ) : (
              <ul className="mt-3 space-y-1 text-xs text-loss">{stats.errors.map((e, i) => (<li key={i} className="flex gap-1.5"><Icon name="warn" size={13} /> {e}</li>))}</ul>
            )}
          </div>

          <div className="glass space-y-3 p-5">
            <span className="label-eyebrow">Brand it</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="World name" className="w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-white outline-none focus:border-neon-violet/50" />
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" className="w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-white outline-none focus:border-neon-violet/50" />
            <div className="flex flex-wrap gap-1.5">
              {STUDIO_ICONS.map((ic) => (<button key={ic} onClick={() => setIcon(ic)} className={`grid h-8 w-8 place-items-center rounded-lg border ${icon === ic ? 'border-neon-violet text-white' : 'border-white/10 text-slate-500'}`}><Icon name={ic} size={15} /></button>))}
            </div>
            <div className="flex gap-2">{ACCENTS.map((a) => (<button key={a} onClick={() => setAccent(a)} className="h-7 w-7 rounded-full border-2" style={{ background: ACCENT_HEX[a], borderColor: accent === a ? '#fff' : 'transparent' }} />))}</div>
            <PickRow label="Sound" items={SOUND_PACKS} value={soundPack} onPick={(v) => { setSoundPack(v as SoundPackId); sfx.packWin(v, 3); }} />
            <PickRow label="Win effect" items={WIN_EFFECTS} value={winEffect} onPick={(v) => setWinEffect(v as WinEffectId)} />
          </div>

          <div className="glass p-5">
            {published ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-win">Published to the community</p>
                <Link href={`/play/ugc?id=${published.id}`} className="btn-primary mt-3 w-full">Play it now</Link>
                <Link href="/discover" className="btn-ghost mt-2 w-full text-xs">See it in Discover</Link>
              </div>
            ) : (
              <>
                <button onClick={publish} disabled={!canPublish} className="btn-primary w-full disabled:opacity-40">{connected ? 'Publish to community' : 'Connect wallet to publish'}</button>
                {stats.ok && name.trim().length < 3 && <p className="mt-2 text-center text-[0.68rem] text-slate-500">Give your world a name (3+ characters).</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: IconName; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
      <Icon name={icon} size={14} /> {label}
    </button>
  );
}

function Slider({ label, value, min, max, onChange, accent }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; accent?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between"><span className="label-eyebrow">{label}</span><span className="font-mono text-sm font-bold" style={{ color: accent || '#fff' }}>{value}</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="mt-2 w-full accent-neon-violet" style={accent ? { accentColor: accent } : undefined} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (<div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3"><div className="label-eyebrow">{label}</div><div className="font-mono text-lg font-bold" style={{ color: color || '#fff' }}>{value}</div></div>);
}

function PickRow({ label, items, value, onPick }: { label: string; items: readonly { id: string; label: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <span className="label-eyebrow">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{items.map((it) => (<button key={it.id} onClick={() => onPick(it.id)} className={`rounded-lg px-2.5 py-1 text-[0.68rem] font-semibold ${value === it.id ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400'}`}>{it.label}</button>))}</div>
    </div>
  );
}

function PickGrid({ label, items, value, onPick }: { label: string; items: { id: string; label: string; color: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <span className="label-eyebrow">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">{items.map((it) => (
        <button key={it.id} onClick={() => onPick(it.id)} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: value === it.id ? it.color : 'rgba(255,255,255,0.08)', color: value === it.id ? '#fff' : '#94a3b8', background: value === it.id ? `${it.color}1a` : 'transparent' }}>
          <span className="h-3 w-3 rounded" style={{ background: it.color }} /> {it.label}
        </button>
      ))}</div>
    </div>
  );
}

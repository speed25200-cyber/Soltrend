'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { ForgeEditor } from '@/components/forge/ForgeEditor';
import { GraphGame } from '@/components/games/GraphGame';
import { simulateGraph, normaliseEdge, starterGraph, FORGE_TEMPLATES, type ForgeGraph } from '@/lib/forge/model';
import { generateDistinct, noveltyScore, FEELINGS, type Feeling, type Candidate } from '@/lib/forge/generator';
import { describeWithAI, aiEnabled } from '@/lib/forge/aiCreate';
import { clampEdge } from '@/lib/games';
import { AURAS } from '@/lib/auras';
import {
  PRESENTATIONS,
  BACKGROUNDS,
  SOUND_PACKS,
  WIN_EFFECTS,
  STYLE_PRESETS,
  paletteFromSeed,
  type PresentationId,
  type BackgroundId,
  type SoundPackId,
  type WinEffectId,
} from '@/lib/presentation';
import { SceneStage } from '@/components/scenes/SceneStage';
import { SceneBackground } from '@/components/scenes/SceneBackground';
import { SpriteGlyph } from '@/components/create/SpriteGlyph';
import { listSprites, SYMBOLS_PER_GAME, type Sprite } from '@/lib/sprites';
import { ACCENT_HEX, type GameMeta } from '@/lib/catalog';
import { fmtMult, shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';

const accentHex = (a: string) => ACCENT_HEX[(a as keyof typeof ACCENT_HEX)] ?? '#a855f7';

export function NodeBuilder() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const publishUgc = useCasino((s) => s.publishUgc);
  const ugc = useCasino((s) => s.ugc);

  const [graph, setGraph] = useState<ForgeGraph>(() => starterGraph());
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState<IconName>('orbit');
  const [accent, setAccent] = useState('violet');
  const [aura, setAura] = useState('nebula');
  const [presentation, setPresentation] = useState<PresentationId>('orb');
  const [background, setBackground] = useState<BackgroundId>('aurora');
  const [soundPack, setSoundPack] = useState<SoundPackId>('arcade');
  const [winEffect, setWinEffect] = useState<WinEffectId>('confetti');
  const [previewRound, setPreviewRound] = useState(1);
  const [target, setTarget] = useState(2);

  // Custom pixel symbols (from the studio's Symbols editor) for slot presentations.
  const [library, setLibrary] = useState<Sprite[]>([]);
  const [symbolIds, setSymbolIds] = useState<string[]>([]);
  useEffect(() => setLibrary(listSprites()), []);
  const symbols = useMemo(
    () => symbolIds.map((id) => library.find((s) => s.id === id)).filter((s): s is Sprite => !!s),
    [symbolIds, library],
  );
  const toggleSymbol = (id: string) =>
    setSymbolIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= SYMBOLS_PER_GAME ? ids : [...ids, id],
    );
  // Reel (slot) and cards (scratch) presentations render creator-drawn symbols.
  const usesSymbols = presentation === 'reel' || presentation === 'cards';

  const applyPreset = (s: (typeof STYLE_PRESETS)[number]['style']) => {
    setPresentation(s.presentation);
    setBackground(s.background);
    setSoundPack(s.soundPack);
    setWinEffect(s.winEffect);
    setAccent(s.accent);
    setAura(s.aura);
    setPreviewRound((r) => r + 1);
    sfx.packWin(s.soundPack, 3);
  };

  const ADJ = ['Neon', 'Cosmic', 'Golden', 'Savage', 'Lucky', 'Turbo', 'Mystic', 'Frozen', 'Blazing', 'Quantum', 'Royal', 'Degen'];
  const NOUN = ['Overdrive', 'Rush', 'Vault', 'Strike', 'Bloom', 'Vortex', 'Bandit', 'Mirage', 'Surge', 'Oracle', 'Frenzy', 'Cascade'];
  const randomName = () => `${ADJ[(Math.random() * ADJ.length) | 0]} ${NOUN[(Math.random() * NOUN.length) | 0]}`;

  // "Surprise me" — a fully-formed, unique game in one tap: random mechanic +
  // auto-balanced edge + random style + name. Great on mobile.
  const surprise = () => {
    const pickable = FORGE_TEMPLATES.filter((t) => t.id !== 'blank');
    const g = pickable[(Math.random() * pickable.length) | 0].build();
    const pay = g.nodes.find((n) => n.kind === 'payout');
    const scale = normaliseEdge(g, 0.01 + Math.random() * 0.03);
    if (pay) pay.params.scale = scale;
    setGraph(g);
    applyPreset(STYLE_PRESETS[(Math.random() * STYLE_PRESETS.length) | 0].style);
    setName(randomName());
  };
  const [testing, setTesting] = useState(false);
  const [published, setPublished] = useState<{ id: string } | null>(null);
  const [remixParent, setRemixParent] = useState<string | null>(null);

  // Generator: pick a feeling → three structurally distinct, novel candidates.
  const [feeling, setFeeling] = useState<Feeling>('tense');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [generating, setGenerating] = useState(false);
  const generate = (f: Feeling) => {
    setFeeling(f);
    setGenerating(true);
    // let the button paint before the (sync) Monte-Carlo runs
    setTimeout(() => {
      setCandidates(generateDistinct(f, 3, []));
      setGenerating(false);
      sfx.click();
    }, 20);
  };
  // "Describe your game" — a transparent keyword mapper (offline, not an LLM):
  // text → feeling + style → a generated, playable draft in one tap.
  const [idea, setIdea] = useState('');
  const describeAndBuild = async () => {
    if (!idea.trim()) return;
    setGenerating(true);
    // A hosted model refines the inputs when configured; else the offline mapper.
    const hint = await describeWithAI(idea);
    setFeeling(hint.feeling);
    const cands = generateDistinct(hint.feeling, 3, []);
    setCandidates(cands);
    if (cands[0]) loadCandidate(cands[0]);
    if (hint.presentation) setPresentation(hint.presentation);
    setName(hint.name || idea.trim().slice(0, 28));
    setGenerating(false);
    sfx.packWin(soundPack, 3);
  };

  const loadCandidate = (c: Candidate) => {
    setGraph(c.graph);
    setName(randomName());
    applyPreset(STYLE_PRESETS[(Math.random() * STYLE_PRESETS.length) | 0].style);
    // Match the presentation to the mechanic so slots/scratch look the part.
    if (c.graph.nodes.some((n) => n.kind === 'reel')) setPresentation('reel');
    else if (c.graph.nodes.some((n) => n.kind === 'scratch')) setPresentation('cards');
    sfx.packWin(soundPack, 3);
  };

  // Visual remix — preload a published game's graph + look via ?remix=<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('remix');
    if (!id) return;
    const src = ugc.find((g) => g.id === id);
    if (!src || src.template !== 'graph' || !src.params.graph) return;
    try {
      setGraph(JSON.parse(String(src.params.graph)));
    } catch {
      return;
    }
    setRemixParent(src.id);
    setName(`${src.name} remix`);
    setTagline(src.theme.tagline || '');
    setIcon((src.theme.icon as IconName) || 'orbit');
    setAccent(src.theme.accent || 'violet');
    setAura(src.theme.aura || 'nebula');
    if (src.theme.presentation) setPresentation(src.theme.presentation as PresentationId);
    if (src.theme.background) setBackground(src.theme.background as BackgroundId);
    if (src.theme.soundPack) setSoundPack(src.theme.soundPack as SoundPackId);
    if (src.theme.winEffect) setWinEffect(src.theme.winEffect as WinEffectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    presentation,
    background,
    soundPack,
    winEffect,
    seedKey: name || 'forge-preview',
    symbols: usesSymbols && symbols.length >= 2 ? symbols : undefined,
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
      maxWin: Math.max(1, Math.round(sim.maxMult)),
      parentId: remixParent ?? undefined,
      params: { graph: JSON.stringify(graph) },
      theme: {
        accent,
        icon,
        aura,
        tagline: tagline.trim() || undefined,
        presentation,
        background,
        soundPack,
        winEffect,
        symbols: usesSymbols && symbols.length >= 2 ? symbols : undefined,
      },
    });
    sfx.jackpot();
    burstWin(12);
    setPublished({ id: game.id });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Wire RNG → transforms → payout to invent a brand-new mechanic, or generate one below. Validated vault-safe, provably fair.</p>
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

          {/* Generator — pick a feeling, get three distinct games */}
          <div className="glass space-y-3 p-4">
            <div>
              <span className="label-eyebrow">Describe your game {aiEnabled() && <span className="ml-1 text-neon-cyan">· AI</span>}</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && describeAndBuild()}
                  placeholder="e.g. a tense high-risk rocket game"
                  maxLength={60}
                  className="input-num !font-sans flex-1 text-sm"
                />
                <button className="btn-primary !py-1.5 text-xs" onClick={describeAndBuild} disabled={generating || !idea.trim()}>
                  <Icon name="spark" size={13} /> {generating ? 'Building…' : 'Build it'}
                </button>
              </div>
              <p className="mt-1 text-[0.62rem] text-slate-600">
                {aiEnabled()
                  ? 'A hosted model picks the feeling + style; the validated generator builds the game.'
                  : 'Keywords map to a feeling + style — try “chill slow slot” or “huge jackpot wheel”.'}
              </p>
            </div>
            <div className="h-px bg-white/[0.06]" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-eyebrow">Or pick a feeling</span>
              <span className="ml-auto text-[0.62rem] text-slate-600">distinct + novelty-scored</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FEELINGS.map((f) => (
                <button key={f.id} title={f.hint} onClick={() => generate(f.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${feeling === f.id ? 'bg-neon-violet/20 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                  {f.label}
                </button>
              ))}
              <button className="btn-primary ml-auto !py-1.5 text-xs" onClick={() => generate(feeling)} disabled={generating}>
                <Icon name="spark" size={13} /> {generating ? 'Generating…' : 'Generate 3'}
              </button>
            </div>
            {candidates.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3">
                {candidates.map((c, i) => {
                  const nov = noveltyScore(c.sim, candidates.filter((x) => x !== c).map((x) => x.sim));
                  return (
                    <button key={i} onClick={() => loadCandidate(c)} className="rounded-xl border border-white/[0.07] bg-void-950/50 p-3 text-left transition hover:border-neon-violet/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{c.archetype}</span>
                        <span className="rounded px-1.5 py-0.5 text-[0.58rem] font-bold" style={{ background: `${nov > 0.7 ? '#10f5a0' : '#a855f7'}22`, color: nov > 0.7 ? '#10f5a0' : '#a855f7' }}>{Math.round(nov * 100)}% new</span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[0.62rem] text-slate-400">
                        <span>edge {(c.edge * 100).toFixed(1)}%</span>
                        <span>hit {(c.sim.hitRate * 100).toFixed(0)}%</span>
                        <span>max {c.sim.maxMult.toFixed(1)}×</span>
                        <span>vol {c.sim.volatility.toFixed(1)}</span>
                      </div>
                      <div className="mt-2 text-[0.6rem] font-semibold text-neon-violet">Load →</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass flex flex-wrap items-center gap-2 p-3">
            <button className="btn-ghost !py-1.5 text-xs" onClick={surprise}>
              <Icon name="spark" size={13} /> Surprise me
            </button>
            <span className="label-eyebrow mx-1">or template</span>
            {FORGE_TEMPLATES.map((t) => (
              <button key={t.id} className="chip hover:border-neon-violet/50" title={t.hint} onClick={() => { setGraph(t.build()); if (t.id === 'slot') setPresentation('reel'); else if (t.id === 'scratch') setPresentation('cards'); sfx.click(); }}>
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
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Game name" maxLength={28} className="input-num !font-sans flex-1" />
                <button className="btn-ghost !px-3" title="Generate a name" onClick={() => setName(randomName())}>
                  <Icon name="spark" size={16} />
                </button>
              </div>
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

              <div>
                <span className="text-xs text-slate-500">Style presets · one-click look</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map((pr) => (
                    <button key={pr.id} onClick={() => applyPreset(pr.style)} className="chip hover:border-neon-violet/50">
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>

              <MiniChips label="Background" value={background} options={BACKGROUNDS} onPick={(v) => { setBackground(v as BackgroundId); setPreviewRound((r) => r + 1); }} />
              <MiniChips label="Sound pack" value={soundPack} options={SOUND_PACKS} onPick={(v) => { setSoundPack(v as SoundPackId); sfx.packWin(v, 3); }} />
              <MiniChips label="Win effect" value={winEffect} options={WIN_EFFECTS} onPick={(v) => setWinEffect(v as WinEffectId)} />

              <div>
                <span className="text-xs text-slate-500">Presentation · how the result reveals</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PRESENTATIONS.map((pr) => (
                    <button
                      key={pr.id}
                      title={pr.hint}
                      onClick={() => { setPresentation(pr.id); setPreviewRound((r) => r + 1); }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${presentation === pr.id ? 'bg-neon-violet/20 text-white ring-1 ring-neon-violet/50' : 'bg-void-900/60 text-slate-400 hover:text-white'}`}
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 rounded-xl border border-white/[0.06] bg-void-950/60 p-2">
                  <div className="relative h-36 overflow-hidden rounded-lg">
                    <SceneBackground background={background} palette={paletteFromSeed(name || 'forge-preview', accentHex(accent))} />
                    <div className="relative z-10 h-full">
                      <SceneStage compact presentation={presentation} mult={2.4} win rolling={false} palette={paletteFromSeed(name || 'forge-preview', accentHex(accent))} round={previewRound} symbols={meta.symbols} />
                    </div>
                  </div>
                  <button className="btn-ghost mt-1 w-full !py-1.5 text-xs" onClick={() => setPreviewRound((r) => r + 1)}>Replay preview</button>
                </div>
              </div>

              {usesSymbols && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Reel symbols · your own pixel art</span>
                    <span className="text-[10px] text-slate-600">{symbols.length}/{SYMBOLS_PER_GAME}</span>
                  </div>
                  {library.length === 0 ? (
                    <p className="mt-1.5 rounded-lg border border-white/[0.06] bg-void-950/50 p-2 text-xs text-slate-500">
                      No symbols yet — draw some in the <Link href="/studio?mode=art" className="text-neon-cyan hover:underline">Symbols</Link> editor, then pick them here. Default icons are used until you do.
                    </p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {library.map((s) => {
                        const on = symbolIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => { toggleSymbol(s.id); setPreviewRound((r) => r + 1); }}
                            title={s.name}
                            className={`rounded-lg border-2 p-1 transition ${on ? 'border-neon-violet bg-neon-violet/10' : 'border-white/10 bg-void-950/50 hover:border-white/25'}`}
                          >
                            <SpriteGlyph sprite={s} size={30} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {symbols.length === 1 && <p className="mt-1 text-[10px] text-gold">Pick at least 2 symbols to use custom art.</p>}
                </div>
              )}
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

function MiniChips({ label, value, options, onPick }: { label: string; value: string; options: { id: string; label: string }[]; onPick: (v: string) => void }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${value === o.id ? 'bg-neon-violet/20 text-white ring-1 ring-neon-violet/50' : 'bg-void-900/60 text-slate-400 hover:text-white'}`}
          >
            {o.label}
          </button>
        ))}
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

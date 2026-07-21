'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { BoardGame } from '@/components/games/BoardGame';
import {
  clampSpec, boardStats, cellCount, safeCount,
  BOARD_SKINS, BOARD_FX, BOARD_TEMPLATES, specToParams,
  type BoardSpec, type BoardSkin, type BoardFx,
} from '@/lib/forge/board';
import { BACKGROUNDS, SOUND_PACKS, WIN_EFFECTS, type BackgroundId, type SoundPackId, type WinEffectId } from '@/lib/presentation';
import { ACCENT_HEX, type GameMeta } from '@/lib/catalog';
import { shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';

const ACCENTS: GameMeta['accent'][] = ['violet', 'cyan', 'gold', 'pink', 'win'];

export default function ArcadePage() {
  const { publicKey, connected } = useWallet();
  const publishUgc = useCasino((s) => s.publishUgc);
  const ugc = useCasino((s) => s.ugc);

  const [spec, setSpecRaw] = useState<BoardSpec>(() => clampSpec(BOARD_TEMPLATES[0].spec));
  const setSpec = (patch: Partial<BoardSpec>) => setSpecRaw((s) => clampSpec({ ...s, ...patch }));
  const [target, setTarget] = useState(2);

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState<IconName>('gem');
  const [accent, setAccent] = useState<GameMeta['accent']>('cyan');
  const [background, setBackground] = useState<BackgroundId>('aurora');
  const [soundPack, setSoundPack] = useState<SoundPackId>('crystal');
  const [winEffect, setWinEffect] = useState<WinEffectId>('coins');
  const [testing, setTesting] = useState(false);
  const [published, setPublished] = useState<{ id: string } | null>(null);

  const skin = BOARD_SKINS[spec.skin];
  const stats = useMemo(() => boardStats(spec, target / 100), [spec, target]);

  const loadTemplate = (t: (typeof BOARD_TEMPLATES)[number]) => {
    setSpecRaw(clampSpec(t.spec));
    setTarget(Math.round(t.edge * 100));
    setIcon(BOARD_SKINS[t.spec.skin].icon);
    sfx.click();
  };

  const surprise = () => {
    const t = BOARD_TEMPLATES[(Math.random() * BOARD_TEMPLATES.length) | 0];
    const rows = 3 + ((Math.random() * 4) | 0);
    const cols = 3 + ((Math.random() * 4) | 0);
    const s = clampSpec({ rows, cols, bombs: Math.max(1, Math.round(rows * cols * (0.15 + Math.random() * 0.3))), skin: t.spec.skin, fx: BOARD_FX[(Math.random() * BOARD_FX.length) | 0].id });
    setSpecRaw(s);
    setTarget(2 + ((Math.random() * 2) | 0));
    setIcon(BOARD_SKINS[s.skin].icon);
    setName(`${ADJ[(Math.random() * ADJ.length) | 0]} ${NOUN[(Math.random() * NOUN.length) | 0]}`);
    setBackground(BACKGROUNDS[(Math.random() * BACKGROUNDS.length) | 0].id as BackgroundId);
    sfx.packWin(soundPack, 3);
  };

  // Remix a published board via ?remix=<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('remix');
    if (!id) return;
    const src = ugc.find((g) => g.id === id);
    if (!src || src.template !== 'board') return;
    setSpecRaw(clampSpec({ rows: Number(src.params.rows), cols: Number(src.params.cols), bombs: Number(src.params.bombs), skin: src.params.skin as BoardSkin, fx: src.params.fx as BoardFx }));
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
    slug: 'arcade-preview',
    name: name || 'Untitled board',
    icon,
    tagline: tagline || 'A hand-built Arcade board',
    template: 'board',
    tier: 2,
    accent,
    background,
    soundPack,
    winEffect,
    seedKey: name || 'arcade-preview',
  };

  const canPublish = stats.ok && connected && name.trim().length >= 3;
  const publish = () => {
    if (!canPublish) return;
    const game = publishUgc({
      name: name.trim(),
      template: 'board',
      creator: publicKey ? shortAddr(publicKey.toBase58()) : 'anon',
      edge: stats.edge,
      params: specToParams(spec),
      theme: { accent, icon, aura: 'nebula', tagline: tagline.trim() || undefined, background, soundPack, winEffect },
    });
    sfx.jackpot();
    burstWin(12);
    setPublished({ id: game.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead eyebrow="Arcade · Beta" title="Board game builder" sub="Design a playable space — a board of tiles players reveal, banking an escalating multiplier. Provably fair, vault-safe by construction." />
        <Link href="/forge" className="mb-4 text-sm text-slate-400 hover:text-white">Node Forge →</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Designer */}
        <div className="min-w-0 space-y-4">
          <div className="glass p-4">
            <BoardPreview spec={spec} />
            <p className="mt-3 text-center text-xs text-slate-500">Live preview · press <b className="text-slate-300">Play test</b> to try it with your balance.</p>
          </div>

          {/* templates */}
          <div className="glass flex flex-wrap items-center gap-2 p-3">
            <button className="btn-primary !py-1.5 text-xs" onClick={surprise}>
              <Icon name="spark" size={13} /> Surprise me
            </button>
            <span className="label-eyebrow mx-1">or template</span>
            {BOARD_TEMPLATES.map((t) => (
              <button key={t.id} className="chip hover:border-neon-violet/50" title={t.hint} onClick={() => loadTemplate(t)}>
                {t.label}
              </button>
            ))}
            <button className="btn-ghost ml-auto !py-1.5 text-xs" onClick={() => setTesting((v) => !v)}>{testing ? 'Hide test' : 'Play test'}</button>
          </div>

          {/* geometry controls */}
          <div className="glass space-y-4 p-4">
            <Slider label="Rows" value={spec.rows} min={3} max={6} onChange={(v) => setSpec({ rows: v })} />
            <Slider label="Columns" value={spec.cols} min={3} max={6} onChange={(v) => setSpec({ cols: v })} />
            <Slider label="Hazards" value={spec.bombs} min={1} max={cellCount(spec) - 1} onChange={(v) => setSpec({ bombs: v })} accent={skin.bomb} />

            <div>
              <span className="label-eyebrow">Skin</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.values(BOARD_SKINS).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSpec({ skin: s.id }); setIcon(s.icon); sfx.click(); }}
                    className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                    style={{ borderColor: spec.skin === s.id ? s.gem : 'rgba(255,255,255,0.08)', color: spec.skin === s.id ? '#fff' : '#94a3b8', background: spec.skin === s.id ? `${s.gem}1a` : 'transparent' }}
                  >
                    <span className="h-3 w-3 rounded" style={{ background: `linear-gradient(135deg, ${s.gem}, ${s.gemGlow})` }} /> {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label-eyebrow">Reveal effect</span>
              <div className="mt-2 flex gap-2">
                {BOARD_FX.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setSpec({ fx: f.id }); sfx.click(); }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${spec.fx === f.id ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {testing && (
            <div className="glass p-2">
              <p className="px-3 pb-2 pt-1 text-xs text-slate-500">Live demo of your current board — plays with your balance.</p>
              <BoardGame meta={meta} edge={stats.edge} params={specToParams(spec)} gameName={name || 'Preview'} />
            </div>
          )}
        </div>

        {/* Right: analysis + brand + publish */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="glass p-5">
            <span className="label-eyebrow">Math (exact · closed-form)</span>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="House edge" value={`${(stats.edge * 100).toFixed(2)}%`} color="#10f5a0" />
              <Stat label={stats.capped ? 'Top payout · cap' : 'Top payout'} value={`${stats.maxMult.toFixed(2)}×`} color={skin.gemGlow} />
              <Stat label="Safe tiles" value={`${stats.safe}`} />
              <Stat label="Clear-all odds" value={`${(stats.ladder.length ? stats.ladder[stats.ladder.length - 1].survive * 100 : 0).toFixed(2)}%`} />
            </div>

            {/* multiplier ladder */}
            <div className="mt-4">
              <span className="label-eyebrow">Multiplier ladder</span>
              <div className="mt-2 flex items-end gap-0.5" style={{ height: 72 }}>
                {stats.ladder.map((rung) => {
                  const h = Math.max(4, (Math.log10(Math.max(1, rung.mult)) / Math.log10(Math.max(2, stats.maxMult))) * 100);
                  return (
                    <div key={rung.picks} className="flex-1 rounded-t" title={`${rung.picks} safe → ${rung.mult.toFixed(2)}×`} style={{ height: `${h}%`, background: `linear-gradient(180deg, ${skin.gemGlow}, ${skin.gem})`, opacity: 0.35 + 0.65 * (rung.picks / stats.ladder.length) }} />
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[0.6rem] text-slate-600"><span>1 tile</span><span>{stats.safe} tiles</span></div>
            </div>

            <label className="mt-4 block">
              <span className="label-eyebrow">Target edge %</span>
              <input type="range" min={1} max={5} step={0.5} value={target} onChange={(e) => setTarget(parseFloat(e.target.value))} className="mt-2 w-full accent-neon-violet" />
              <span className="font-mono text-xs text-slate-400">{target.toFixed(1)}%</span>
            </label>

            {stats.ok ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-win"><Icon name="check" size={13} /> Valid &amp; vault-safe</p>
            ) : (
              <ul className="mt-3 space-y-1 text-xs text-loss">
                {stats.errors.map((e, i) => (<li key={i} className="flex gap-1.5"><Icon name="warn" size={13} /> {e}</li>))}
              </ul>
            )}
          </div>

          {/* brand */}
          <div className="glass space-y-3 p-5">
            <span className="label-eyebrow">Brand it</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Board name" className="w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-white outline-none focus:border-neon-violet/50" />
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" className="w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2 text-sm text-white outline-none focus:border-neon-violet/50" />

            <div className="flex flex-wrap gap-1.5">
              {STUDIO_ICONS.map((ic) => (
                <button key={ic} onClick={() => setIcon(ic)} className={`grid h-8 w-8 place-items-center rounded-lg border ${icon === ic ? 'border-neon-violet text-white' : 'border-white/10 text-slate-500'}`}><Icon name={ic} size={15} /></button>
              ))}
            </div>
            <div className="flex gap-2">
              {ACCENTS.map((a) => (
                <button key={a} onClick={() => setAccent(a)} className="h-7 w-7 rounded-full border-2" style={{ background: ACCENT_HEX[a], borderColor: accent === a ? '#fff' : 'transparent' }} />
              ))}
            </div>

            <PickRow label="Background" items={BACKGROUNDS} value={background} onPick={(v) => setBackground(v as BackgroundId)} />
            <PickRow label="Sound" items={SOUND_PACKS} value={soundPack} onPick={(v) => { setSoundPack(v as SoundPackId); sfx.packWin(v, 3); }} />
            <PickRow label="Win effect" items={WIN_EFFECTS} value={winEffect} onPick={(v) => setWinEffect(v as WinEffectId)} />
          </div>

          {/* publish */}
          <div className="glass p-5">
            {published ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-win">Published to the community</p>
                <Link href={`/play/ugc?id=${published.id}`} className="btn-primary mt-3 w-full">Play it now</Link>
                <Link href="/discover" className="btn-ghost mt-2 w-full text-xs">See it in Discover</Link>
              </div>
            ) : (
              <>
                <button onClick={publish} disabled={!canPublish} className="btn-primary w-full disabled:opacity-40">
                  {connected ? 'Publish to community' : 'Connect wallet to publish'}
                </button>
                {!stats.ok && <p className="mt-2 text-center text-[0.68rem] text-loss">Resolve the warnings above first.</p>}
                {stats.ok && name.trim().length < 3 && <p className="mt-2 text-center text-[0.68rem] text-slate-500">Give your board a name (3+ characters).</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ADJ = ['Neon', 'Cosmic', 'Golden', 'Savage', 'Lucky', 'Frozen', 'Blazing', 'Quantum', 'Royal', 'Mystic'];
const NOUN = ['Minefield', 'Vault', 'Grid', 'Cascade', 'Reef', 'Expanse', 'Labyrinth', 'Cavern', 'Bloom', 'Circuit'];

/** Non-interactive skin preview of the current board. */
function BoardPreview({ spec }: { spec: BoardSpec }) {
  const skin = BOARD_SKINS[spec.skin];
  const cell = 'clamp(30px, 9vw, 48px)';
  // deterministic sprinkle of "revealed" demo tiles for flavour
  const demoGem = new Set([2, spec.cols + 1, spec.rows * spec.cols - 3]);
  const demoBomb = new Set([spec.cols, spec.rows * spec.cols - 1]);
  return (
    <div className="grid place-items-center py-3">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${spec.cols}, ${cell})` }}>
        {Array.from({ length: cellCount(spec) }, (_, i) => {
          const gem = demoGem.has(i), bomb = demoBomb.has(i);
          return (
            <div
              key={i}
              className="grid place-items-center rounded-xl border"
              style={{
                width: cell, height: cell,
                borderColor: bomb ? `${skin.bomb}55` : gem ? `${skin.gem}55` : 'rgba(255,255,255,0.08)',
                background: gem ? `radial-gradient(circle, ${skin.gem}2e, ${skin.gem}0d)` : bomb ? `radial-gradient(circle, ${skin.bomb}26, ${skin.bomb}0a)` : `linear-gradient(160deg, ${skin.tile[0]}, ${skin.tile[1]})`,
                boxShadow: gem ? `0 0 16px -6px ${skin.gem}` : undefined,
              }}
            >
              {gem ? <span style={{ color: skin.gem }}><Icon name={skin.gemIcon} size={20} /></span> : bomb ? <span style={{ color: skin.bomb }}><Icon name={skin.bombIcon} size={20} /></span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange, accent }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; accent?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">{label}</span>
        <span className="font-mono text-sm font-bold" style={{ color: accent || '#fff' }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))} className="mt-2 w-full accent-neon-violet" style={accent ? { accentColor: accent } : undefined} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className="font-mono text-lg font-bold" style={{ color: color || '#fff' }}>{value}</div>
    </div>
  );
}

function PickRow({ label, items, value, onPick }: { label: string; items: readonly { id: string; label: string }[]; value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <span className="label-eyebrow">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button key={it.id} onClick={() => onPick(it.id)} className={`rounded-lg px-2.5 py-1 text-[0.68rem] font-semibold ${value === it.id ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400'}`}>{it.label}</button>
        ))}
      </div>
    </div>
  );
}

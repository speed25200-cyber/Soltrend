'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { GameScreen } from '@/components/games/GameScreen';
import { MineSymbol } from '@/components/games/goldmine/MineSymbol';
import { ACCENT_HEX, type GameMeta } from '@/lib/catalog';
import { clampEdge } from '@/lib/games';
import { shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import { useDraft } from '@/hooks/useDraft';
import { draftAge } from '@/lib/drafts';
import {
  SYMBOLS, SCATTER, MAX_WIN, VOLATILITY, EDGE_CHOICES, buildSlot, slotToParams, slotFromParams,
  type Volatility,
} from '@/lib/slots/goldmine';

const ACCENTS: GameMeta['accent'][] = ['gold', 'violet', 'cyan', 'pink', 'win'];

/**
 * The slot builder. Creators pick a *feel* — how often ore lands, how steep the
 * ladder climbs, how rare the express run is — and the payout scale is looked up
 * from a table verified offline at two million rounds per preset. That split is
 * deliberate: the fun dial is theirs, the house edge is a fixed set of audited
 * values, so no combination a creator can reach is able to ship a broken game.
 */
export function SlotBuilder() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const publishUgc = useCasino((s) => s.publishUgc);
  const updateUgc = useCasino((s) => s.updateUgc);
  const ugc = useCasino((s) => s.ugc);

  const [volatility, setVolatility] = useState<Volatility>('balanced');
  const [edgePct, setEdgePct] = useState(3);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState<IconName>('gem');
  const [accent, setAccent] = useState<GameMeta['accent']>('gold');
  const [published, setPublished] = useState<{ id: string } | null>(null);
  const [remixParent, setRemixParent] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const cfg = useMemo(() => buildSlot(volatility, edgePct / 100), [volatility, edgePct]);
  const stats = VOLATILITY[volatility].stats;

  // Remix (?remix=) or edit-in-place (?edit=) an existing slot.
  const [qParam] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()));
  useEffect(() => {
    const editParam = qParam.get('edit');
    const id = editParam || qParam.get('remix');
    if (!id) return;
    const src = ugc.find((g) => g.id === id);
    if (!src || src.template !== 'slots') return;
    const editing = !!editParam && !!src.mine;
    if (editing) setEditId(src.id);
    else setRemixParent(src.id);
    setName(editing ? src.name : `${src.name} remix`);
    setTagline(src.theme.tagline || '');
    setIcon((src.theme.icon as IconName) || 'gem');
    setAccent((src.theme.accent as GameMeta['accent']) || 'gold');
    if (typeof src.params.volatility === 'string') setVolatility(src.params.volatility as Volatility);
    if (src.edge) setEdgePct(Math.max(2, Math.min(4, Math.round(src.edge * 100))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftActive = !editId && !qParam.get('edit') && !qParam.get('remix');
  const draftSnap = useMemo(() => ({ volatility, edgePct, name, tagline, icon, accent }), [volatility, edgePct, name, tagline, icon, accent]);
  const draft = useDraft('slot', draftSnap, draftActive);
  const restoreDraft = () => {
    const d = draft.pending?.data as typeof draftSnap | undefined;
    if (!d) return;
    setVolatility(d.volatility);
    setEdgePct(d.edgePct);
    setName(d.name);
    setTagline(d.tagline);
    setIcon(d.icon);
    setAccent(d.accent);
    draft.dismiss();
    sfx.click();
  };

  const meta: GameMeta = {
    slug: 'slot-preview',
    name: name || 'Untitled slot',
    icon,
    tagline: tagline || 'A cascading ore slot',
    template: 'slots',
    tier: 2,
    accent,
    seedKey: name || 'slot-preview',
  };

  const canPublish = connected && name.trim().length >= 3;
  const publish = () => {
    if (!canPublish) return;
    const shared = {
      name: name.trim(),
      edge: clampEdge(edgePct / 100),
      maxWin: MAX_WIN,
      params: { ...slotToParams(cfg), volatility },
      theme: { accent, icon, aura: 'nebula', tagline: tagline.trim() || undefined },
    };
    if (editId) {
      updateUgc(editId, shared);
      sfx.jackpot();
      setPublished({ id: editId });
      return;
    }
    const game = publishUgc({
      ...shared,
      template: 'slots',
      creator: publicKey ? shortAddr(publicKey.toBase58()) : 'anon',
      creatorWallet: publicKey?.toBase58(),
      parentId: remixParent ?? undefined,
    });
    draft.clear();
    sfx.jackpot();
    burstWin(12);
    setPublished({ id: game.id });
  };

  return (
    <div className="space-y-4">
      {editId && (
        <div className="flex items-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-2 text-xs text-neon-cyan">
          <Icon name="pencil" size={13} /> Editing a published slot — changes go live when you save.
        </div>
      )}
      {draft.pending && draftActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neon-violet/30 bg-neon-violet/10 px-3 py-2 text-xs text-slate-200">
          <Icon name="spark" size={13} className="text-neon-violet" />
          <span>You have an unsaved slot draft from {draftAge(draft.pending.savedAt, Date.now())}.</span>
          <button onClick={restoreDraft} className="btn-ghost !py-1 text-xs">Restore</button>
          <button onClick={draft.clear} className="text-slate-500 hover:text-loss">Discard</button>
        </div>
      )}

      <p className="text-sm text-slate-400">
        Pick how the seam behaves and how it looks — the paytable is solved for you from audited numbers,
        so your slot is vault-safe whatever you choose. Play-test it live below.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="glass min-w-0 overflow-hidden p-2">
          <GameScreen config={{ meta, edge: edgePct / 100, gameName: name || 'Preview', params: { ...slotToParams(cfg), volatility } }} />
        </div>

        <div className="space-y-4">
          <div className="glass space-y-3 p-4">
            <div>
              <span className="label-eyebrow">How the seam behaves</span>
              <div className="mt-1.5 space-y-1.5">
                {(Object.keys(VOLATILITY) as Volatility[]).map((v) => {
                  const preset = VOLATILITY[v];
                  return (
                    <button
                      key={v}
                      onClick={() => { setVolatility(v); sfx.click(); }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                        volatility === v ? 'bg-gold/15 text-white ring-1 ring-gold/50' : 'bg-void-900/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{preset.label}</span>
                        <span className="block text-[0.62rem] text-slate-500">{preset.hint}</span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-[0.6rem] text-slate-500">
                        {(preset.stats.hitRate * 100).toFixed(0)}% hit<br />1/{Math.round(1 / preset.stats.bonusRate)} bonus
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="label-eyebrow">House edge</span>
                <span className="font-mono text-sm font-bold text-white">{edgePct}%</span>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {EDGE_CHOICES.map((e) => (
                  <button
                    key={e}
                    onClick={() => { setEdgePct(Math.round(e * 100)); sfx.click(); }}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                      edgePct === Math.round(e * 100) ? 'bg-neon-violet/20 text-white ring-1 ring-neon-violet/50' : 'bg-void-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    {(e * 100).toFixed(0)}%
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[0.6rem] text-slate-600">
                The stakers&apos; cut. Each value is pre-audited over two million rounds.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Readout label="RTP" value={`${((1 - edgePct / 100) * 100).toFixed(0)}%`} />
              <Readout label="Hit rate" value={`${(stats.hitRate * 100).toFixed(0)}%`} />
              <Readout label="Top win" value={`${MAX_WIN}x`} />
            </div>
          </div>

          <div className="glass space-y-3 p-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Slot name" maxLength={28} className="input-num !font-sans w-full text-sm" />
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" maxLength={44} className="input-num !font-sans w-full text-sm" />
            <div>
              <span className="label-eyebrow">Icon</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STUDIO_ICONS.map((ic) => (
                  <button key={ic} onClick={() => setIcon(ic)} className={`grid h-9 w-9 place-items-center rounded-lg border transition ${icon === ic ? 'border-gold bg-gold/15 text-white' : 'border-white/10 bg-void-900/60 text-slate-400 hover:text-white'}`}>
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label-eyebrow">Accent</span>
              <div className="mt-1.5 flex gap-1.5">
                {ACCENTS.map((a) => (
                  <button key={a} onClick={() => setAccent(a)} style={{ background: ACCENT_HEX[a] }} className={`h-8 w-8 rounded-lg border-2 ${accent === a ? 'border-white' : 'border-white/10'}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="glass p-4">
            <span className="label-eyebrow">Your paytable</span>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {SYMBOLS.filter((s) => s.id !== SCATTER).slice().reverse().map((s) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <MineSymbol sym={s.id} size={20} />
                  <span className="font-mono text-[0.6rem] text-slate-400">
                    {(cfg.pays[s.id][0] * cfg.payScale).toFixed(1)} / {(cfg.pays[s.id][2] * cfg.payScale).toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {published ? (
            <div className="glass grid place-items-center gap-2 p-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-win/15 text-win"><Icon name="check" size={26} /></span>
              <div className="font-display font-bold text-white">{editId ? 'Changes saved!' : 'Slot published!'}</div>
              <button className="btn-primary mt-1" onClick={() => router.push(`/play/ugc?id=${published.id}`)}>Play it →</button>
            </div>
          ) : (
            <button className="btn-primary w-full" disabled={!canPublish} onClick={publish}>
              {!connected ? 'Connect wallet to publish' : name.trim().length < 3 ? 'Name your slot' : editId ? 'Save changes' : 'Publish slot'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-2.5 text-center">
      <div className="label-eyebrow">{label}</div>
      <div className="font-mono text-sm font-bold text-white">{value}</div>
    </div>
  );
}

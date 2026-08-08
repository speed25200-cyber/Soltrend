'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { GameScreen } from '@/components/games/GameScreen';
import { DemoBar } from '@/components/games/DemoBar';
import { towersMultiplier, clampEdge, DEFAULT_EDGE } from '@/lib/games';
import { ACCENT_HEX, type GameMeta } from '@/lib/catalog';
import { shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import { useDraft } from '@/hooks/useDraft';
import { draftAge } from '@/lib/drafts';

const DIFFS = [
  { id: 'easy', label: 'Easy', cols: 4, blurb: '4 tiles a row — gentle climb' },
  { id: 'medium', label: 'Medium', cols: 3, blurb: '3 tiles a row — balanced' },
  { id: 'hard', label: 'Hard', cols: 2, blurb: '2 tiles a row — steep payouts' },
] as const;
type DiffId = (typeof DIFFS)[number]['id'];

const ACCENTS: GameMeta['accent'][] = ['violet', 'cyan', 'gold', 'pink', 'win', 'loss'];
const ROWS = 8;

/**
 * Classic builder — publish a themed Towers game. The dungeon-climb mechanic is
 * a first-class Original; here creators reskin and retune it (difficulty, icon,
 * colour, name) and ship it as their own community game.
 */
export function ClassicsBuilder() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const publishUgc = useCasino((s) => s.publishUgc);
  const updateUgc = useCasino((s) => s.updateUgc);
  const ugc = useCasino((s) => s.ugc);

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState<IconName>('target');
  const [accent, setAccent] = useState<GameMeta['accent']>('cyan');
  const [difficulty, setDifficulty] = useState<DiffId>('medium');
  const [edgePct, setEdgePct] = useState(Math.round(DEFAULT_EDGE * 100)); // house edge %
  const [published, setPublished] = useState<{ id: string } | null>(null);
  const [remixParent, setRemixParent] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const cols = DIFFS.find((d) => d.id === difficulty)!.cols;
  const edge = clampEdge(edgePct / 100);
  const maxWin = towersMultiplier(cols, ROWS, edge);

  // Remix (?remix=, fork) or edit-in-place (?edit=) an existing Towers game.
  const [qParam] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()));
  useEffect(() => {
    const editParam = qParam.get('edit');
    const id = editParam || qParam.get('remix');
    if (!id) return;
    const src = ugc.find((g) => g.id === id);
    if (!src || src.template !== 'towers') return;
    const editing = !!editParam && !!src.mine;
    if (editing) setEditId(src.id);
    else setRemixParent(src.id);
    setName(editing ? src.name : `${src.name} remix`);
    setTagline(src.theme.tagline || '');
    setIcon((src.theme.icon as IconName) || 'target');
    setAccent((src.theme.accent as GameMeta['accent']) || 'cyan');
    if (typeof src.params.difficulty === 'string') setDifficulty(src.params.difficulty as DiffId);
    if (src.edge) setEdgePct(Math.max(1, Math.min(5, Math.round(src.edge * 100))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftActive = !editId && !qParam.get('edit') && !qParam.get('remix');
  const draftSnap = useMemo(
    () => ({ name, tagline, icon, accent, difficulty, edgePct }),
    [name, tagline, icon, accent, difficulty, edgePct],
  );
  const draft = useDraft('classic', draftSnap, draftActive);
  const restoreDraft = () => {
    const d = draft.pending?.data as typeof draftSnap | undefined;
    if (!d) return;
    setName(d.name);
    setTagline(d.tagline);
    setIcon(d.icon);
    setAccent(d.accent);
    setDifficulty(d.difficulty);
    setEdgePct(d.edgePct);
    draft.dismiss();
    sfx.click();
  };

  const meta: GameMeta = {
    slug: 'towers-preview',
    name: name || 'Untitled Towers',
    icon,
    tagline: tagline || 'Climb the tower, dodge the traps',
    template: 'towers',
    tier: 2,
    accent,
    seedKey: name || 'towers-preview',
  };

  const canPublish = connected && name.trim().length >= 3;
  const publish = () => {
    if (!canPublish) return;
    const shared = {
      name: name.trim(),
      edge: clampEdge(edge),
      maxWin: Math.max(1, Math.round(maxWin)),
      params: { difficulty },
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
      template: 'towers',
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
          <Icon name="pencil" size={13} /> Editing a published game — changes go live when you save.
        </div>
      )}
      {draft.pending && draftActive && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neon-violet/30 bg-neon-violet/10 px-3 py-2 text-xs text-slate-200">
          <Icon name="spark" size={13} className="text-neon-violet" />
          <span>You have an unsaved draft from {draftAge(draft.pending.savedAt, Date.now())}.</span>
          <button onClick={restoreDraft} className="btn-ghost !py-1 text-xs">Restore</button>
          <button onClick={draft.clear} className="text-slate-500 hover:text-loss">Discard</button>
        </div>
      )}
      <p className="text-sm text-slate-400">Reskin the Towers dungeon-climb into your own game — pick a difficulty, tune the edge and a look, play-test it live, publish. Provably fair, vault-safe.</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="glass min-w-0 space-y-2 overflow-hidden p-2">
          <DemoBar theoreticalRtp={1 - edge} />
          <GameScreen config={{ meta, edge, gameName: name || 'Preview', demo: true }} />
        </div>

        <div className="space-y-4">
          <div className="glass space-y-3 p-4">
            <div>
              <span className="label-eyebrow">Difficulty</span>
              <div className="mt-1.5 space-y-1.5">
                {DIFFS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      difficulty === d.id ? 'bg-neon-violet/20 text-white ring-1 ring-neon-violet/50' : 'bg-void-900/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="font-semibold">{d.label}</span>
                    <span className="text-xs text-slate-500">{d.blurb}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Top multiplier ~{maxWin.toFixed(1)}x · edge {(edge * 100).toFixed(0)}%</p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="label-eyebrow">House edge</span>
                <span className="font-mono text-sm font-bold text-white">{edgePct}%</span>
              </div>
              <input type="range" min={1} max={5} value={edgePct} onChange={(e) => setEdgePct(parseInt(e.target.value))} className="mt-1.5 w-full accent-neon-violet" />
              <p className="mt-1 text-[0.62rem] text-slate-600">The stakers&apos; cut. Lower = more player-friendly; 1–5%.</p>
            </div>

            <div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Game name" maxLength={28} className="input-num !font-sans w-full text-sm" />
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" maxLength={44} className="input-num !font-sans mt-2 w-full text-sm" />
            </div>

            <div>
              <span className="label-eyebrow">Icon</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STUDIO_ICONS.map((ic) => (
                  <button
                    key={ic}
                    aria-label={`Icon: ${ic}`}
                    aria-pressed={icon === ic}
                    onClick={() => setIcon(ic)}
                    className={`grid h-9 w-9 place-items-center rounded-lg border transition ${icon === ic ? 'border-neon-violet bg-neon-violet/15 text-white' : 'border-white/10 bg-void-900/60 text-slate-400 hover:text-white'}`}
                  >
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label-eyebrow">Accent</span>
              <div className="mt-1.5 flex gap-1.5">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    aria-label={`Accent colour: ${a}`}
                    aria-pressed={accent === a}
                    onClick={() => setAccent(a)}
                    style={{ background: ACCENT_HEX[a] }}
                    className={`h-8 w-8 rounded-lg border-2 ${accent === a ? 'border-white' : 'border-white/10'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {published ? (
            <div className="glass grid place-items-center gap-2 p-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-win/15 text-win"><Icon name="check" size={26} /></span>
              <div className="font-display font-bold text-white">{editId ? 'Changes saved!' : 'Published!'}</div>
              <button className="btn-primary mt-1" onClick={() => router.push(`/play/ugc?id=${published.id}`)}>Play it →</button>
            </div>
          ) : (
            <button className="btn-primary w-full" disabled={!canPublish} onClick={publish}>
              {!connected ? 'Connect wallet to publish' : name.trim().length < 3 ? 'Name your game' : editId ? 'Save changes' : 'Publish Towers game'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { Icon, STUDIO_ICONS, type IconName } from '@/components/Icon';
import { GameScreen } from '@/components/games/GameScreen';
import { towersMultiplier, clampEdge, DEFAULT_EDGE } from '@/lib/games';
import { ACCENT_HEX, type GameMeta } from '@/lib/catalog';
import { shortAddr } from '@/lib/format';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';

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

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [icon, setIcon] = useState<IconName>('target');
  const [accent, setAccent] = useState<GameMeta['accent']>('cyan');
  const [difficulty, setDifficulty] = useState<DiffId>('medium');
  const [published, setPublished] = useState<{ id: string } | null>(null);

  const cols = DIFFS.find((d) => d.id === difficulty)!.cols;
  const edge = DEFAULT_EDGE;
  const maxWin = towersMultiplier(cols, ROWS, edge);

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
    const game = publishUgc({
      name: name.trim(),
      template: 'towers',
      creator: publicKey ? shortAddr(publicKey.toBase58()) : 'anon',
      edge: clampEdge(edge),
      maxWin: Math.max(1, Math.round(maxWin)),
      params: { difficulty },
      theme: { accent, icon, aura: 'nebula', tagline: tagline.trim() || undefined },
    });
    sfx.jackpot();
    burstWin(12);
    setPublished({ id: game.id });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Reskin the Towers dungeon-climb into your own game — pick a difficulty and a look, play-test it live, publish. Provably fair, vault-safe.</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="glass min-w-0 overflow-hidden p-2">
          <GameScreen config={{ meta, edge, gameName: name || 'Preview' }} />
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
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Game name" maxLength={28} className="input-num !font-sans w-full text-sm" />
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" maxLength={44} className="input-num !font-sans mt-2 w-full text-sm" />
            </div>

            <div>
              <span className="label-eyebrow">Icon</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {STUDIO_ICONS.map((ic) => (
                  <button
                    key={ic}
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
              <div className="font-display font-bold text-white">Published!</div>
              <button className="btn-primary mt-1" onClick={() => router.push(`/play/ugc?id=${published.id}`)}>Play it →</button>
            </div>
          ) : (
            <button className="btn-primary w-full" disabled={!canPublish} onClick={publish}>
              {!connected ? 'Connect wallet to publish' : name.trim().length < 3 ? 'Name your game' : 'Publish Towers game'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

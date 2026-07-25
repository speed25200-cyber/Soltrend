'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { useCasino } from '@/lib/store';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import { floatStream } from '@/lib/provably-fair';
import {
  dailyPuzzle, dayKey, msUntilNextDay, shareCard, type DailyResult,
} from '@/lib/daily';
import {
  exitsFrom, findRoom, isTrap, keysAfter, nexusMultiplier, nexusRolls, roomGain, KEY_HEX,
} from '@/lib/forge/nexus';

const Nexus3D = dynamic(() => import('@/components/worlds/Nexus3D'), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[340px] place-items-center text-sm text-slate-500">Mapping today&apos;s Nexus…</div>,
});

const EDGE = 0.02;
type Phase = 'idle' | 'playing' | 'busted' | 'cashed';

/**
 * The Daily Nexus — the same map for everyone on earth, one free run a day.
 * Free by design: it is the habit and the thing people paste to each other, not
 * a wager. The map is public; the rolls come from the player's own fair seed
 * chain, so studying today's topology in advance tells you nothing about your luck.
 */
export default function DailyPage() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  if (now === null) {
    return <div className="glass grid place-items-center p-16 text-sm text-slate-500">Loading today&apos;s Nexus…</div>;
  }
  return <DailyInner now={now} />;
}

function DailyInner({ now }: { now: number }) {
  const puzzle = useMemo(() => dailyPuzzle(now, EDGE), [now]);
  const key = dayKey(now);

  const nextNonce = useCasino((s) => s.nextNonce);
  const runs = useCasino((s) => s.dailyRuns);
  const streak = useCasino((s) => s.dailyStreak);
  const recordDailyRun = useCasino((s) => s.recordDailyRun);
  const done = runs[key];

  const spec = puzzle.spec;
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentId, setCurrentId] = useState(spec.startId);
  const [cleared, setCleared] = useState<string[]>([]);
  const [hitId, setHitId] = useState<string | null>(null);
  const [rolls, setRolls] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const settledRef = useRef(false);

  const held = useMemo(() => keysAfter(spec, [spec.startId, ...cleared]), [spec, cleared]);
  const options = phase === 'playing' ? exitsFrom(spec, currentId, held) : [];
  const curMult = nexusMultiplier(spec, cleared, EDGE);
  const heat = Math.min(1, Math.log10(Math.max(1, curMult)) / 2);
  // "Par" — the deepest route anyone could walk today, for the ratio on the card.
  const par = useMemo(() => Math.max(1, spec.rooms.length - 1), [spec]);

  const start = () => {
    // Rolls come from the player's own fair chain — the map is shared, luck isn't.
    const seeds = nextNonce();
    const stream = floatStream(seeds.serverSeed, `${seeds.clientSeed}:daily:${key}`, seeds.nonce);
    const r: Record<string, number> = {};
    for (const room of [...spec.rooms].sort((a, b) => a.id.localeCompare(b.id))) r[room.id] = stream.next();
    setRolls(r);
    setCurrentId(spec.startId);
    setCleared([]);
    setHitId(null);
    settledRef.current = false;
    setPhase('playing');
    sfx.click();
  };

  const finish = (path: string[], banked: boolean, hit: string | null) => {
    if (settledRef.current) return;
    settledRef.current = true;
    const m = banked ? nexusMultiplier(spec, path, EDGE) : 0;
    setPhase(banked ? 'cashed' : 'busted');
    setHitId(hit);
    recordDailyRun(key, {
      rooms: path.length,
      total: par,
      multiplier: m,
      banked,
      keysFound: keysAfter(spec, [spec.startId, ...path]).size,
      ts: Date.now(),
    });
    if (banked) {
      sfx.win(m);
      burstWin(m);
    } else {
      sfx.loss();
    }
  };

  const enter = (id: string) => {
    if (phase !== 'playing') return;
    const room = findRoom(spec, id);
    if (!room || !exitsFrom(spec, currentId, held).some((r) => r.id === id)) return;
    if (isTrap(room, rolls)) {
      finish(cleared, false, id);
      return;
    }
    const path = [...cleared, id];
    setCleared(path);
    setCurrentId(id);
    sfx.tick(path.length);
    if (exitsFrom(spec, id, keysAfter(spec, [spec.startId, ...path])).length === 0) finish(path, true, null);
  };

  const result: DailyResult | null = done
    ? { rooms: done.rooms, total: done.total, multiplier: done.multiplier, banked: done.banked, keysFound: done.keysFound }
    : null;

  const copyShare = async () => {
    if (!result) return;
    const text = shareCard(puzzle, result, streak);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copy your result', text);
    }
  };

  const reveal = phase === 'busted' || phase === 'cashed';
  const hours = Math.floor(msUntilNextDay(now) / 3_600_000);
  const mins = Math.floor((msUntilNextDay(now) % 3_600_000) / 60_000);

  return (
    <div className="space-y-6">
      <SectionHead
        eyebrow="Play · Daily"
        title={`Daily Nexus #${puzzle.number}`}
        sub="One map. Everyone on earth. One free run a day — no stake, just the route you choose and how far you dare push it."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="glass relative min-h-[380px] overflow-hidden rounded-2xl p-0">
          <Nexus3D
            spec={spec}
            environment="void"
            skin="vault"
            currentId={currentId}
            cleared={cleared}
            hitId={hitId}
            reveal={reveal}
            playing={phase === 'playing'}
            onEnter={enter}
            heat={heat}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <div className="rounded-xl border border-white/10 bg-void-950/70 px-3 py-2 backdrop-blur">
              <div className="font-mono text-2xl font-black" style={{ color: phase === 'busted' ? '#ff3b6b' : '#ffd25f' }}>
                {phase === 'busted' ? 'LOST' : `${curMult.toFixed(2)}×`}
              </div>
              <div className="text-[0.62rem] uppercase tracking-[0.25em] text-slate-400">
                {cleared.length}/{par} rooms
              </div>
              {held.size > 0 && (
                <div className="mt-1 flex gap-1">
                  {[...held].map((k) => (
                    <span key={k} className="rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase" style={{ background: `${KEY_HEX[k]}22`, color: KEY_HEX[k] }}>{k}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-void-950/70 px-3 py-2 text-right backdrop-blur">
              <div className="font-mono text-lg font-bold text-white">{streak}</div>
              <div className="text-[0.62rem] uppercase tracking-[0.2em] text-slate-400">day streak</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {done ? (
            <div className="glass space-y-3 p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/15 text-gold"><Icon name="check" size={18} /></span>
                <div>
                  <div className="font-display font-bold text-white">Today&apos;s run is in</div>
                  <div className="text-xs text-slate-500">Next Nexus in {hours}h {mins}m</div>
                </div>
              </div>

              {/* The artifact — plain text, ready to paste anywhere. */}
              <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-void-950/70 p-3 font-mono text-[0.72rem] leading-relaxed text-slate-200">
{shareCard(puzzle, result!, streak)}
              </pre>
              <button onClick={copyShare} className="btn-primary w-full">
                {copied ? 'Copied — go paste it' : 'Copy result'}
              </button>
              <p className="text-center text-[0.62rem] text-slate-600">
                Everyone played this exact map today. Compare routes, not luck.
              </p>
            </div>
          ) : phase === 'playing' ? (
            <div className="glass space-y-3 p-5">
              <span className="label-eyebrow">Choose your route</span>
              {options.map((room) => (
                <button
                  key={room.id}
                  onClick={() => enter(room.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-void-900/60 px-3 py-2 text-sm transition hover:border-neon-violet/50 hover:bg-void-700/50"
                >
                  <span className="flex items-center gap-1.5 font-semibold text-white">
                    {room.label || 'Room'}
                    {room.key && (
                      <span className="rounded px-1 py-0.5 text-[0.55rem] font-bold uppercase" style={{ background: `${KEY_HEX[room.key]}22`, color: KEY_HEX[room.key] }}>
                        {room.key} key
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-gold">×{roomGain(room).toFixed(2)}</span>
                    <span className="text-slate-500">{((1 - room.risk) * 100).toFixed(0)}% safe</span>
                  </span>
                </button>
              ))}
              {/* Sealed routes stay visible so the detour decision is legible. */}
              {exitsFrom(spec, currentId).filter((r) => !options.some((o) => o.id === r.id)).map((room) => {
                const need = spec.gates?.[`${currentId}>${room.id}`];
                return (
                  <div key={room.id} className="flex w-full items-center justify-between rounded-lg border border-white/[0.05] bg-void-950/50 px-3 py-2 text-sm opacity-60">
                    <span className="text-slate-400">{room.label || 'Room'}</span>
                    <span className="font-mono text-[0.68rem]" style={{ color: need ? KEY_HEX[need] : '#64748b' }}>needs {need} key</span>
                  </div>
                );
              })}
              <button
                onClick={() => finish(cleared, true, null)}
                disabled={cleared.length === 0}
                className="btn-primary btn-win w-full disabled:opacity-40"
              >
                {cleared.length === 0 ? 'Step into a room' : `Bank ${curMult.toFixed(2)}×`}
              </button>
            </div>
          ) : (
            <div className="glass space-y-3 p-5 text-center">
              <div className="font-display text-lg font-bold text-white">Today&apos;s map is live</div>
              <p className="text-sm text-slate-400">
                {spec.rooms.length} rooms, best route pays {puzzle.maxMult.toFixed(2)}×. One run, free — bank early or push deep.
              </p>
              <button onClick={start} className="btn-primary w-full">Take today&apos;s run</button>
              {streak > 0 && <p className="text-xs text-slate-500">{streak} day streak on the line</p>}
            </div>
          )}

          <div className="glass p-4 text-xs leading-relaxed text-slate-500">
            <b className="text-slate-300">Same map, your own luck.</b> The layout is derived from today&apos;s date so
            everyone sees it, but each room&apos;s trap is rolled from your personal provably-fair seed chain —
            studying the map early tells you nothing about your rolls. <Link href="/verify" className="text-neon-violet">Verify any run</Link>.
          </div>

          <Link href="/discover" className="btn-ghost w-full !py-2 text-xs">Want stakes? Play the community games</Link>
        </div>
      </div>
    </div>
  );
}

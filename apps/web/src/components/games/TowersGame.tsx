'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GameLayout } from '@/components/GameLayout';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import { usePlay } from '@/hooks/usePlay';
import { useCasino } from '@/lib/store';
import { towersLayout, towersMultiplier, DEFAULT_EDGE, round2 } from '@/lib/games';
import { fmtMult } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { sfx } from '@/lib/sound';
import { burstWin } from '@/lib/fx';
import type { GameConfig } from './types';

type Phase = 'idle' | 'playing' | 'busted' | 'cashed';

/** Difficulty presets — fewer columns = fewer safe tiles = steeper climb. */
const DIFF = [
  { id: 'easy', label: 'Easy', cols: 4 },
  { id: 'medium', label: 'Medium', cols: 3 },
  { id: 'hard', label: 'Hard', cols: 2 },
] as const;
type DiffId = (typeof DIFF)[number]['id'];

const ROWS = 8;

/**
 * Towers — the interactive dungeon-climb. Each row hides one trap; pick a safe
 * tile to climb higher (and multiply), or bank your winnings before you fall.
 * Provably fair: the whole tower is fixed by the reserved seed at start.
 */
export function TowersGame({ meta, edge = DEFAULT_EDGE, gameId, gameName, params, maxBet }: GameConfig) {
  const { guard: rawGuard, reserveSeeds, settle } = usePlay();
  const guard = (b: number) => (maxBet != null && b > maxBet ? { ok: false, reason: `Max bet ◎${maxBet} — this game's bankroll cap` } : rawGuard(b));
  const bumpUgc = useCasino((s) => s.bumpUgc);

  const [bet, setBet] = useState(0.1);
  const [diff, setDiff] = useState<DiffId>((params?.difficulty as DiffId) ?? 'medium');
  const cols = DIFF.find((d) => d.id === diff)!.cols;

  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(0); // rows cleared so far
  const [traps, setTraps] = useState<number[]>([]); // trap column per row
  const [picks, setPicks] = useState<number[]>([]); // chosen column per cleared row
  const [seeds, setSeeds] = useState<ReturnType<typeof reserveSeeds> | null>(null);
  const settledRef = useRef(false);

  const curMult = towersMultiplier(cols, level, edge);
  const nextMult = towersMultiplier(cols, level + 1, edge);
  const g = guard(bet);

  const start = () => {
    const s = reserveSeeds();
    setSeeds(s);
    setTraps(towersLayout(ROWS, cols, s));
    setLevel(0);
    setPicks([]);
    settledRef.current = false;
    setPhase('playing');
  };

  const finish = (won: boolean, m: number, clearedLevel: number, hitCol: number) => {
    if (settledRef.current) return;
    settledRef.current = true;
    setPhase(won ? 'cashed' : 'busted');
    settle({
      game: gameName ?? meta.name,
      template: 'towers',
      bet,
      multiplier: won ? m : 0,
      payout: won ? round2(bet * m) : 0,
      win: won,
      meta: { difficulty: diff, level: clearedLevel, hit: hitCol },
      seeds: seeds!,
    });
    if (gameId) bumpUgc(gameId, bet);
    if (won) {
      sfx.win(m);
      burstWin(m);
    } else {
      sfx.loss();
    }
    setTimeout(() => setPhase((p) => (p === 'busted' || p === 'cashed' ? 'idle' : p)), 2200);
  };

  const pick = (row: number, col: number) => {
    if (phase !== 'playing' || row !== level || !seeds) return;
    if (traps[row] === col) {
      setPicks((p) => [...p, col]);
      finish(false, 0, level, col);
      return;
    }
    const nextLevel = level + 1;
    setPicks((p) => [...p, col]);
    setLevel(nextLevel);
    sfx.click();
    // Reached the top — auto-bank the full climb.
    if (nextLevel === ROWS) finish(true, towersMultiplier(cols, ROWS, edge), ROWS, -1);
  };

  const cashOut = () => {
    if (phase !== 'playing' || level === 0) return;
    finish(true, curMult, level, -1);
  };

  const revealTraps = phase === 'busted' || phase === 'cashed';

  return (
    <GameLayout
      meta={meta}
      stage={
        <div className="grid h-full place-items-center py-2">
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: ROWS }, (_, r) => ROWS - 1 - r).map((row) => {
              const isCurrent = phase === 'playing' && row === level;
              const cleared = row < level;
              const chosen = picks[row];
              return (
                <div key={row} className={`flex gap-1.5 rounded-lg p-1 transition ${isCurrent ? 'bg-neon-violet/10 ring-1 ring-neon-violet/40' : ''}`}>
                  <span className="grid w-8 place-items-center font-mono text-[10px] text-slate-600">{fmtMult(towersMultiplier(cols, row + 1, edge))}</span>
                  {Array.from({ length: cols }, (_, c) => {
                    const isTrap = revealTraps && traps[row] === c;
                    const isChosenSafe = (cleared || revealTraps) && chosen === c && traps[row] !== c;
                    return (
                      <motion.button
                        key={c}
                        whileTap={isCurrent ? { scale: 0.9 } : undefined}
                        disabled={!isCurrent}
                        onClick={() => pick(row, c)}
                        className={`grid h-11 w-14 place-items-center rounded-lg border transition-all md:w-16 ${
                          isTrap
                            ? 'border-loss/50 bg-loss/20 text-loss'
                            : isChosenSafe
                              ? 'border-win/40 bg-win/15 text-win'
                              : isCurrent
                                ? 'border-neon-violet/40 bg-void-900/70 hover:border-neon-violet/70 hover:bg-void-700/60'
                                : 'border-white/[0.05] bg-void-950/50'
                        }`}
                        style={isChosenSafe ? { boxShadow: '0 0 18px -6px #10f5a0' } : undefined}
                      >
                        {isTrap ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                            <Icon name="bomb" size={20} />
                          </motion.span>
                        ) : isChosenSafe ? (
                          <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}>
                            <Icon name="gem" size={20} />
                          </motion.span>
                        ) : (
                          ''
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      }
      controls={
        <div className="space-y-4">
          <div>
            <span className="label-eyebrow">Difficulty</span>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {DIFF.map((d) => (
                <button
                  key={d.id}
                  disabled={phase === 'playing'}
                  onClick={() => setDiff(d.id)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                    diff === d.id ? 'bg-neon-violet/20 text-white ring-1 ring-neon-violet/50' : 'bg-void-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <BetAmount value={bet} onChange={setBet} disabled={phase === 'playing'} />

          <div className="grid grid-cols-2 gap-2">
            <Info label="Climbed" value={level > 0 ? fmtMult(curMult) : '—'} />
            <Info label="Next row" value={fmtMult(nextMult)} accent />
          </div>

          {phase === 'playing' ? (
            <button className="btn-primary btn-win mt-4 w-full disabled:opacity-40" disabled={level === 0} onClick={cashOut}>
              {level === 0 ? 'Pick a tile to climb' : `Cash out ◎${(bet * curMult).toFixed(4)}`}
            </button>
          ) : (
            <BetButton guard={g} onClick={start} busy={phase === 'busted' || phase === 'cashed'}>
              Start ◎{bet}
            </BetButton>
          )}
        </div>
      }
    />
  );
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`font-mono text-lg font-bold ${accent ? 'text-win' : 'text-white'}`}>{value}</div>
    </div>
  );
}

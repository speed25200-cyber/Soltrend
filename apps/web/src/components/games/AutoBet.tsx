'use client';

import { useEffect, useRef, useState } from 'react';
import { BetAmount } from '@/components/BetControls';
import { BetButton } from './BetButton';
import type { BetGuard } from '@/hooks/usePlay';
import { fmtSol } from '@/lib/format';
import { sfx } from '@/lib/sound';

export interface RoundResult {
  win: boolean;
  payout: number;
}

/**
 * Auto-bet engine — the "pro mode" that top crypto casinos live on. Drives any
 * game's `playRound` in a loop with configurable strategy (reset or grow the
 * bet on win/loss) and stop conditions (after N bets, on target profit/loss).
 * Effects are silenced per round; a big win still breaks through.
 */
export function AutoBet({
  baseBet,
  setBaseBet,
  guard,
  disabled,
  playRound,
  speed = 320,
}: {
  baseBet: number;
  setBaseBet: (n: number) => void;
  guard: (bet: number) => BetGuard;
  disabled?: boolean;
  playRound: (bet: number, quiet: boolean) => RoundResult;
  speed?: number;
}) {
  const [numBets, setNumBets] = useState(0); // 0 = until stopped
  const [onWinPct, setOnWinPct] = useState(0); // % to grow bet on win (0 = reset)
  const [onLossPct, setOnLossPct] = useState(0); // % to grow bet on loss (0 = reset)
  const [stopProfit, setStopProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [running, setRunning] = useState(false);
  const [profit, setProfit] = useState(0);
  const [done, setDone] = useState(0);

  const runningRef = useRef(false);
  const betRef = useRef(baseBet);
  const profitRef = useRef(0);
  const doneRef = useRef(0);
  const timer = useRef<number>();

  useEffect(() => () => { runningRef.current = false; window.clearTimeout(timer.current); }, []);

  const stop = () => {
    runningRef.current = false;
    setRunning(false);
    window.clearTimeout(timer.current);
  };

  const loop = () => {
    if (!runningRef.current) return;
    const bet = Math.round(betRef.current * 10000) / 10000;
    const g = guard(bet);
    if (!g.ok) return stop();

    const res = playRound(bet, true);
    const net = res.payout - bet;
    profitRef.current = Math.round((profitRef.current + net) * 10000) / 10000;
    doneRef.current += 1;
    setProfit(profitRef.current);
    setDone(doneRef.current);

    // Strategy: reset to base, or grow by the configured %.
    if (res.win) betRef.current = onWinPct > 0 ? bet * (1 + onWinPct / 100) : baseBet;
    else betRef.current = onLossPct > 0 ? bet * (1 + onLossPct / 100) : baseBet;

    const sp = parseFloat(stopProfit);
    const sl = parseFloat(stopLoss);
    if (numBets > 0 && doneRef.current >= numBets) return stop();
    if (Number.isFinite(sp) && sp > 0 && profitRef.current >= sp) return stop();
    if (Number.isFinite(sl) && sl > 0 && profitRef.current <= -sl) return stop();

    timer.current = window.setTimeout(loop, speed);
  };

  const start = () => {
    if (disabled) return;
    sfx.click();
    betRef.current = baseBet;
    profitRef.current = 0;
    doneRef.current = 0;
    setProfit(0);
    setDone(0);
    runningRef.current = true;
    setRunning(true);
    loop();
  };

  const g = guard(baseBet);

  return (
    <div className="space-y-3">
      <BetAmount value={baseBet} onChange={setBaseBet} disabled={running} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="Number of bets">
          <input className="input-num text-sm" value={numBets || ''} placeholder="∞" inputMode="numeric" disabled={running} onChange={(e) => setNumBets(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="On win +%"><input className="input-num text-sm" value={onWinPct || ''} placeholder="0" inputMode="decimal" disabled={running} onChange={(e) => setOnWinPct(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)} /></Field>
          <Field label="On loss +%"><input className="input-num text-sm" value={onLossPct || ''} placeholder="0" inputMode="decimal" disabled={running} onChange={(e) => setOnLossPct(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)} /></Field>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Stop on profit (◎)"><input className="input-num text-sm" value={stopProfit} placeholder="—" inputMode="decimal" disabled={running} onChange={(e) => setStopProfit(e.target.value.replace(/[^0-9.]/g, ''))} /></Field>
        <Field label="Stop on loss (◎)"><input className="input-num text-sm" value={stopLoss} placeholder="—" inputMode="decimal" disabled={running} onChange={(e) => setStopLoss(e.target.value.replace(/[^0-9.]/g, ''))} /></Field>
      </div>

      {(running || done > 0) && (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-void-900/50 px-4 py-2.5 text-sm">
          <span className="text-slate-500">{done} bet{done === 1 ? '' : 's'} · session</span>
          <span className={`font-mono font-bold ${profit >= 0 ? 'text-win' : 'text-loss'}`}>{profit >= 0 ? '+' : ''}◎{fmtSol(profit, 4)}</span>
        </div>
      )}

      {running ? (
        <button className="btn-primary btn-win w-full" onClick={stop}>Stop autobet</button>
      ) : (
        <BetButton guard={g} onClick={start}>Start autobet</BetButton>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[0.62rem] uppercase tracking-wider text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

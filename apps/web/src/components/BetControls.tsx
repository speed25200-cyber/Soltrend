'use client';

import { useCasino } from '@/lib/store';
import { fmtSol, SOL_USD } from '@/lib/format';
import { SolMark } from './BalanceWidget';

export function BetAmount({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const balance = useCasino((s) => s.balance);
  const set = (v: number) => onChange(Math.max(0, Math.round(v * 10000) / 10000));

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label-eyebrow">Bet amount</span>
        <span className="font-mono text-xs text-slate-500">≈ ${(value * SOL_USD).toFixed(2)}</span>
      </div>
      <div className="mt-1.5 flex items-stretch gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-void-900/80 px-3 focus-within:border-neon-violet/60">
          <SolMark />
          <input
            className="w-full bg-transparent py-3 font-mono text-white outline-none tabular-nums"
            value={value}
            disabled={disabled}
            inputMode="decimal"
            onChange={(e) => {
              const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
              onChange(Number.isFinite(n) ? n : 0);
            }}
          />
        </div>
        <button
          className="btn-ghost !px-3 font-mono text-xs"
          disabled={disabled}
          onClick={() => set(value / 2)}
        >
          ½
        </button>
        <button
          className="btn-ghost !px-3 font-mono text-xs"
          disabled={disabled}
          onClick={() => set(value * 2)}
        >
          2×
        </button>
        <button
          className="btn-ghost !px-3 font-mono text-xs"
          disabled={disabled}
          onClick={() => set(balance)}
        >
          Max
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {[0.01, 0.1, 0.5, 1].map((v) => (
          <button
            key={v}
            disabled={disabled}
            onClick={() => set(v)}
            className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 text-xs font-semibold text-slate-400 transition hover:border-neon-violet/40 hover:text-white disabled:opacity-40"
          >
            {fmtSol(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

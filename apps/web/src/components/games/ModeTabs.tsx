'use client';

import { sfx } from '@/lib/sound';

export function ModeTabs({ mode, setMode }: { mode: 'manual' | 'auto'; setMode: (m: 'manual' | 'auto') => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-void-900/80 p-1">
      {(['manual', 'auto'] as const).map((m) => (
        <button
          key={m}
          onClick={() => {
            sfx.click();
            setMode(m);
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
            mode === m ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          {m === 'auto' ? 'Auto' : 'Manual'}
        </button>
      ))}
    </div>
  );
}

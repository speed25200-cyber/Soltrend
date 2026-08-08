'use client';

import dynamic from 'next/dynamic';
import { SHIP_SKINS, ShipMesh, type ShipSkin } from './ships';
import { sfx } from '@/lib/sound';

const ShipPreview = dynamic(() => import('./ShipPreview'), {
  ssr: false,
  loading: () => <div className="h-24 rounded-xl bg-void-950/50" />,
});

/** Grid of ship skins + a rotating 3D preview of the current pick. */
export function ShipPicker({ value, onChange }: { value: ShipSkin; onChange: (id: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="relative h-28 overflow-hidden rounded-xl border border-white/[0.06] bg-void-950/50">
        <ShipPreview skin={value} />
        <div className="pointer-events-none absolute bottom-2 left-3 text-xs font-semibold text-white">{value.label}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SHIP_SKINS.map((s) => (
          <button
            key={s.id}
            onClick={() => { onChange(s.id); sfx.click(); }}
            className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold"
            style={{ borderColor: value.id === s.id ? s.color : 'rgba(255,255,255,0.08)', color: value.id === s.id ? '#fff' : '#94a3b8', background: value.id === s.id ? `${s.color}1a` : 'transparent' }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${s.color}, ${s.glow})` }} /> {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

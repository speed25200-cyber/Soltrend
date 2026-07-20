'use client';

import { useState } from 'react';
import { Icon } from './Icon';

/**
 * Compliance banner (demo). In production the backend geo-blocks by IP + wallet
 * against a configurable list of prohibited jurisdictions (§ compliance) and
 * would render a hard restriction screen — never a dismissible banner — for a
 * blocked region. Here we surface the posture transparently.
 */
export function GeoNotice() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="border-b border-white/[0.05] bg-neon-violet/[0.06]">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-xs text-slate-400">
        <span className="chip !border-neon-violet/30 !text-neon-violet">Devnet</span>
        <p className="flex-1">
          Reference build on Solana devnet. Play money only. Geo-blocking, KYC & responsible-gaming
          limits are enforced before mainnet.
        </p>
        <button className="text-slate-500 hover:text-white" onClick={() => setOpen(false)} aria-label="Dismiss">
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}

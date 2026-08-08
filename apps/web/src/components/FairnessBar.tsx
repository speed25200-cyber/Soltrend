'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCasino } from '@/lib/store';
import { shortAddr } from '@/lib/format';
import { Icon } from './Icon';

/**
 * Provably-fair control strip. Shows the committed server-seed hash (published
 * BEFORE any bet), lets the player edit their client seed, exposes the current
 * nonce, and offers seed rotation (which would reveal the previous server seed).
 */
export function FairnessBar() {
  const seeds = useCasino((s) => s.seeds);
  const setClientSeed = useCasino((s) => s.setClientSeed);
  const rotateSeeds = useCasino((s) => s.rotateSeeds);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(seeds.clientSeed);

  // The seed pair is generated in the browser (and restored from storage), so it
  // cannot exist in the prerendered HTML. Rendering it before hydration finishes
  // mismatches and makes React throw the whole server tree away — on every game
  // page. Hold the values back for one paint instead.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="glass mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-win/15 text-win">
          <Icon name="shield" size={13} />
        </span>
        <span className="font-semibold text-slate-300">Provably fair</span>
      </div>

      <Field label="Server seed (hashed)">
        <code className="font-mono text-slate-400">{mounted ? shortAddr(seeds.serverSeedHash, 6) : '••••••'}</code>
      </Field>

      <Field label="Client seed">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setClientSeed(draft || seeds.clientSeed);
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-28 rounded bg-void-900 px-2 py-0.5 font-mono text-white outline-none"
          />
        ) : (
          <button className="inline-flex items-center gap-1 font-mono text-slate-400 hover:text-white" onClick={() => setEditing(true)}>
            {mounted ? seeds.clientSeed : '••••••'} <Icon name="pencil" size={11} />
          </button>
        )}
      </Field>

      <Field label="Nonce">
        <code className="font-mono text-slate-400">{mounted ? seeds.nonce : '—'}</code>
      </Field>

      <div className="ml-auto flex items-center gap-2">
        <button className="chip hover:border-neon-violet/40" onClick={rotateSeeds}>
          Rotate seed
        </button>
        <Link href="/verify" className="chip hover:border-neon-violet/40">
          Verify →
        </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[0.62rem] uppercase tracking-wider text-slate-600">{label}</span>
      {children}
    </div>
  );
}

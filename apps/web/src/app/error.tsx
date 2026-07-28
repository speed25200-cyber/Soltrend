'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

/**
 * Route-level recovery.
 *
 * Without this, one thrown render anywhere in a route unmounts the whole tree
 * and the player is left on a blank page — mid-session, possibly mid-bet, with
 * no idea whether anything settled. The two things that actually matter in that
 * moment are stated plainly: the round was decided by the seed and already
 * recorded, and here is the way back.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[route]', error);
  }, [error]);

  return (
    <div className="glass mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-loss/15 text-loss">
        <Icon name="shield" size={24} />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-white">This page hit a problem</h1>
      <p className="mt-2 text-sm text-slate-400">
        Nothing was lost. Every round is decided by its reserved seed and written to your history the
        moment it settles, so anything already played is recorded and verifiable.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn-ghost">Back to the lobby</Link>
      </div>
      {error.digest && (
        <p className="mt-4 font-mono text-[0.62rem] text-slate-600">Reference {error.digest}</p>
      )}
    </div>
  );
}

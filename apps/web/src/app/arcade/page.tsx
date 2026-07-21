'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** The Arcade builder has been folded into Soltrend Worlds (3D). Redirect. */
export default function ArcadeRedirect() {
  const router = useRouter();
  useEffect(() => {
    const q = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`/worlds${q}`);
  }, [router]);
  return <div className="glass grid place-items-center p-16 text-center text-slate-500">Redirecting to Soltrend Worlds…</div>;
}

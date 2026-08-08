'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Merged into the unified Create page. */
export default function ForgeRedirect() {
  const router = useRouter();
  useEffect(() => {
    const remix = new URLSearchParams(window.location.search).get('remix');
    router.replace(`/studio?mode=node${remix ? `&remix=${remix}` : ''}`);
  }, [router]);
  return <div className="glass grid place-items-center p-16 text-center text-slate-500">Opening the creator…</div>;
}

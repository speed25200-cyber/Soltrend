'use client';

import { useEffect, useState } from 'react';

/**
 * False during the server render and the first client render, true afterwards.
 *
 * For content that only exists in the browser — the community-game list, a
 * balance, anything restored from storage — prerendering it produces HTML that
 * is right only by coincidence. When it is wrong React does not patch it up: it
 * discards the whole route and re-renders on the client, which is both slower
 * and an uncaught error in the console.
 *
 * Gating on this makes the first client render identical to the server's by
 * construction, so the page can only render browser state once there is a
 * browser to hold it.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

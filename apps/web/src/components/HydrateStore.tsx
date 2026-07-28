'use client';

import { useEffect } from 'react';
import { useCasino } from '@/lib/store';

/**
 * Restores the saved session, once, after the first paint.
 *
 * The store is created with `skipHydration` so that the first client render is
 * identical to the prerendered HTML. Reading persisted state any earlier means
 * React hydrates against a tree the server could not have produced and discards
 * the whole route. Rendering nothing here keeps it out of the tree it is fixing.
 */
export function HydrateStore() {
  useEffect(() => {
    void useCasino.persist.rehydrate();
  }, []);
  return null;
}

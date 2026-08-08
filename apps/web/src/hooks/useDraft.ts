'use client';

import { useEffect, useRef, useState } from 'react';
import { clearDraft, loadDraft, saveDraft, type Draft, type DraftMode } from '@/lib/drafts';

/**
 * Autosave/restore a builder's work-in-progress. Loads any existing draft once on
 * mount (surfaced as `pending` for a restore banner) and debounce-saves the
 * current snapshot as the creator works. Call `clear()` on publish/discard.
 */
export function useDraft<T>(mode: DraftMode, current: T, active = true) {
  const [pending, setPending] = useState<Draft<T> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (active) setPending(loadDraft<T>(mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => saveDraft(mode, current, Date.now()), 800);
    return () => clearTimeout(t);
  }, [current, active, mode]);

  return {
    pending,
    dismiss: () => setPending(null),
    clear: () => {
      clearDraft(mode);
      setPending(null);
    },
  };
}

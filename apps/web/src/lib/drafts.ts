'use client';

/**
 * Studio drafts — autosave a work-in-progress game per builder mode to
 * localStorage, so a creator never loses a design to a refresh or a stray tab
 * close. One draft slot per mode; publishing (or an explicit discard) clears it.
 */

export type DraftMode = 'world' | 'node' | 'classic';

export interface Draft<T = unknown> {
  data: T;
  savedAt: number;
}

const key = (mode: DraftMode) => `soltrend-draft-${mode}`;

export function saveDraft<T>(mode: DraftMode, data: T, savedAt: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(mode), JSON.stringify({ data, savedAt } satisfies Draft<T>));
  } catch {
    /* quota — ignore */
  }
}

export function loadDraft<T>(mode: DraftMode): Draft<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key(mode));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft<T>;
    return d && typeof d.savedAt === 'number' && 'data' in d ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(mode: DraftMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key(mode));
  } catch {
    /* ignore */
  }
}

/** A short "3m ago" style label for a draft timestamp, given the current time. */
export function draftAge(savedAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

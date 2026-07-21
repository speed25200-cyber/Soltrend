'use client';

import { describe as describeOffline } from './describe';
import type { Feeling } from './generator';
import type { PresentationId } from '../presentation';

/**
 * AI "describe your game" integration. When NEXT_PUBLIC_AI_URL is set, the
 * description is sent to a hosted model that returns generator *inputs* (a feeling
 * + presentation + optional name/edge). Crucially the AI only picks parameters —
 * the existing validated, vault-safe generator builds the actual game — so a
 * hosted model can never emit an unsafe payout curve. With no endpoint (or on any
 * error) it falls back to the offline keyword mapper, so the static app still
 * works. Mirrors the graceful degradation of the realtime + on-chain hooks.
 */
export const AI_URL = process.env.NEXT_PUBLIC_AI_URL || '';
export const aiEnabled = () => !!AI_URL;

export interface CreateHints {
  feeling: Feeling;
  presentation?: PresentationId;
  name?: string;
  /** Target edge in [0.01, 0.05], clamped by the caller. */
  edge?: number;
  source: 'ai' | 'offline';
}

const FEELINGS: Feeling[] = ['fast', 'tense', 'jackpot', 'slowburn'];
const PRESENTATIONS: PresentationId[] = ['pulse', 'orb', 'rocket', 'reel', 'burst', 'wheel', 'cards', 'shatter'];

/** Coerce a hosted model's JSON into safe, known enum values. */
function sanitize(raw: any, fallback: { feeling: Feeling; presentation?: PresentationId }): CreateHints {
  const feeling = FEELINGS.includes(raw?.feeling) ? raw.feeling : fallback.feeling;
  const presentation = PRESENTATIONS.includes(raw?.presentation) ? raw.presentation : fallback.presentation;
  const name = typeof raw?.name === 'string' ? raw.name.slice(0, 28) : undefined;
  const edge = typeof raw?.edge === 'number' && raw.edge >= 0.01 && raw.edge <= 0.05 ? raw.edge : undefined;
  return { feeling, presentation, name, edge, source: 'ai' };
}

export async function describeWithAI(text: string): Promise<CreateHints> {
  const offline = describeOffline(text);
  if (!AI_URL) return { ...offline, source: 'offline' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${AI_URL.replace(/\/$/, '')}/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const json = await res.json();
    return sanitize(json, offline);
  } catch {
    // Any failure → the deterministic offline mapper. The creator still gets a game.
    return { ...offline, source: 'offline' };
  }
}

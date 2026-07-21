/**
 * Offline "describe your game" assistant. Not an LLM — a transparent keyword
 * mapper that turns a free-text idea into the generator's inputs (a feeling +
 * an optional presentation) so a creator can type "a tense high-risk rocket
 * game" and get a matching, playable draft in one tap. Runs fully client-side.
 */

import type { Feeling } from './generator';
import type { PresentationId } from '../presentation';

const FEELING_WORDS: Record<Feeling, string[]> = {
  fast: ['fast', 'quick', 'instant', 'rapid', 'blitz', 'speed', 'speedy', 'snappy', 'arcade', 'turbo'],
  tense: ['tense', 'risk', 'risky', 'scary', 'nerve', 'suspense', 'danger', 'dangerous', 'sweat', 'clutch', 'hardcore'],
  jackpot: ['jackpot', 'big', 'huge', 'moon', 'lottery', 'mega', 'whale', 'massive', 'rare', 'giant', 'lambo'],
  slowburn: ['slow', 'steady', 'chill', 'grind', 'calm', 'patient', 'relax', 'relaxed', 'smooth', 'zen'],
};

const PRESENTATION_WORDS: Partial<Record<PresentationId, string[]>> = {
  rocket: ['rocket', 'crash', 'launch', 'space', 'fly', 'flight', 'climb', 'ship'],
  reel: ['slot', 'reel', 'fruit', 'machine', 'vegas'],
  wheel: ['wheel', 'roulette', 'spinner'],
  cards: ['card', 'cards', 'scratch', 'flip', 'deck', 'poker'],
  orb: ['orb', 'energy', 'charge', 'magic', 'plasma'],
  burst: ['nova', 'star', 'explode', 'boom', 'burst', 'blast'],
  shatter: ['crystal', 'ice', 'gem', 'shatter', 'diamond'],
};

function scoreHits(words: string[], tokens: Set<string>): number {
  return words.reduce((n, w) => n + (tokens.has(w) ? 1 : 0), 0);
}

export interface DescribeResult {
  feeling: Feeling;
  presentation?: PresentationId;
}

/** Map a free-text description to generator inputs. Always returns something. */
export function describe(text: string): DescribeResult {
  const tokens = new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );

  let feeling: Feeling = 'tense';
  let best = 0;
  (Object.keys(FEELING_WORDS) as Feeling[]).forEach((f) => {
    const s = scoreHits(FEELING_WORDS[f], tokens);
    if (s > best) {
      best = s;
      feeling = f;
    }
  });

  let presentation: PresentationId | undefined;
  let pbest = 0;
  (Object.keys(PRESENTATION_WORDS) as PresentationId[]).forEach((p) => {
    const s = scoreHits(PRESENTATION_WORDS[p] ?? [], tokens);
    if (s > pbest) {
      pbest = s;
      presentation = p;
    }
  });

  return { feeling, presentation };
}

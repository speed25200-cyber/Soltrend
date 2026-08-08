import type { IconName } from '@/components/Icon';

/**
 * What a creator can actually make, in one flat list.
 *
 * The studio used to ask two questions before you could start: pick an engine
 * ("Node game", "3D World", "Classic"), then pick a mechanic inside it. Both
 * were named after our internals, so choosing meant already knowing how the
 * thing was built. This replaces that with the only question a creator has:
 * what does the game DO. The engine is an implementation detail underneath.
 */

export type KindId = 'slot' | 'towers' | 'board' | 'ascent' | 'nexus' | 'node';

/** How much work it is, so nobody starts on the hardest one by accident. */
export type Effort = 'easiest' | 'easy' | 'involved' | 'advanced';

export interface GameKind {
  id: KindId;
  name: string;
  /** One line, in the player's language — how the game actually plays. */
  plays: string;
  /** What the creator gets to decide. */
  youChoose: string;
  icon: IconName;
  accent: string;
  effort: Effort;
  /** Minutes, honestly estimated, so the choice is informed. */
  minutes: string;
}

export const EFFORT_LABEL: Record<Effort, string> = {
  easiest: 'Easiest',
  easy: 'Easy',
  involved: 'Takes a bit',
  advanced: 'Advanced',
};

export const GAME_KINDS: GameKind[] = [
  {
    id: 'slot',
    name: 'Slot machine',
    plays: 'Spin for ore. Six gold wagons start a train that locks in prizes and keeps respinning.',
    youChoose: 'How often the train comes, and how it looks',
    icon: 'gem',
    accent: '#ffd25f',
    effort: 'easiest',
    minutes: '1 min',
  },
  {
    id: 'towers',
    name: 'Tower climb',
    plays: 'One trap hides on every floor. Pick a safe tile to climb higher, or bank before you fall.',
    youChoose: 'Difficulty, house edge and the look',
    icon: 'target',
    accent: '#10f5a0',
    effort: 'easiest',
    minutes: '1 min',
  },
  {
    id: 'board',
    name: 'Minefield',
    plays: 'Reveal tiles on a board floating in 3D. Every safe tile multiplies — one hazard ends it.',
    youChoose: 'Board size, hazard count, skin and decor',
    icon: 'bomb',
    accent: '#22d3ee',
    effort: 'easy',
    minutes: '3 min',
  },
  {
    id: 'ascent',
    name: 'Vertical ascent',
    plays: 'Climb a tower in 3D. One trap per floor, and the camera rises with you as the ground falls away.',
    youChoose: 'Floors, lanes, skin and decor',
    icon: 'trend',
    accent: '#a855f7',
    effort: 'easy',
    minutes: '3 min',
  },
  {
    id: 'nexus',
    name: 'Dungeon map',
    plays: 'You draw the map. Players walk it, choosing safe corridors or lethal shortcuts, and bank anywhere.',
    youChoose: 'Every room, path, danger level and locked door',
    icon: 'orbit',
    accent: '#ec4899',
    effort: 'involved',
    minutes: '10 min',
  },
  {
    id: 'node',
    name: 'Invent your own',
    plays: 'Anything else. Describe an idea, or wire the maths together yourself piece by piece.',
    youChoose: 'The entire mechanic, from scratch',
    icon: 'spark',
    accent: '#8b5cf6',
    effort: 'advanced',
    minutes: '15 min+',
  },
];

export const kindById = (id: string) => GAME_KINDS.find((k) => k.id === id);

/**
 * Which builder a published game reopens in. Kept here so the mapping exists
 * once: the per-page copies previously drifted, and slots were missing
 * entirely, which left published slot games with no Edit or Duplicate link.
 */
export function kindForGame(game: { template: string; params?: Record<string, number | string> }): KindId | null {
  switch (game.template) {
    case 'slots':
      return 'slot';
    case 'towers':
      return 'towers';
    case 'graph':
      return 'node';
    case 'board': {
      const mode = String(game.params?.mode ?? 'board');
      return mode === 'ascent' ? 'ascent' : mode === 'nexus' ? 'nexus' : 'board';
    }
    default:
      return null;
  }
}

/** Studio URL that reopens a game for editing or duplicating. */
export function studioLink(game: { id: string; template: string; params?: Record<string, number | string> }, action: 'edit' | 'remix'): string | null {
  const kind = kindForGame(game);
  return kind ? `/studio?make=${kind}&${action}=${game.id}` : null;
}

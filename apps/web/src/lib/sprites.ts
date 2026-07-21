/**
 * Pixel-sprite model for the creator studio.
 *
 * Creators draw their own slot symbols / tokens on a small grid. A sprite is a
 * tiny, self-contained value: a palette plus one base36 char per cell indexing
 * that palette (index 0 = transparent). It serialises to plain JSON so a
 * published game can carry its custom symbols inline — every player renders the
 * exact pixels the creator drew, no server, no assets to host.
 */

export interface Sprite {
  id: string;
  name: string;
  grid: number; // side length in cells (square)
  palette: string[]; // hex colors; index 0 is unused (transparent), 1..n are paints
  data: string; // grid*grid base36 chars, each an index into palette (0 = transparent)
}

const KEY = 'soltrend-sprites';
export const MAX_GRID = 24;
export const SYMBOLS_PER_GAME = 6;

/** A warm, readable default palette (index 0 kept transparent). */
export const DEFAULT_PALETTE = [
  'transparent',
  '#ffffff',
  '#0b1020',
  '#ff3b6b',
  '#ff9f43',
  '#ffd25f',
  '#10f5a0',
  '#22d3ee',
  '#4f7cff',
  '#a855f7',
  '#ec4899',
  '#94a3b8',
  '#1e293b',
  '#7c3f12',
  '#0f766e',
];

const newId = () => 's' + Math.random().toString(36).slice(2, 9);
const blankData = (grid: number) => '0'.repeat(grid * grid);

export function newSprite(grid = 16, name = 'symbol'): Sprite {
  return { id: newId(), name, grid, palette: [...DEFAULT_PALETTE], data: blankData(grid) };
}

export const idx = (s: Sprite, x: number, y: number) => y * s.grid + x;

export function pixelAt(s: Sprite, x: number, y: number): number {
  const c = s.data[idx(s, x, y)];
  return c ? parseInt(c, 36) : 0;
}

/** Immutably paint one cell (color 0 = erase). */
export function setPixel(s: Sprite, x: number, y: number, color: number): Sprite {
  if (x < 0 || y < 0 || x >= s.grid || y >= s.grid) return s;
  const i = idx(s, x, y);
  const ch = Math.max(0, Math.min(35, color)).toString(36);
  if (s.data[i] === ch) return s;
  return { ...s, data: s.data.slice(0, i) + ch + s.data.slice(i + 1) };
}

export const clearSprite = (s: Sprite): Sprite => ({ ...s, data: blankData(s.grid) });

/** True when the sprite has at least one painted cell. */
export const isDrawn = (s: Sprite) => /[^0]/.test(s.data);

/* ------------------------------------------------------------ persistence */

export function listSprites(): Sprite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as Sprite[]) : [];
    return Array.isArray(arr) ? arr.filter(validSprite) : [];
  } catch {
    return [];
  }
}

export function saveSprite(sprite: Sprite): Sprite[] {
  const all = listSprites();
  const i = all.findIndex((s) => s.id === sprite.id);
  if (i >= 0) all[i] = sprite;
  else all.unshift(sprite);
  persist(all);
  return all;
}

export function deleteSprite(id: string): Sprite[] {
  const all = listSprites().filter((s) => s.id !== id);
  persist(all);
  return all;
}

export function getSprite(id: string): Sprite | undefined {
  return listSprites().find((s) => s.id === id);
}

function persist(all: Sprite[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota — ignore */
  }
}

/* ------------------------------------------------------------ starter set */
// A few procedurally-drawn symbols so a first-time creator has something to
// use (and edit) immediately — an empty editor is a weak first impression.

function paint(grid: number, color: number, fn: (x: number, y: number, c: number, r: number) => boolean): string {
  const c = (grid - 1) / 2;
  let data = '';
  for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) data += fn(x, y, c, grid / 2 - 1) ? color.toString(36) : '0';
  return data;
}

export function starterSprites(): Sprite[] {
  const G = 12;
  const mk = (name: string, color: number, data: string): Sprite => ({ id: newId(), name, grid: G, palette: [...DEFAULT_PALETTE], data });
  const dist = (x: number, y: number, c: number) => Math.hypot(x - c, y - c);
  return [
    mk('Gem', 9, paint(G, 9, (x, y, c, r) => Math.abs(x - c) + Math.abs(y - c) <= r)), // diamond
    mk('Coin', 5, paint(G, 5, (x, y, c, r) => { const d = dist(x, y, c); return d <= r && d >= r - 2; })), // ring
    mk('Star', 6, paint(G, 6, (x, y, c, r) => Math.abs(x - c) < 1.2 || Math.abs(y - c) < 1.2 || Math.abs(Math.abs(x - c) - Math.abs(y - c)) < 1)), // burst
    mk('Seven', 3, paint(G, 3, (x, y, c) => y < 2 || (x - (10 - y * 0.7)) ** 2 < 2)), // lucky 7
    mk('Clover', 6, paint(G, 6, (x, y, c) => dist(x, y, c - 2) < 3 || dist(x, y, c + 2) < 3 || dist(x - 2, y, c) < 3 || dist(x + 2, y, c) < 3)),
    mk('Bell', 5, paint(G, 5, (x, y, c, r) => (y > c - 3 && dist(x, y - 1, c) < r) || (y === G - 2 && Math.abs(x - c) < 1))),
  ];
}

/* ---------------------------------------------------------------- sharing */
// Symbols are tiny, so a shareable "pack" is just base64 of the JSON. This lets
// creators trade symbol packs by pasting a code — no server, the seed of an
// asset marketplace. Fresh ids are minted on import so packs never collide.

const PREFIX = 'SYM1.';

const b64encode = (s: string) =>
  typeof window === 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : window.btoa(unescape(encodeURIComponent(s)));
const b64decode = (s: string) =>
  typeof window === 'undefined' ? Buffer.from(s, 'base64').toString('utf8') : decodeURIComponent(escape(window.atob(s)));

/** Encode one or more sprites into a shareable code. */
export function encodePack(sprites: Sprite[]): string {
  const slim = sprites.map(({ name, grid, palette, data }) => ({ name, grid, palette, data }));
  return PREFIX + b64encode(JSON.stringify(slim));
}

/** Decode a share code back into sprites, minting fresh ids. Returns [] on junk. */
export function decodePack(code: string): Sprite[] {
  try {
    const body = code.trim().startsWith(PREFIX) ? code.trim().slice(PREFIX.length) : code.trim();
    const arr = JSON.parse(b64decode(body)) as Partial<Sprite>[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((o) => ({ id: newId(), name: String(o.name ?? 'symbol'), grid: Number(o.grid), palette: o.palette as string[], data: String(o.data) }))
      .filter(validSprite);
  } catch {
    return [];
  }
}

/** Defensive shape check for anything read from storage or a published game. */
export function validSprite(s: unknown): s is Sprite {
  if (!s || typeof s !== 'object') return false;
  const o = s as Sprite;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.grid === 'number' &&
    o.grid > 0 &&
    o.grid <= MAX_GRID &&
    Array.isArray(o.palette) &&
    typeof o.data === 'string' &&
    o.data.length === o.grid * o.grid
  );
}

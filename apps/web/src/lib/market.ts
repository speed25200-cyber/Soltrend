'use client';

/**
 * Asset marketplace — a browsable catalog of symbol packs creators can install
 * into their library with one tap. Curated packs ship built-in; creators publish
 * their own library as a pack (stored locally, the client-only stand-in for a
 * shared registry). Installs are counted so popular packs surface.
 */

import { encodePack, spritePack, type Sprite } from './sprites';

export interface MarketPack {
  id: string;
  name: string;
  author: string;
  code: string; // encoded sprite pack
  count: number; // number of symbols
  curated?: boolean;
}

const PUB_KEY = 'soltrend-market';
const INSTALL_KEY = 'soltrend-installs';

const pack = (id: string, name: string, author: string, sprites: Sprite[]): MarketPack => ({
  id,
  name,
  author,
  code: encodePack(sprites),
  count: sprites.length,
  curated: true,
});

/** Built-in curated packs (deterministic art, stable codes). */
export const CURATED: MarketPack[] = [
  pack('gems', 'Gemstones', 'Soltrend', spritePack('gems')),
  pack('fruit', 'Classic Fruit', 'Soltrend', spritePack('fruit')),
  pack('cosmic', 'Cosmic', 'Soltrend', spritePack('cosmic')),
];

export function listPublished(): MarketPack[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PUB_KEY);
    const arr = raw ? (JSON.parse(raw) as MarketPack[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function publishPack(name: string, author: string, sprites: Sprite[]): MarketPack[] {
  const p: MarketPack = {
    id: 'u' + Math.random().toString(36).slice(2, 9),
    name: name.trim().slice(0, 40) || 'Untitled pack',
    author: author || 'anon',
    code: encodePack(sprites),
    count: sprites.length,
  };
  const all = [p, ...listPublished()].slice(0, 60);
  write(PUB_KEY, all);
  return all;
}

export function unpublishPack(id: string): MarketPack[] {
  const all = listPublished().filter((p) => p.id !== id);
  write(PUB_KEY, all);
  return all;
}

/** All packs, curated first, then community by install count. */
export function allPacks(): MarketPack[] {
  const counts = installCounts();
  const community = listPublished().sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
  return [...CURATED, ...community];
}

export function installCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(INSTALL_KEY) || '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function bumpInstall(id: string): Record<string, number> {
  const counts = installCounts();
  counts[id] = (counts[id] ?? 0) + 1;
  write(INSTALL_KEY, counts);
  return counts;
}

/* --------------------------------------------------------------- modules */

export interface MarketModule {
  id: string;
  name: string;
  author: string;
  code: string; // encoded module (MOD1.…)
  nodeCount: number;
}

const MOD_KEY = 'soltrend-module-market';

export function listPublishedModules(): MarketModule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MOD_KEY);
    const arr = raw ? (JSON.parse(raw) as MarketModule[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function publishModule(name: string, author: string, code: string, nodeCount: number): MarketModule[] {
  const m: MarketModule = { id: 'm' + Math.random().toString(36).slice(2, 9), name: name.trim().slice(0, 40) || 'Untitled module', author: author || 'anon', code, nodeCount };
  const all = [m, ...listPublishedModules()].slice(0, 60);
  write(MOD_KEY, all);
  return all;
}

export function unpublishModule(id: string): MarketModule[] {
  const all = listPublishedModules().filter((m) => m.id !== id);
  write(MOD_KEY, all);
  return all;
}

/** Community modules, ranked by install count. */
export function allModules(): MarketModule[] {
  const counts = installCounts();
  return listPublishedModules().sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — ignore */
  }
}

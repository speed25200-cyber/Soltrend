'use client';

/**
 * Reusable node modules — the "plugins / models" of the studio. A creator saves a
 * cluster of wired nodes (a bonus round, a multiplier ladder, a custom mechanic)
 * and drops it into any other game. This is the Roblox-style composability lever:
 * mechanics become shareable building blocks instead of being rebuilt each time.
 * Stored locally; a future version publishes them to a community module library.
 */

import { newId, type ForgeNode } from './model';

export interface ForgeModule {
  id: string;
  name: string;
  nodes: ForgeNode[];
}

const KEY = 'soltrend-modules';

export function listModules(): ForgeModule[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ForgeModule[]) : [];
  } catch {
    return [];
  }
}

export function saveModule(name: string, nodes: ForgeNode[]): ForgeModule[] {
  const mod: ForgeModule = {
    id: `m${(nodes.length + name.length).toString(36)}${Math.floor(performance.now() % 1e6).toString(36)}`,
    name: name.slice(0, 40),
    nodes: JSON.parse(JSON.stringify(nodes)) as ForgeNode[],
  };
  const all = [mod, ...listModules().filter((m) => m.name !== mod.name)].slice(0, 40);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
  return all;
}

export function deleteModule(id: string): ForgeModule[] {
  const all = listModules().filter((m) => m.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

/**
 * Clone a saved cluster with fresh node ids, remapping internal wiring so the
 * copy is self-consistent; positions are offset so it doesn't land on top of the
 * existing graph. External inputs (that pointed outside the cluster) are cleared.
 */
export function instantiate(nodes: ForgeNode[], dx = 60, dy = 40): ForgeNode[] {
  const idMap = new Map<string, string>();
  nodes.forEach((n) => idMap.set(n.id, newId()));
  return nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    x: n.x + dx,
    y: n.y + dy,
    params: { ...n.params },
    inputs: Object.fromEntries(
      Object.entries(n.inputs).map(([k, v]) => [k, v && idMap.has(v) ? idMap.get(v) : undefined]),
    ),
  }));
}

'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { sfx } from '@/lib/sound';
import {
  clampRisk, exitsFrom, newRoom, roomGain, linkId, KEYS, KEY_HEX,
  MAX_ROOMS, MIN_RISK, MAX_RISK,
  type NexusRoom, type NexusSpec,
} from '@/lib/forge/nexus';

/**
 * The map editor — the heart of what makes a Nexus unlike anything a creator can
 * build in another casino. They lay out rooms on a floor plane (with a height
 * slider for the third axis), wire one-way paths between them, and dial each
 * room's danger. The payout for a room is *derived* from its danger (1/survival)
 * rather than typed in, which is exactly why no drawing can break the house
 * edge — so the creator is free to build whatever shape they can imagine.
 */

const VIEW = 320; // editor viewport in px
const WORLD = 8; // world units mapped across the viewport

const toPx = (v: number) => ((v + WORLD / 2) / WORLD) * VIEW;
const toWorld = (px: number) => (px / VIEW) * WORLD - WORLD / 2;

export function NexusEditor({ spec, onChange }: { spec: NexusSpec; onChange: (s: NexusSpec) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<string | null>(null);

  const room = spec.rooms.find((r) => r.id === selected) ?? null;

  const patch = (p: Partial<NexusSpec>) => onChange({ ...spec, ...p });
  const patchRoom = (id: string, p: Partial<NexusRoom>) =>
    patch({ rooms: spec.rooms.map((r) => (r.id === id ? { ...r, ...p } : r)) });

  const addRoom = () => {
    if (spec.rooms.length >= MAX_ROOMS) return;
    // Drop it somewhere free-ish rather than on top of an existing room.
    const a = (spec.rooms.length / MAX_ROOMS) * Math.PI * 2;
    const r = newRoom(Math.cos(a) * 2.4, Math.sin(a) * 2.4);
    patch({ rooms: [...spec.rooms, r], startId: spec.rooms.length === 0 ? r.id : spec.startId });
    setSelected(r.id);
    sfx.click();
  };

  const removeRoom = (id: string) => {
    const rooms = spec.rooms.filter((r) => r.id !== id);
    patch({
      rooms,
      links: spec.links.filter(([a, b]) => a !== id && b !== id),
      startId: spec.startId === id ? (rooms[0]?.id ?? '') : spec.startId,
    });
    setSelected(null);
    sfx.click();
  };

  /** Click one room then another to wire a one-way path; clicking it again unwires. */
  const toggleLink = (from: string, to: string) => {
    if (from === to) return;
    const exists = spec.links.some(([a, b]) => a === from && b === to);
    patch({
      links: exists
        ? spec.links.filter(([a, b]) => !(a === from && b === to))
        : [...spec.links, [from, to] as [string, string]],
    });
    sfx.click();
  };

  const onRoomPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (linkFrom) {
      toggleLink(linkFrom, id);
      setLinkFrom(null);
      return;
    }
    setSelected(id);
    dragging.current = id;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const id = dragging.current;
    if (!id || !svgRef.current) return;
    const box = svgRef.current.getBoundingClientRect();
    const x = toWorld(((e.clientX - box.left) / box.width) * VIEW);
    const z = toWorld(((e.clientY - box.top) / box.height) * VIEW);
    patchRoom(id, {
      x: Math.max(-WORLD / 2, Math.min(WORLD / 2, Math.round(x * 10) / 10)),
      z: Math.max(-WORLD / 2, Math.min(WORLD / 2, Math.round(z * 10) / 10)),
    });
  };

  const endDrag = () => (dragging.current = null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={addRoom} disabled={spec.rooms.length >= MAX_ROOMS} className="btn-ghost !py-1.5 text-xs disabled:opacity-40">
          <Icon name="spark" size={12} /> Add room
        </button>
        <button
          onClick={() => { setLinkFrom(selected); sfx.click(); }}
          disabled={!selected}
          className={`btn-ghost !py-1.5 text-xs disabled:opacity-40 ${linkFrom ? '!border-neon-violet/60 !text-neon-violet' : ''}`}
        >
          {linkFrom ? 'Now click the destination…' : 'Draw path from selected'}
        </button>
        {linkFrom && <button onClick={() => setLinkFrom(null)} className="text-xs text-slate-500 hover:text-white">cancel</button>}
        <span className="ml-auto text-[0.62rem] text-slate-600">{spec.rooms.length}/{MAX_ROOMS} rooms</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        {/* ------------------------------------------------------- map canvas */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="w-full max-w-[320px] touch-none rounded-xl border border-white/10 bg-void-950/70"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClick={() => setLinkFrom(null)}
        >
          {/* floor grid for a sense of space */}
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i} stroke="#ffffff" strokeOpacity={0.05}>
              <line x1={(i * VIEW) / 8} y1={0} x2={(i * VIEW) / 8} y2={VIEW} />
              <line x1={0} y1={(i * VIEW) / 8} x2={VIEW} y2={(i * VIEW) / 8} />
            </g>
          ))}

          {/* paths (arrowed so one-way is obvious) */}
          <defs>
            <marker id="nx-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#a855f7" />
            </marker>
          </defs>
          {spec.links.map(([from, to]) => {
            const a = spec.rooms.find((r) => r.id === from);
            const b = spec.rooms.find((r) => r.id === to);
            if (!a || !b) return null;
            return (
              <line
                key={`${from}>${to}`}
                x1={toPx(a.x)} y1={toPx(a.z)} x2={toPx(b.x)} y2={toPx(b.z)}
                stroke={spec.gates?.[linkId(from, to)] ? KEY_HEX[spec.gates[linkId(from, to)]] : '#a855f7'}
                strokeOpacity={0.55} strokeWidth={1.6}
                strokeDasharray={spec.gates?.[linkId(from, to)] ? '4 3' : undefined}
                markerEnd="url(#nx-arrow)"
              />
            );
          })}

          {/* rooms — radius shows danger, ring marks the start */}
          {spec.rooms.map((r) => {
            const danger = clampRisk(r.risk);
            const isStart = r.id === spec.startId;
            const hue = 190 - danger * 190; // cyan → red
            return (
              <g key={r.id} onPointerDown={(e) => onRoomPointerDown(e, r.id)} className="cursor-pointer">
                {isStart && <circle cx={toPx(r.x)} cy={toPx(r.z)} r={16} fill="none" stroke="#10f5a0" strokeWidth={1.5} strokeDasharray="3 3" />}
                <circle
                  cx={toPx(r.x)} cy={toPx(r.z)} r={10 + danger * 6}
                  fill={`hsl(${hue} 85% 55% / 0.28)`}
                  stroke={selected === r.id ? '#ffffff' : `hsl(${hue} 90% 62%)`}
                  strokeWidth={selected === r.id ? 2.4 : 1.4}
                />
                <text x={toPx(r.x)} y={toPx(r.z) + 3} textAnchor="middle" fontSize={8} fill="#e2e8f0" className="pointer-events-none select-none">
                  ×{roomGain(r).toFixed(1)}
                </text>
                {r.key && <circle cx={toPx(r.x) + 11} cy={toPx(r.z) - 11} r={3.5} fill={KEY_HEX[r.key]} />}
              </g>
            );
          })}

          {spec.rooms.length === 0 && (
            <text x={VIEW / 2} y={VIEW / 2} textAnchor="middle" fontSize={11} fill="#64748b">Add a room to start drawing</text>
          )}
        </svg>

        {/* ----------------------------------------------------- room inspector */}
        <div className="space-y-3">
          {room ? (
            <>
              <div className="flex items-center justify-between">
                <input
                  value={room.label ?? ''}
                  onChange={(e) => patchRoom(room.id, { label: e.target.value.slice(0, 22) })}
                  placeholder="Room name"
                  className="input-num !font-sans flex-1 text-sm"
                />
                <button onClick={() => removeRoom(room.id)} className="ml-2 text-xs text-slate-500 hover:text-loss">Delete</button>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow">Danger</span>
                  <span className="font-mono text-sm font-bold text-white">{(clampRisk(room.risk) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range" min={MIN_RISK * 100} max={MAX_RISK * 100} value={clampRisk(room.risk) * 100}
                  onChange={(e) => patchRoom(room.id, { risk: parseInt(e.target.value) / 100 })}
                  className="mt-1.5 w-full accent-neon-violet"
                />
                <p className="mt-1 text-[0.62rem] text-slate-500">
                  Pays <b className="text-slate-300">×{roomGain(room).toFixed(2)}</b> — derived from the danger, so the house edge stays identical on every route.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="label-eyebrow">Height</span>
                  <span className="font-mono text-xs text-slate-400">{room.y.toFixed(1)}</span>
                </div>
                <input
                  type="range" min={-20} max={30} value={room.y * 10}
                  onChange={(e) => patchRoom(room.id, { y: parseInt(e.target.value) / 10 })}
                  className="mt-1.5 w-full accent-neon-cyan"
                />
              </div>

              <div>
                <span className="label-eyebrow">Grants a key</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => patchRoom(room.id, { key: undefined })}
                    className={`chip ${!room.key ? 'border-white/40 text-slate-200' : ''}`}
                  >
                    none
                  </button>
                  {KEYS.map((k) => (
                    <button
                      key={k}
                      onClick={() => patchRoom(room.id, { key: k })}
                      className="chip capitalize"
                      style={room.key === k ? { borderColor: KEY_HEX[k], color: KEY_HEX[k] } : undefined}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gates on this room's own exits — the dungeon layer. */}
              {exitsFrom(spec, room.id).length > 0 && (
                <div>
                  <span className="label-eyebrow">Lock a path out of here</span>
                  <div className="mt-1.5 space-y-1.5">
                    {exitsFrom(spec, room.id).map((dest) => {
                      const lid = linkId(room.id, dest.id);
                      const need = spec.gates?.[lid];
                      return (
                        <div key={dest.id} className="flex items-center gap-1.5 text-xs">
                          <span className="min-w-0 flex-1 truncate text-slate-400">→ {dest.label || 'Room'}</span>
                          <button
                            onClick={() => { const g = { ...(spec.gates ?? {}) }; delete g[lid]; patch({ gates: g }); sfx.click(); }}
                            className={`chip !text-[0.6rem] ${!need ? 'border-white/40 text-slate-200' : ''}`}
                          >
                            open
                          </button>
                          {KEYS.map((k) => (
                            <button
                              key={k}
                              onClick={() => { patch({ gates: { ...(spec.gates ?? {}), [lid]: k } }); sfx.click(); }}
                              title={`Require the ${k} key`}
                              className="h-5 w-5 rounded border"
                              style={{ background: `${KEY_HEX[k]}${need === k ? 'cc' : '22'}`, borderColor: need === k ? KEY_HEX[k] : 'transparent' }}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={() => { patch({ startId: room.id }); sfx.click(); }}
                  disabled={spec.startId === room.id}
                  className="chip hover:border-win/50 disabled:opacity-40"
                >
                  {spec.startId === room.id ? 'Start room' : 'Make start'}
                </button>
                <span className="text-slate-600">{exitsFrom(spec, room.id).length} exit(s)</span>
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-white/[0.06] bg-void-950/50 p-3 text-xs text-slate-500">
              Drag rooms to lay out your map. Select one to set its danger and height, then use
              <b className="text-slate-300"> Draw path</b> to wire a one-way route to another room.
              A room with no exits is where the run ends and the player banks.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

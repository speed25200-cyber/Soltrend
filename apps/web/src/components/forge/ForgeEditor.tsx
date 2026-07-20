'use client';

import { useRef, useState } from 'react';
import { NODE_DEFS, newId, type ForgeGraph, type ForgeNode, type NodeKind } from '@/lib/forge/model';
import { Icon } from '@/components/Icon';

const NODE_W = 168;
const HEADER = 34;
const IN_GAP = 24;
const outPortY = (n: ForgeNode) => n.y + 17;
const inPortY = (n: ForgeNode, idx: number) => n.y + HEADER + IN_GAP / 2 + idx * IN_GAP;
const inDotTop = (idx: number) => HEADER + IN_GAP / 2 + idx * IN_GAP - 7;

const PALETTE: NodeKind[] = ['rng', 'const', 'math', 'branch', 'curve', 'payout'];

export function ForgeEditor({ graph, onChange }: { graph: ForgeGraph; onChange: (g: ForgeGraph) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [pending, setPending] = useState<string | null>(null); // output source awaiting an input target
  const [selected, setSelected] = useState<string | null>(null);

  const update = (nodes: ForgeNode[]) => onChange({ nodes });
  const patch = (id: string, fn: (n: ForgeNode) => ForgeNode) => update(graph.nodes.map((n) => (n.id === id ? fn(n) : n)));

  const addNode = (kind: NodeKind) => {
    const def = NODE_DEFS[kind];
    const params: Record<string, number | string> = {};
    def.params.forEach((p) => (params[p.key] = p.default));
    const n: ForgeNode = { id: newId(), kind, x: 40 + (graph.nodes.length % 4) * 30, y: 40 + (graph.nodes.length % 5) * 24, params, inputs: {} };
    update([...graph.nodes, n]);
  };

  const removeNode = (id: string) => {
    update(
      graph.nodes
        .filter((n) => n.id !== id)
        .map((n) => ({ ...n, inputs: Object.fromEntries(Object.entries(n.inputs).map(([k, v]) => [k, v === id ? undefined : v])) })),
    );
    setSelected(null);
  };

  const onPointerDownHeader = (e: React.PointerEvent, n: ForgeNode) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    drag.current = { id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y };
    setSelected(n.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - NODE_W, e.clientX - rect.left - drag.current.dx));
    const y = Math.max(0, e.clientY - rect.top - drag.current.dy);
    patch(drag.current.id, (n) => ({ ...n, x, y }));
  };
  const onPointerUp = () => (drag.current = null);

  const clickOutput = (id: string) => setPending((p) => (p === id ? null : id));
  const clickInput = (nodeId: string, key: string) => {
    if (pending && pending !== nodeId) {
      patch(nodeId, (n) => ({ ...n, inputs: { ...n.inputs, [key]: pending } }));
      setPending(null);
    } else {
      // disconnect
      patch(nodeId, (n) => ({ ...n, inputs: { ...n.inputs, [key]: undefined } }));
    }
  };

  // Wires
  const wires: { d: string; color: string }[] = [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const n of graph.nodes) {
    NODE_DEFS[n.kind].inputs.forEach((port, idx) => {
      const src = n.inputs[port.key] ? byId.get(n.inputs[port.key]!) : undefined;
      if (!src) return;
      const x1 = src.x + NODE_W;
      const y1 = outPortY(src);
      const x2 = n.x;
      const y2 = inPortY(n, idx);
      wires.push({ d: `M ${x1} ${y1} C ${x1 + 46} ${y1}, ${x2 - 46} ${y2}, ${x2} ${y2}`, color: NODE_DEFS[src.kind].color });
    });
  }

  return (
    <div>
      {/* palette */}
      <div className="mb-3 flex flex-wrap gap-2">
        {PALETTE.map((k) => (
          <button key={k} onClick={() => addNode(k)} className="chip hover:border-neon-violet/50" style={{ borderColor: `${NODE_DEFS[k].color}55` }}>
            <span className="h-2 w-2 rounded-full" style={{ background: NODE_DEFS[k].color }} /> + {NODE_DEFS[k].label}
          </button>
        ))}
        {pending && <span className="chip !border-neon-violet/50 !text-neon-violet">Click an input port to connect · click source again to cancel</span>}
      </div>

      <div
        ref={wrapRef}
        className="relative h-[460px] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-void-950/60"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* wires */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {wires.map((w, i) => (
            <path key={i} d={w.d} fill="none" stroke={w.color} strokeWidth={2} strokeOpacity={0.7} />
          ))}
        </svg>

        {/* nodes */}
        {graph.nodes.map((n) => {
          const def = NODE_DEFS[n.kind];
          const sel = selected === n.id;
          return (
            <div
              key={n.id}
              className="absolute rounded-xl border bg-void-800/95 shadow-lg backdrop-blur"
              style={{ left: n.x, top: n.y, width: NODE_W, borderColor: sel ? def.color : 'rgba(255,255,255,0.1)', boxShadow: sel ? `0 0 0 1px ${def.color}, 0 10px 30px -10px ${def.color}88` : undefined }}
            >
              {/* input port dots (absolute to card) */}
              {def.inputs.map((port, idx) => {
                const connected = !!n.inputs[port.key];
                return (
                  <button
                    key={'dot-' + port.key}
                    onClick={() => clickInput(n.id, port.key)}
                    className="absolute z-10 h-3.5 w-3.5 rounded-full border-2"
                    style={{ left: -7, top: inDotTop(idx), borderColor: connected ? def.color : '#475569', background: connected ? def.color : '#0d1024' }}
                    title={connected ? 'Click to disconnect' : 'Click to wire from a selected source'}
                  />
                );
              })}
              {/* output port dot */}
              {n.kind !== 'payout' && (
                <button
                  onClick={() => clickOutput(n.id)}
                  className="absolute z-10 h-3.5 w-3.5 rounded-full border-2"
                  style={{ right: -7, top: 10, borderColor: def.color, background: pending === n.id ? def.color : '#0d1024', boxShadow: pending === n.id ? `0 0 10px ${def.color}` : undefined }}
                  title="Click, then click an input to wire"
                />
              )}

              {/* header (drag handle) */}
              <div
                onPointerDown={(e) => onPointerDownHeader(e, n)}
                className="flex cursor-grab items-center justify-between rounded-t-xl px-2.5 active:cursor-grabbing"
                style={{ height: HEADER, background: `${def.color}22` }}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <span className="h-2 w-2 rounded-full" style={{ background: def.color }} /> {def.label}
                </span>
                <button onClick={() => removeNode(n.id)} className="text-slate-500 hover:text-loss" title="Delete">
                  <Icon name="close" size={12} />
                </button>
              </div>

              {/* input labels (aligned with dots) */}
              {def.inputs.map((port) => (
                <div key={port.key} className="flex items-center pl-3 text-[0.68rem] text-slate-400" style={{ height: IN_GAP }}>
                  {port.label}
                </div>
              ))}

              {/* params */}
              {def.params.length > 0 && (
                <div className="space-y-1.5 px-2.5 pb-2 pt-1">
                  {def.params.map((p) => (
                    <div key={p.key}>
                      {p.type === 'select' ? (
                        <div className="flex flex-wrap gap-1">
                          {p.options!.map((o) => (
                            <button
                              key={o}
                              onClick={() => patch(n.id, (nn) => ({ ...nn, params: { ...nn.params, [p.key]: o } }))}
                              className={`rounded px-1.5 py-0.5 text-[0.62rem] font-semibold ${String(n.params[p.key]) === o ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400'}`}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <label className="flex items-center justify-between gap-2">
                          <span className="text-[0.62rem] text-slate-500">{p.label}</span>
                          <input
                            value={String(n.params[p.key] ?? '')}
                            inputMode="decimal"
                            onChange={(e) => patch(n.id, (nn) => ({ ...nn, params: { ...nn.params, [p.key]: e.target.value === '' ? '' : parseFloat(e.target.value.replace(/[^0-9.\-]/g, '')) || 0 } }))}
                            className="w-16 rounded bg-void-900 px-1.5 py-0.5 text-right font-mono text-[0.68rem] text-white outline-none"
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

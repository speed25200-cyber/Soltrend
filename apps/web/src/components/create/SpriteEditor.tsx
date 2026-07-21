'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { SpriteGlyph } from './SpriteGlyph';
import { publishPack } from '@/lib/market';
import { onchainEnabled } from '@/lib/onchain/buyAsset';
import {
  clearSprite,
  decodePack,
  deleteSprite,
  encodePack,
  isDrawn,
  listSprites,
  newSprite,
  pixelAt,
  saveSprite,
  setPixel,
  starterSprites,
  type Sprite,
} from '@/lib/sprites';

/**
 * Pixel editor — the studio's visual-imagination lever. Creators draw their own
 * slot symbols / tokens; they persist to a personal library and can be dropped
 * into any slot or scratch game so every player renders the exact art.
 */
export function SpriteEditor() {
  const wallet = useWallet();
  const [sprite, setSprite] = useState<Sprite>(() => newSprite());
  const [library, setLibrary] = useState<Sprite[]>([]);
  const [color, setColor] = useState(1);
  const [erasing, setErasing] = useState(false);
  const painting = useRef(false);

  useEffect(() => {
    setLibrary(listSprites());
    const stop = () => (painting.current = false);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  const paint = (x: number, y: number) => setSprite((s) => setPixel(s, x, y, erasing ? 0 : color));

  const save = () => {
    if (!isDrawn(sprite)) return;
    const clean: Sprite = { ...sprite, name: sprite.name.trim() || 'symbol' };
    setLibrary(saveSprite(clean));
    setSprite(clean);
  };

  const load = (s: Sprite) => setSprite({ ...s });
  const remove = (id: string) => {
    setLibrary(deleteSprite(id));
    if (sprite.id === id) setSprite(newSprite());
  };

  const [shareMsg, setShareMsg] = useState('');
  const shareLibrary = async () => {
    if (!library.length) return;
    const code = encodePack(library);
    try {
      await navigator.clipboard.writeText(code);
      setShareMsg('Pack code copied to clipboard');
    } catch {
      setShareMsg(code);
    }
  };
  const addStarters = () => {
    let next = library;
    for (const s of starterSprites()) next = saveSprite(s);
    setLibrary(next);
  };
  const publishToMarket = () => {
    if (!library.length) return;
    const name = window.prompt('Name your pack', 'My symbols');
    if (!name) return;
    // Optional on-chain price — only offered when a wallet + program are available.
    let price: number | undefined;
    if (onchainEnabled() && wallet.publicKey) {
      const raw = window.prompt('Price in SOL (blank = free)', '');
      const p = raw ? parseFloat(raw) : NaN;
      if (Number.isFinite(p) && p > 0) price = p;
    }
    const seller = wallet.publicKey?.toBase58();
    publishPack(name, seller ? seller.slice(0, 4) + '…' + seller.slice(-4) : 'you', library, { price, sellerWallet: seller });
    setShareMsg(price ? `Published "${name}" at ◎${price}` : `Published "${name}" to the marketplace`);
  };
  const importPack = () => {
    const code = window.prompt('Paste a symbol pack code');
    if (!code) return;
    const incoming = decodePack(code);
    if (!incoming.length) {
      setShareMsg('That code was empty or invalid');
      return;
    }
    let next = library;
    for (const s of incoming) next = saveSprite(s);
    setLibrary(next);
    setShareMsg(`Imported ${incoming.length} symbol${incoming.length === 1 ? '' : 's'}`);
  };

  const cell = Math.max(9, Math.floor(288 / sprite.grid));

  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
      {/* ---------------------------------------------------------- canvas */}
      <div className="glass space-y-3 p-4">
        <div className="flex items-center gap-2">
          <input
            value={sprite.name}
            onChange={(e) => setSprite((s) => ({ ...s, name: e.target.value }))}
            className="input-num !font-sans flex-1 text-sm"
            placeholder="Symbol name"
            maxLength={24}
          />
          <SpriteGlyph sprite={sprite} size={40} className="rounded bg-void-950/60 p-1" />
        </div>

        <div
          className="mx-auto w-fit touch-none select-none rounded-lg border border-white/10 bg-void-950/70 p-1"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${sprite.grid}, ${cell}px)` }}
          onPointerLeave={() => (painting.current = false)}
        >
          {Array.from({ length: sprite.grid * sprite.grid }).map((_, i) => {
            const x = i % sprite.grid;
            const y = Math.floor(i / sprite.grid);
            const c = pixelAt(sprite, x, y);
            const fill = c > 0 ? sprite.palette[c] : 'transparent';
            return (
              <div
                key={i}
                onPointerDown={(e) => {
                  e.preventDefault();
                  painting.current = true;
                  paint(x, y);
                }}
                onPointerEnter={() => painting.current && paint(x, y)}
                style={{ width: cell, height: cell, background: fill }}
                className="border-[0.5px] border-white/[0.04]"
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex gap-2">
            <button onClick={() => setErasing(false)} className={`chip ${!erasing ? 'border-neon-violet/60 text-slate-100' : ''}`}>
              Paint
            </button>
            <button onClick={() => setErasing(true)} className={`chip ${erasing ? 'border-neon-violet/60 text-slate-100' : ''}`}>
              Erase
            </button>
            <button onClick={() => setSprite((s) => clearSprite(s))} className="chip">
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Grid</span>
            {[12, 16, 24].map((g) => (
              <button
                key={g}
                onClick={() => setSprite((s) => (s.grid === g ? s : newSprite(g, s.name)))}
                className={`chip ${sprite.grid === g ? 'border-neon-cyan/60 text-slate-100' : ''}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* palette */}
        <div className="flex flex-wrap gap-1.5">
          {sprite.palette.map((hex, i) =>
            i === 0 ? null : (
              <button
                key={i}
                onClick={() => {
                  setColor(i);
                  setErasing(false);
                }}
                title={hex}
                style={{ background: hex }}
                className={`h-7 w-7 rounded-md border-2 ${color === i && !erasing ? 'border-white' : 'border-white/10'}`}
              />
            ),
          )}
        </div>

        <button onClick={save} disabled={!isDrawn(sprite)} className="btn-primary w-full disabled:opacity-40">
          Save to library
        </button>
      </div>

      {/* --------------------------------------------------------- library */}
      <div className="glass space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Your symbols</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/market" className="btn-ghost text-xs" title="Browse the asset marketplace">Market</Link>
            <button onClick={importPack} className="btn-ghost text-xs" title="Paste a shared pack">
              Import
            </button>
            <button onClick={shareLibrary} disabled={!library.length} className="btn-ghost text-xs disabled:opacity-40" title="Copy a shareable code for all your symbols">
              Share
            </button>
            <button onClick={publishToMarket} disabled={!library.length} className="btn-ghost text-xs disabled:opacity-40" title="Publish your symbols to the marketplace">
              Publish
            </button>
            <button onClick={() => setSprite(newSprite(sprite.grid))} className="btn-ghost text-xs">
              New
            </button>
          </div>
        </div>
        {shareMsg && <p className="break-all rounded-lg border border-white/[0.06] bg-void-950/50 p-2 text-[11px] text-slate-400">{shareMsg}</p>}
        {library.length === 0 ? (
          <div className="grid place-items-center gap-3 py-8 text-center">
            <p className="text-sm text-slate-500">
              No symbols yet. Draw one and save it — then use it in your slot and scratch games.
            </p>
            <button onClick={addStarters} className="btn-ghost text-xs">Add starter symbols</button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {library.map((s) => (
              <div key={s.id} className="group relative rounded-lg border border-white/10 bg-void-950/50 p-2 text-center">
                <button onClick={() => load(s)} className="block w-full" title={`Edit ${s.name}`}>
                  <SpriteGlyph sprite={s} size={48} className="mx-auto" />
                  <span className="mt-1 block truncate text-[10px] text-slate-400">{s.name}</span>
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="absolute right-1 top-1 hidden h-5 w-5 rounded bg-void-900/80 text-xs text-slate-400 group-hover:block hover:text-neon-pink"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

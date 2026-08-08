'use client';

import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { GOLDMINE, TRAIN, GTRAIN, type TrainColor } from '@/lib/slots/gold-express';
import { CanyonSymbol } from './CanyonSymbols';

/**
 * Reel strips for the 3D machine, painted from the same SVG art the 2D game
 * uses — one canvas per reel, wrapped around a cylinder.
 *
 * This is the whole performance story of the rebuild. The previous 3D machine
 * built every symbol out of geometry: a dot-matrix glyph was a mesh per lit
 * dot, so five reels of tiles cost thousands of draw calls before the set was
 * even lit. A textured cylinder costs one. The art is rasterised once per
 * session (and re-painted only on the four window slots at each spin), so the
 * GPU never sees anything but five quadstrips and a handful of set pieces.
 */

export const STRIP_SLOTS = 12;
/** Tile size in the strip canvas. 208px keeps five strips ~1.2 MB of VRAM total. */
const TILE = 208;

export interface SlotSpec {
  sym: number;
  cash?: number | null;
  trainColor?: TrainColor | null;
}

/** The window rows (0=top of window) land on these strip slots at rest — the
 *  drum rests with slots 7..10 in the glass and 6/11 peeking past the frame. */
export const FINAL_SLOT = [7, 8, 9, 10];

const svgCache = new Map<string, HTMLImageElement>();

/** Rasterise one symbol's SVG to an <img>, memoised by its identity. */
function symbolImage(spec: SlotSpec): Promise<HTMLImageElement> {
  const key = `${spec.sym}:${spec.cash ?? ''}:${spec.trainColor ?? ''}`;
  const hit = svgCache.get(key);
  if (hit) return Promise.resolve(hit);
  const markup = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={TILE} height={TILE}>
      <CanyonSymbol sym={spec.sym} cash={spec.cash} trainColor={spec.trainColor} />
    </svg>,
  );
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      svgCache.set(key, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

/** The parchment tile a symbol sits on — painted directly, no SVG round-trip. */
function paintTile(ctx: CanvasRenderingContext2D, x: number, y: number, hot = false) {
  const g = ctx.createLinearGradient(0, y, 0, y + TILE);
  g.addColorStop(0, hot ? '#ffe9b8' : '#f3dfae');
  g.addColorStop(0.5, hot ? '#fadf9e' : '#e9cf94');
  g.addColorStop(1, hot ? '#efc678' : '#d9b878');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TILE, TILE);
  // bevel
  ctx.fillStyle = 'rgba(255,250,230,0.75)';
  ctx.fillRect(x, y, TILE, 3);
  ctx.fillStyle = 'rgba(94,58,20,0.45)';
  ctx.fillRect(x, y + TILE - 3, TILE, 3);
  // frame line
  ctx.strokeStyle = 'rgba(122,79,30,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4.5, y + 4.5, TILE - 9, TILE - 9);
  // corner rivets
  ctx.fillStyle = '#9a6b2a';
  for (const [cx, cy] of [[12, 12], [TILE - 12, 12], [12, TILE - 12], [TILE - 12, TILE - 12]]) {
    ctx.beginPath();
    ctx.arc(x + cx, y + cy, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class ReelStrip {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  /** Vertically smeared copy, swapped in while the reel free-spins. */
  readonly blurCanvas: HTMLCanvasElement;
  readonly blurTexture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private slots: SlotSpec[];

  constructor(slots: SlotSpec[]) {
    this.slots = slots.slice(0, STRIP_SLOTS);
    this.canvas = document.createElement('canvas');
    this.canvas.width = TILE;
    this.canvas.height = TILE * STRIP_SLOTS;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.blurCanvas = document.createElement('canvas');
    this.blurCanvas.width = TILE;
    this.blurCanvas.height = TILE * STRIP_SLOTS;
    this.blurTexture = new THREE.CanvasTexture(this.blurCanvas);
    for (const t of [this.texture, this.blurTexture]) {
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.RepeatWrapping;
      // Linear colour space: three uploads sRGB canvases via SRGB8_ALPHA8,
      // which software GL contexts reject silently — the drum then samples
      // black. The art is bright and warm; the difference is invisible here.
      // No mipmaps: the strip is NPOT and always viewed near 1:1, and software
      // GL contexts upload NPOT-mipmapped canvases as black. Linear filtering
      // also kills the shimmer a scrolling mip chain would add.
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
    }
    void this.repaintAll();
    // Debug hook: `window.__stripDebug = true` before load pins the live strip
    // canvases to the corner of the page so texture issues are visible directly.
    if (typeof window !== 'undefined' && (window as unknown as { __stripDebug?: boolean }).__stripDebug) {
      this.canvas.style.cssText = 'position:fixed;left:0;top:0;width:60px;z-index:9999;border:1px solid red';
      document.body.appendChild(this.canvas);
    }
  }

  private async paintSlot(i: number) {
    const spec = this.slots[i];
    const y = i * TILE;
    paintTile(this.ctx, 0, y, spec.sym === GOLDMINE || spec.sym === TRAIN || spec.sym === GTRAIN);
    try {
      const img = await symbolImage(spec);
      this.ctx.drawImage(img, 8, y + 8, TILE - 16, TILE - 16);
    } catch {
      /* keep the parchment tile — never let one bad rasterise blank the reel */
    }
  }

  private async repaintAll() {
    await Promise.all(this.slots.map((_, i) => this.paintSlot(i)));
    this.commit();
  }

  /** Put the engine's four window symbols on the landing slots for this spin,
   *  and refresh the filler so the strip never repeats itself visibly. */
  async setWindow(finals: SlotSpec[], filler: SlotSpec[]) {
    FINAL_SLOT.forEach((slot, row) => {
      if (finals[row]) this.slots[slot] = finals[row];
    });
    let f = 0;
    for (let i = 0; i < STRIP_SLOTS; i++) {
      if (!FINAL_SLOT.includes(i) && filler[f]) this.slots[i] = filler[f++];
    }
    await this.repaintAll();
  }

  /** Rebuild the smear copy from the sharp strip, then flag both for upload. */
  private commit() {
    const b = this.blurCanvas.getContext('2d')!;
    b.clearRect(0, 0, TILE, TILE * STRIP_SLOTS);
    b.globalAlpha = 1;
    b.drawImage(this.canvas, 0, 0);
    b.globalAlpha = 0.22;
    for (const dy of [-34, -18, 18, 34]) b.drawImage(this.canvas, 0, dy);
    // darken slightly so the spin reads as motion, not brightness
    b.globalAlpha = 0.18;
    b.fillStyle = '#3a2508';
    b.fillRect(0, 0, TILE, TILE * STRIP_SLOTS);
    b.globalAlpha = 1;
    this.texture.needsUpdate = true;
    this.blurTexture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.blurTexture.dispose();
  }
}

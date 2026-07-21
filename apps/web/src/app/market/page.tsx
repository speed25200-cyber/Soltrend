'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { SpriteGlyph } from '@/components/create/SpriteGlyph';
import { allPacks, bumpInstall, installCounts, unpublishPack, type MarketPack } from '@/lib/market';
import { decodePack, listSprites, saveSprite } from '@/lib/sprites';

export default function MarketPage() {
  const [packs, setPacks] = useState<MarketPack[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [owned, setOwned] = useState(0);
  const [msg, setMsg] = useState('');

  const refresh = () => {
    setPacks(allPacks());
    setCounts(installCounts());
    setOwned(listSprites().length);
  };
  useEffect(refresh, []);

  const install = (p: MarketPack) => {
    const sprites = decodePack(p.code);
    if (!sprites.length) return;
    let n = 0;
    for (const s of sprites) {
      saveSprite(s);
      n++;
    }
    setCounts(bumpInstall(p.id));
    setOwned(listSprites().length);
    setMsg(`Installed ${n} symbol${n === 1 ? '' : 's'} from ${p.name} into your library`);
  };

  const remove = (p: MarketPack) => {
    setPacks(unpublishPack(p.id));
    refresh();
  };

  return (
    <div className="space-y-8">
      <SectionHead
        eyebrow="Marketplace"
        title="Asset market"
        sub="Install symbol packs into your library, then use them in slot and scratch games"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/studio?mode=art" className="btn-ghost text-sm"><Icon name="pencil" size={14} /> Open Symbols editor</Link>
        <span className="text-xs text-slate-500">{owned} symbol{owned === 1 ? '' : 's'} in your library</span>
      </div>

      {msg && <p className="rounded-lg border border-win/30 bg-win/10 p-2 text-xs text-win">{msg}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((p) => (
          <PackCard key={p.id} pack={p} installs={counts[p.id] ?? 0} onInstall={() => install(p)} onRemove={p.curated ? undefined : () => remove(p)} />
        ))}
      </div>

      <div className="glass flex flex-col items-center gap-2 p-6 text-center">
        <p className="font-display text-lg font-bold text-white">Made your own symbols?</p>
        <p className="max-w-md text-sm text-slate-400">Publish a pack from the Symbols editor to share it with the community.</p>
        <Link href="/studio?mode=art" className="btn-primary">Open the Studio</Link>
      </div>
    </div>
  );
}

function PackCard({ pack, installs, onInstall, onRemove }: { pack: MarketPack; installs: number; onInstall: () => void; onRemove?: () => void }) {
  const preview = useMemo(() => decodePack(pack.code).slice(0, 6), [pack.code]);
  return (
    <div className="glass relative flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display font-bold text-white">{pack.name}</h3>
          <p className="text-xs text-slate-500">by {pack.author} · {pack.count} symbols{installs > 0 ? ` · ${installs} installs` : ''}</p>
        </div>
        {pack.curated && <span className="chip !border-gold/40 !bg-gold/10 !text-gold"><Icon name="star" size={11} /> Curated</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {preview.map((s) => (
          <div key={s.id} className="rounded-lg border border-white/10 bg-void-950/50 p-1">
            <SpriteGlyph sprite={s} size={30} />
          </div>
        ))}
      </div>
      <div className="mt-auto flex gap-2">
        <button onClick={onInstall} className="btn-primary flex-1 !py-2 text-sm">Install</button>
        {onRemove && <button onClick={onRemove} className="btn-ghost !py-2 text-sm" title="Unpublish">Remove</button>}
      </div>
    </div>
  );
}

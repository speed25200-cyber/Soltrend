'use client';

import { Icon } from '@/components/Icon';

/**
 * The branded loading state every 3D stage shows while its chunk arrives —
 * a breathing gem over a soft glow instead of a bare line of text. Pure CSS
 * animation: it costs nothing and never competes with the scene it precedes.
 */
export function SceneLoader({ label }: { label: string }) {
  return (
    <div className="grid h-full min-h-[380px] place-items-center">
      <div className="text-center">
        <div className="relative mx-auto h-12 w-12">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-neon-violet/20" />
          <span className="relative grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-neon-violet/15 text-neon-violet">
            <Icon name="gem" size={22} />
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

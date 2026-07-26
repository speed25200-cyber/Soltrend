'use client';

import { notFound } from 'next/navigation';
import { bySlug } from '@/lib/catalog';
import { PlayModeGame } from '@/components/games/PlayModeGame';

export function PlayClient({ slug }: { slug: string }) {
  const meta = bySlug(slug);
  if (!meta) return notFound();
  return <PlayModeGame config={{ meta }} crashVariant={meta.slug === 'crash'} />;
}

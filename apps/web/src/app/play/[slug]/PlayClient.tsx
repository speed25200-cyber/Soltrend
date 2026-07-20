'use client';

import { notFound } from 'next/navigation';
import { bySlug } from '@/lib/catalog';
import { GameScreen } from '@/components/games/GameScreen';

export function PlayClient({ slug }: { slug: string }) {
  const meta = bySlug(slug);
  if (!meta) return notFound();
  return <GameScreen config={{ meta }} crashVariant={meta.slug === 'crash'} />;
}

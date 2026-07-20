'use client';

import { notFound, useParams } from 'next/navigation';
import { bySlug } from '@/lib/catalog';
import { GameScreen } from '@/components/games/GameScreen';

export default function PlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta = bySlug(slug);
  if (!meta) return notFound();
  return <GameScreen config={{ meta }} crashVariant={meta.slug === 'crash'} />;
}

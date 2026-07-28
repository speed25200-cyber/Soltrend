import type { Metadata } from 'next';
import { CATALOG, bySlug } from '@/lib/catalog';
import { PlayClient } from './PlayClient';

// Static export needs the full param set up-front (server component).
export function generateStaticParams() {
  return CATALOG.map((g) => ({ slug: g.slug }));
}
export const dynamicParams = false;

/** Each Original gets its own title and share card — a link to one game should
 *  say which game, not just "Soltrend". */
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const game = bySlug(params.slug);
  if (!game) return { title: 'Game' };
  const description = `${game.tagline}. Provably fair on Solana — play it free in demo first, verify every round yourself.`;
  return {
    title: game.name,
    description,
    alternates: { canonical: `/play/${game.slug}` },
    openGraph: { title: `${game.name} · Soltrend`, description, url: `/play/${game.slug}` },
    twitter: { card: 'summary_large_image', title: `${game.name} · Soltrend`, description },
  };
}

export default function PlayPage({ params }: { params: { slug: string } }) {
  return <PlayClient slug={params.slug} />;
}

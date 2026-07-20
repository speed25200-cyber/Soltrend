import { CATALOG } from '@/lib/catalog';
import { PlayClient } from './PlayClient';

// Static export needs the full param set up-front (server component).
export function generateStaticParams() {
  return CATALOG.map((g) => ({ slug: g.slug }));
}
export const dynamicParams = false;

export default function PlayPage({ params }: { params: { slug: string } }) {
  return <PlayClient slug={params.slug} />;
}

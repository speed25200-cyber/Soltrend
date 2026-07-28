import type { MetadataRoute } from 'next';
import { CATALOG } from '@/lib/catalog';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

/** Public routes, plus a page per Original. Personal and seed-bearing pages are
 *  excluded here for the same reason robots.txt disallows them. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '', '/arcade', '/discover', '/leaderboard', '/studio', '/studio/games',
    '/creator', '/daily', '/duel', '/floor', '/forge', '/live', '/market',
    '/rewards', '/vault', '/worlds',
    ...CATALOG.map((g) => `/play/${g.slug}`),
  ];
  return paths.map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === '' || p === '/discover' ? ('daily' as const) : ('weekly' as const),
    priority: p === '' ? 1 : p.startsWith('/play/') ? 0.8 : 0.6,
  }));
}

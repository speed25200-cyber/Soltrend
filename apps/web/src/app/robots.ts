import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

/**
 * Crawlers get the public surface and nothing else.
 *
 * `/verify` carries seed material in its query string when a player follows a
 * link from their own bet history, and `/profile` is a personal page — neither
 * belongs in an index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/profile', '/verify'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

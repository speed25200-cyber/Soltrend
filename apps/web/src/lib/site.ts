/**
 * Where this build is served from.
 *
 * Metadata, the sitemap and robots all need an absolute origin, and a static
 * export has no request to infer one from — so it comes from the environment,
 * with the GitHub Pages deployment as the default.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://speed25200-cyber.github.io/Soltrend').replace(/\/$/, '');

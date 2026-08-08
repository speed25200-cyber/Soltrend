/**
 * Site map — the single source of truth for navigation.
 *
 * The site had grown to seven flat top-level items whose meanings overlapped
 * (Lobby / Discover / Floor were three ways to browse games; Live and Duel were
 * both realtime; Vault and Rewards were both "earn"), while the pages that
 * actually mattered — the staking vaults and the profile — were reachable only
 * from a card buried on another page. Desktop and mobile also showed different
 * items, so the two had different mental models.
 *
 * This collapses it to five destinations named after what the player wants to
 * DO. Everything else becomes a tab inside the destination it belongs to, so no
 * page is more than two clicks away and the sub-navigation is always visible.
 */

export interface NavChild {
  href: string;
  label: string;
  hint?: string;
}

export interface NavSection {
  href: string;
  label: string;
  /** Icon key rendered by AppShell. */
  icon: 'play' | 'live' | 'create' | 'earn' | 'you';
  /** Routes that belong to this section — shown as tabs, and used to light
   *  the primary item when the player is on a child page. */
  children: NavChild[];
  /** Extra routes owned by this section that shouldn't get a tab of their own
   *  (detail pages), but should still highlight the parent. */
  owns?: string[];
}

export const SECTIONS: NavSection[] = [
  {
    href: '/',
    label: 'Play',
    icon: 'play',
    children: [
      { href: '/', label: 'Lobby', hint: 'Originals, worlds and trending games' },
      { href: '/daily', label: 'Daily', hint: "Today's Nexus — same map for everyone, free" },
      { href: '/discover', label: 'Community', hint: 'Everything the community has built' },
      { href: '/floor', label: 'The Floor', hint: 'A spatial view you can walk' },
      { href: '/leaderboard', label: 'Ranks', hint: 'Top players and creators' },
    ],
    owns: ['/play', '/creator'],
  },
  {
    href: '/live',
    label: 'Live',
    icon: 'live',
    children: [
      { href: '/live', label: 'Crash', hint: 'Shared rooms, one rocket' },
      { href: '/duel', label: 'Duels', hint: '1v1 and the shared jackpot' },
    ],
  },
  {
    href: '/studio',
    label: 'Create',
    icon: 'create',
    children: [
      { href: '/studio', label: 'Studio', hint: 'Build a game' },
      { href: '/studio/games', label: 'My games', hint: 'Edit, unpublish and claim royalties' },
      { href: '/market', label: 'Assets', hint: 'Symbol packs and node modules' },
    ],
    owns: ['/forge', '/worlds', '/arcade'],
  },
  {
    href: '/vault',
    label: 'Earn',
    icon: 'earn',
    children: [
      { href: '/vault', label: 'Vaults', hint: 'Stake SOL and be the house' },
      { href: '/rewards', label: 'Rewards', hint: 'Missions, level and the jackpot' },
    ],
  },
  {
    href: '/profile',
    label: 'You',
    icon: 'you',
    children: [
      { href: '/profile', label: 'Profile', hint: 'Stats, creator dashboard, limits' },
      { href: '/verify', label: 'Verify', hint: 'Check any bet was provably fair' },
    ],
  },
];

/** Routes that render their own immersive UI and should not show section tabs. */
const IMMERSIVE = ['/play/'];

export function sectionFor(pathname: string): NavSection | undefined {
  // Most specific match wins, so '/' doesn't swallow every route.
  let best: NavSection | undefined;
  let bestLen = -1;
  for (const s of SECTIONS) {
    const routes = [s.href, ...s.children.map((c) => c.href), ...(s.owns ?? [])];
    for (const r of routes) {
      const hit = r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(r + '/') || pathname.startsWith(r);
      if (hit && r.length > bestLen) {
        best = s;
        bestLen = r.length;
      }
    }
  }
  return best;
}

export const showsTabs = (pathname: string) => !IMMERSIVE.some((p) => pathname.startsWith(p));

/**
 * Tabs match exactly. Nesting matters here: '/studio/games' must light only the
 * "My games" tab, not "Studio" as well, so a prefix match would be wrong.
 */
export const isChildActive = (pathname: string, href: string) => pathname === href;

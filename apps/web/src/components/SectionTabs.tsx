'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isChildActive, sectionFor, showsTabs } from '@/lib/nav';

/**
 * Sub-navigation for the current section. Rendered once by AppShell, so every
 * page inherits it and the player can always see the whole of the area they are
 * in — the fix for pages that used to be reachable only from a card somewhere
 * else. Sections with a single page render nothing.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const section = sectionFor(pathname);

  if (!section || !showsTabs(pathname) || section.children.length < 2) return null;

  return (
    <nav aria-label={`${section.label} sections`} className="mb-5 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {section.children.map((c) => {
        const active = isChildActive(pathname, c.href);
        return (
          <Link
            key={c.href}
            href={c.href}
            title={c.hint}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-white/[0.08] text-white ring-1 ring-white/10'
                : 'text-slate-400 hover:bg-white/[0.03] hover:text-white'
            }`}
          >
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}

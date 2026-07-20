'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { ConnectButton } from './ConnectButton';
import { BalanceWidget } from './BalanceWidget';
import { AgeGate } from './AgeGate';
import { GeoNotice } from './GeoNotice';

const NAV = [
  { href: '/', label: 'Lobby', icon: LobbyIcon },
  { href: '/discover', label: 'Discover', icon: DiscoverIcon },
  { href: '/studio', label: 'Create', icon: CreateIcon },
  { href: '/leaderboard', label: 'Ranks', icon: RankIcon },
  { href: '/profile', label: 'Profile', icon: ProfileIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="min-h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-void-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="hidden font-display text-lg font-bold tracking-tight text-white sm:block">
              Sol<span className="neon-text">trend</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.slice(0, 4).map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive(n.href) ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <BalanceWidget />
            <ConnectButton />
          </div>
        </div>
      </header>

      <GeoNotice />

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:pb-16">{children}</main>

      {/* Bottom nav (mobile-first) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] bg-void-950/85 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((n) => {
            const active = isActive(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="relative flex flex-col items-center gap-1 py-2.5"
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-neon-violet to-neon-magenta shadow-glow-violet" />
                )}
                <Icon active={active} />
                <span className={`text-[0.62rem] font-semibold ${active ? 'text-white' : 'text-slate-500'}`}>
                  {n.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AgeGate />
    </div>
  );
}

function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-violet via-neon-purple to-neon-magenta shadow-glow-violet">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" fill="#fff" />
      </svg>
    </span>
  );
}

/* --- icons --- */
type IconP = { active?: boolean };
const c = (a?: boolean) => (a ? '#fff' : '#64748b');
function LobbyIcon({ active }: IconP) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke={c(active)} strokeWidth="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" stroke={c(active)} strokeWidth="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke={c(active)} strokeWidth="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" stroke={c(active)} strokeWidth="2" />
    </svg>
  );
}
function DiscoverIcon({ active }: IconP) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c(active)} strokeWidth="2" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" stroke={c(active)} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function CreateIcon({ active }: IconP) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={active ? 'url(#cg)' : 'none'} stroke={c(active)} strokeWidth="2" />
      <path d="M12 8v8M8 12h8" stroke={active ? '#fff' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="cg" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#a855f7" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>
    </svg>
  );
}
function RankIcon({ active }: IconP) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4v-8H4zM10 20h4V4h-4zM16 20h4v-11h-4z" stroke={c(active)} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function ProfileIcon({ active }: IconP) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={c(active)} strokeWidth="2" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke={c(active)} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

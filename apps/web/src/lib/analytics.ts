'use client';

/**
 * Engagement instrumentation — the measurement side of "is it fun?".
 *
 * Every settled round flows through one seam (`usePlay.settle`), so one
 * `track()` call there captures the whole floor: game, stake, multiplier,
 * outcome, demo/real, plus session identity and timing. Events land in a
 * local ring buffer so the data exists from the very first player; if
 * NEXT_PUBLIC_ANALYTICS_ENDPOINT is set at build time they are also
 * beaconed out in small batches. No third-party SDK, nothing blocking,
 * nothing personally identifying — a session id and gameplay facts.
 */

const KEY = 'soltrend-analytics-v1';
const MAX_EVENTS = 500;
const ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;

export interface AnalyticsEvent {
  /** epoch ms */
  t: number;
  /** event name */
  e: string;
  /** session id — new per tab lifetime */
  sid: string;
  p?: Record<string, unknown>;
}

interface AnalyticsState {
  events: AnalyticsEvent[];
  /** epoch ms of the previous visit's last event — return-visit detection */
  lastSeen: number;
  visits: number;
}

let sessionId: string | null = null;
let pending: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const now = () => Date.now();

function load(): AnalyticsState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AnalyticsState;
  } catch {
    /* corrupted or unavailable storage never breaks gameplay */
  }
  return { events: [], lastSeen: 0, visits: 0 };
}

function save(s: AnalyticsState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota — drop silently, the game matters more than its telemetry */
  }
}

function beacon() {
  if (!ENDPOINT || pending.length === 0) return;
  try {
    const batch = JSON.stringify(pending);
    pending = [];
    navigator.sendBeacon?.(ENDPOINT, batch);
  } catch {
    /* endpoints come and go; play on */
  }
}

/** Record one engagement event. Safe to call anywhere client-side. */
export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const s = load();
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2, 10) + now().toString(36);
    const returning = s.lastSeen > 0;
    const away = returning ? now() - s.lastSeen : 0;
    s.visits += 1;
    s.events.push({ t: now(), e: 'session_start', sid: sessionId, p: { visit: s.visits, returning, awayMs: away } });
  }
  const ev: AnalyticsEvent = { t: now(), e: event, sid: sessionId, p: props };
  s.events.push(ev);
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
  s.lastSeen = now();
  save(s);
  if (ENDPOINT) {
    pending.push(ev);
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        beacon();
      }, 4000);
    }
  }
}

/** The local event log — powering any future engagement dashboard. */
export function readAnalytics(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  return load().events;
}

/** Session summary: rounds, wagered, net, span — the addictiveness raw feed. */
export function sessionSummary() {
  const events = readAnalytics();
  const sid = sessionId;
  const mine = sid ? events.filter((e) => e.sid === sid) : [];
  const rounds = mine.filter((e) => e.e === 'round');
  const wagered = rounds.reduce((a, e) => a + (Number(e.p?.bet) || 0), 0);
  const paid = rounds.reduce((a, e) => a + (Number(e.p?.payout) || 0), 0);
  const span = mine.length > 1 ? mine[mine.length - 1].t - mine[0].t : 0;
  return { rounds: rounds.length, wagered, paid, net: paid - wagered, spanMs: span };
}

'use client';

/**
 * Client-side "hot balance" + session state + community progression.
 *
 * In production the balance lives in the House Vault on Solana (see
 * /programs/house_vault) and bets settle on-chain. For this reference build we
 * model the exact same flow against a local hot-balance so the whole community
 * loop — play, level up, complete missions, feed the jackpot, earn creator
 * royalties — is fully playable on devnet-style demo funds.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createServerSeed, randomHex, sha256Hex } from './provably-fair';
import type { Template } from './games';
import type { IconName } from '@/components/Icon';
import {
  ACHIEVEMENTS,
  DAILY_MISSIONS,
  JACKPOT_BASE_CHANCE,
  JACKPOT_CONTRIB,
  levelFromXp,
  xpForBet,
  type Metric,
} from './progression';

export interface BetRecord {
  id: string;
  game: string;
  template: Template;
  bet: number;
  multiplier: number;
  payout: number;
  win: boolean;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  meta?: Record<string, unknown>;
  ts: number;
}

export interface UgcGame {
  id: string;
  name: string;
  template: Template;
  creator: string;
  edge: number;
  params: Record<string, number | string>;
  theme: { accent: string; icon: IconName; aura?: string; tagline?: string };
  volume: number;
  players: number;
  plays: number;
  rating: number;
  createdAt: number;
  featured?: boolean;
  mine?: boolean;
  specHash?: string;
}

export interface RgLimits {
  maxBet: number | null;
  dailyLossLimit: number | null;
  sessionMinutes: number | null;
  selfExcludedUntil: number | null;
}

interface SeedState {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface DailyState {
  day: string;
  bets: number;
  wins: number;
  wagered: number;
  games: string[];
  cashouts: number;
  claimed: string[];
}

export interface Progress {
  xp: number;
  totalBets: number;
  wageredTotal: number;
  bestMultiplier: number;
  gamesTried: string[];
  publishedCount: number;
  streak: number;
  lastDailyClaim: string;
  daily: DailyState;
  achievements: string[];
  claimedRoyalties: number;
  referralCode: string;
  referredBy?: string;
}

export interface JackpotWin {
  user: string;
  amount: number;
  ts: number;
}

export interface ProgressEvents {
  gainedXp: number;
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
  unlocked: string[];
  jackpotWon: number;
}

interface CasinoState {
  balance: number;
  ageVerified: boolean;
  soundOn: boolean;
  seeds: SeedState;
  history: BetRecord[];
  rg: RgLimits;
  sessionLossToday: number;
  lossDay: string;
  ugc: UgcGame[];
  progress: Progress;
  jackpot: number;
  jackpotWins: JackpotWin[];

  setAgeVerified: (v: boolean) => void;
  setSoundOn: (v: boolean) => void;
  deposit: (amt: number) => void;
  withdraw: (amt: number) => void;

  setClientSeed: (s: string) => void;
  rotateSeeds: () => void;
  nextNonce: () => SeedState;

  settleBet: (
    r: Omit<BetRecord, 'id' | 'ts' | 'serverSeed' | 'serverSeedHash' | 'clientSeed' | 'nonce'> & {
      seeds: SeedState;
    },
  ) => void;

  /** Award XP / missions / jackpot for a settled bet; returns celebratory events. */
  recordProgress: (a: { bet: number; win: boolean; payout: number; key: string }) => ProgressEvents;
  claimDaily: () => number;
  claimMission: (id: string) => void;
  claimRoyalties: () => number;
  setReferredBy: (code: string) => void;

  setRg: (patch: Partial<RgLimits>) => void;
  publishUgc: (g: Omit<UgcGame, 'id' | 'createdAt' | 'volume' | 'players' | 'plays' | 'rating'>) => UgcGame;
  bumpUgc: (id: string, wagered: number) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const yesterdayOf = (d: string) => new Date(new Date(d).getTime() - 86400000).toISOString().slice(0, 10);

const seedInit = (): SeedState => {
  const { serverSeed, serverSeedHash } = createServerSeed();
  return { serverSeed, serverSeedHash, clientSeed: randomHex(8), nonce: 0 };
};

const freshDaily = (d: string): DailyState => ({
  day: d,
  bets: 0,
  wins: 0,
  wagered: 0,
  games: [],
  cashouts: 0,
  claimed: [],
});

const progressInit = (): Progress => ({
  xp: 0,
  totalBets: 0,
  wageredTotal: 0,
  bestMultiplier: 0,
  gamesTried: [],
  publishedCount: 0,
  streak: 0,
  lastDailyClaim: '',
  daily: freshDaily(today()),
  achievements: [],
  claimedRoyalties: 0,
  referralCode: randomHex(3).toUpperCase(),
});

export const metricValue = (d: DailyState, m: Metric): number => {
  if (m === 'games') return d.games.length;
  return (d as any)[m] ?? 0;
};

export const creatorEarnings = (ugc: UgcGame[]): number =>
  round4(ugc.reduce((s, g) => s + (g.mine ? g.volume * g.edge * 0.3 : 0), 0));

export const seededUgc = (): UgcGame[] => [
  {
    id: 'ugc-neon-dice',
    name: 'Neon Overdrive',
    template: 'dice',
    creator: 'CryptoWizard',
    edge: 0.01,
    params: { target: 50, over: 1 },
    theme: { accent: 'violet', icon: 'dice', tagline: 'Pure adrenaline, every roll' },
    volume: 184203,
    players: 2841,
    plays: 51204,
    rating: 4.8,
    createdAt: Date.now() - 86400000 * 5,
    featured: true,
  },
  {
    id: 'ugc-moon-limbo',
    name: 'Moonshot',
    template: 'limbo',
    creator: 'DegenKing',
    edge: 0.02,
    params: { target: 2 },
    theme: { accent: 'cyan', icon: 'trend', tagline: 'Aim high, or go home' },
    volume: 142980,
    players: 1920,
    plays: 38210,
    rating: 4.6,
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'ugc-diamond-mines',
    name: 'Diamond Depths',
    template: 'mines',
    creator: 'GemHunter',
    edge: 0.015,
    params: { grid: 25, bombs: 3 },
    theme: { accent: 'gold', icon: 'gem', tagline: 'How deep will you dig?' },
    volume: 98120,
    players: 1502,
    plays: 24012,
    rating: 4.9,
    createdAt: Date.now() - 86400000 * 9,
  },
];

export const useCasino = create<CasinoState>()(
  persist(
    (set, get) => ({
      balance: 5,
      ageVerified: false,
      soundOn: true,
      seeds: seedInit(),
      history: [],
      rg: { maxBet: null, dailyLossLimit: null, sessionMinutes: null, selfExcludedUntil: null },
      sessionLossToday: 0,
      lossDay: today(),
      ugc: seededUgc(),
      progress: progressInit(),
      jackpot: 12.84,
      jackpotWins: [],

      setAgeVerified: (v) => set({ ageVerified: v }),
      setSoundOn: (v) => set({ soundOn: v }),
      deposit: (amt) => set((s) => ({ balance: round4(s.balance + amt) })),
      withdraw: (amt) => set((s) => ({ balance: round4(Math.max(0, s.balance - amt)) })),

      setClientSeed: (clientSeed) => set((s) => ({ seeds: { ...s.seeds, clientSeed } })),
      rotateSeeds: () =>
        set((s) => {
          const { serverSeed, serverSeedHash } = createServerSeed();
          return { seeds: { ...s.seeds, serverSeed, serverSeedHash, nonce: 0 } };
        }),
      nextNonce: () => {
        const s = get();
        const seeds = { ...s.seeds, nonce: s.seeds.nonce + 1 };
        set({ seeds });
        return seeds;
      },

      settleBet: ({ seeds, ...rest }) =>
        set((s) => {
          const d = today();
          const lossReset = s.lossDay !== d;
          const net = rest.payout - rest.bet;
          const record: BetRecord = {
            ...rest,
            id: randomHex(6),
            ts: Date.now(),
            serverSeed: seeds.serverSeed,
            serverSeedHash: seeds.serverSeedHash,
            clientSeed: seeds.clientSeed,
            nonce: seeds.nonce,
          };
          return {
            balance: round4(s.balance - rest.bet + rest.payout),
            history: [record, ...s.history].slice(0, 200),
            lossDay: d,
            sessionLossToday: Math.max(0, (lossReset ? 0 : s.sessionLossToday) - net),
          };
        }),

      recordProgress: ({ bet, win, payout, key }) => {
        const events: ProgressEvents = {
          gainedXp: 0,
          leveledUp: false,
          fromLevel: 1,
          toLevel: 1,
          unlocked: [],
          jackpotWon: 0,
        };
        set((s) => {
          const p = s.progress;
          const d = today();
          const daily = p.daily.day === d ? { ...p.daily } : freshDaily(d);

          const gainedXp = xpForBet(bet);
          const beforeLevel = levelFromXp(p.xp).level;
          const xp = p.xp + gainedXp;
          const afterLevel = levelFromXp(xp).level;

          daily.bets += 1;
          if (win) daily.wins += 1;
          daily.wagered = round4(daily.wagered + bet);
          if (!daily.games.includes(key)) daily.games = [...daily.games, key];

          const gamesTried = p.gamesTried.includes(key) ? p.gamesTried : [...p.gamesTried, key];
          const mult = win && bet > 0 ? payout / bet : 0;
          const bestMultiplier = Math.max(p.bestMultiplier, mult);
          const totalBets = p.totalBets + 1;
          const wageredTotal = round4(p.wageredTotal + bet);

          // Community jackpot: grows with every wager, rare bonus trigger.
          let jackpot = round4(s.jackpot + bet * JACKPOT_CONTRIB);
          let jackpotWon = 0;
          let jackpotWins = s.jackpotWins;
          const chance = JACKPOT_BASE_CHANCE * Math.min(25, 1 + bet * 6);
          if (Math.random() < chance && jackpot > 0.5) {
            jackpotWon = jackpot;
            jackpotWins = [{ user: 'You', amount: jackpot, ts: Date.now() }, ...jackpotWins].slice(0, 12);
            jackpot = 0.5;
          }

          const stats = {
            totalBets,
            wageredTotal,
            bestMultiplier,
            gamesTried: gamesTried.length,
            publishedGames: p.publishedCount,
            level: afterLevel,
          };
          const unlocked = ACHIEVEMENTS.filter(
            (a) => !p.achievements.includes(a.id) && a.test(stats),
          ).map((a) => a.id);
          const achievements = unlocked.length ? [...p.achievements, ...unlocked] : p.achievements;

          events.gainedXp = gainedXp;
          events.fromLevel = beforeLevel;
          events.toLevel = afterLevel;
          events.leveledUp = afterLevel > beforeLevel;
          events.unlocked = unlocked;
          events.jackpotWon = jackpotWon;

          return {
            progress: { ...p, xp, totalBets, wageredTotal, bestMultiplier, gamesTried, daily, achievements },
            jackpot,
            jackpotWins,
            balance: jackpotWon ? round4(s.balance + jackpotWon) : s.balance,
          };
        });
        return events;
      },

      claimDaily: () => {
        const s = get();
        const d = today();
        if (s.progress.lastDailyClaim === d) return 0;
        const streak = s.progress.lastDailyClaim === yesterdayOf(d) ? s.progress.streak + 1 : 1;
        const bonus = round4(0.1 * Math.min(7, streak));
        set({ balance: round4(s.balance + bonus), progress: { ...s.progress, lastDailyClaim: d, streak } });
        return bonus;
      },

      claimMission: (id) =>
        set((s) => {
          const def = DAILY_MISSIONS.find((m) => m.id === id);
          if (!def) return {};
          const d = today();
          const daily = s.progress.daily.day === d ? s.progress.daily : freshDaily(d);
          if (daily.claimed.includes(id) || metricValue(daily, def.metric) < def.goal) return {};
          return {
            balance: round4(s.balance + def.reward),
            progress: { ...s.progress, daily: { ...daily, claimed: [...daily.claimed, id] } },
          };
        }),

      claimRoyalties: () => {
        const s = get();
        const earnings = creatorEarnings(s.ugc);
        const claimable = round4(earnings - s.progress.claimedRoyalties);
        if (claimable <= 0) return 0;
        set({ balance: round4(s.balance + claimable), progress: { ...s.progress, claimedRoyalties: earnings } });
        return claimable;
      },

      setReferredBy: (code) =>
        set((s) =>
          s.progress.referredBy || !code || code === s.progress.referralCode
            ? {}
            : { progress: { ...s.progress, referredBy: code } },
        ),

      setRg: (patch) => set((s) => ({ rg: { ...s.rg, ...patch } })),

      publishUgc: (g) => {
        const game: UgcGame = {
          ...g,
          id: 'ugc-' + randomHex(4),
          specHash: sha256Hex(JSON.stringify({ t: g.template, e: g.edge, p: g.params, n: g.name })),
          mine: true,
          createdAt: Date.now(),
          volume: 0,
          players: 0,
          plays: 0,
          rating: 0,
        };
        set((s) => {
          const publishedCount = s.progress.publishedCount + 1;
          const unlocked = ACHIEVEMENTS.filter(
            (a) => a.id === 'creator' && !s.progress.achievements.includes(a.id),
          ).map((a) => a.id);
          return {
            ugc: [game, ...s.ugc],
            progress: {
              ...s.progress,
              publishedCount,
              achievements: [...s.progress.achievements, ...unlocked],
            },
          };
        });
        return game;
      },
      bumpUgc: (id, wagered) =>
        set((s) => ({
          ugc: s.ugc.map((g) =>
            g.id === id ? { ...g, volume: round4(g.volume + wagered), plays: g.plays + 1 } : g,
          ),
        })),
    }),
    {
      name: 'soltrend-casino-v2',
      partialize: (s) => ({
        balance: s.balance,
        ageVerified: s.ageVerified,
        soundOn: s.soundOn,
        seeds: s.seeds,
        history: s.history,
        rg: s.rg,
        sessionLossToday: s.sessionLossToday,
        lossDay: s.lossDay,
        ugc: s.ugc,
        progress: s.progress,
        jackpot: s.jackpot,
        jackpotWins: s.jackpotWins,
      }),
    },
  ),
);

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

export { sha256Hex };

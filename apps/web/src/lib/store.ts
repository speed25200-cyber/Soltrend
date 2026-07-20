'use client';

/**
 * Client-side "hot balance" + session state.
 *
 * In production the balance lives in the House Vault on Solana (see
 * /programs/house_vault) and bets settle on-chain. For this reference build we
 * model the exact same flow against a local hot-balance so the UX — deposit
 * once, play many bets without signing each one (§4.4) — is fully playable on
 * devnet-style demo funds. Swapping `settleBet` for a program call is the only
 * change needed to go on-chain.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createServerSeed, randomHex, sha256Hex } from './provably-fair';
import type { Template } from './games';

export interface BetRecord {
  id: string;
  game: string;
  template: Template;
  bet: number;
  multiplier: number;
  payout: number;
  win: boolean;
  serverSeed: string; // revealed only after rotation in real life; kept for demo verify
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
  theme: { accent: string; emoji: string };
  volume: number;
  players: number;
  plays: number;
  rating: number;
  createdAt: number;
  featured?: boolean;
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

interface CasinoState {
  balance: number;
  ageVerified: boolean;
  seeds: SeedState;
  history: BetRecord[];
  rg: RgLimits;
  sessionLossToday: number;
  lossDay: string;
  ugc: UgcGame[];

  setAgeVerified: (v: boolean) => void;
  deposit: (amt: number) => void;
  withdraw: (amt: number) => void;

  setClientSeed: (s: string) => void;
  rotateSeeds: () => void;
  nextNonce: () => SeedState;

  /** Atomic settlement: debits the bet, credits the payout, records history. */
  settleBet: (r: Omit<BetRecord, 'id' | 'ts' | 'serverSeed' | 'serverSeedHash' | 'clientSeed' | 'nonce'> & {
    seeds: SeedState;
  }) => void;

  setRg: (patch: Partial<RgLimits>) => void;
  publishUgc: (g: Omit<UgcGame, 'id' | 'createdAt' | 'volume' | 'players' | 'plays' | 'rating'>) => UgcGame;
  bumpUgc: (id: string, wagered: number) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const seedInit = (): SeedState => {
  const { serverSeed, serverSeedHash } = createServerSeed();
  return { serverSeed, serverSeedHash, clientSeed: randomHex(8), nonce: 0 };
};

export const seededUgc = (): UgcGame[] => [
  {
    id: 'ugc-neon-dice',
    name: 'Neon Overdrive',
    template: 'dice',
    creator: 'CryptoWizard',
    edge: 0.01,
    params: { target: 50, over: 1 },
    theme: { accent: 'violet', emoji: '🎲' },
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
    theme: { accent: 'cyan', emoji: '🚀' },
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
    theme: { accent: 'gold', emoji: '💎' },
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
      seeds: seedInit(),
      history: [],
      rg: { maxBet: null, dailyLossLimit: null, sessionMinutes: null, selfExcludedUntil: null },
      sessionLossToday: 0,
      lossDay: today(),
      ugc: seededUgc(),

      setAgeVerified: (v) => set({ ageVerified: v }),
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

      setRg: (patch) => set((s) => ({ rg: { ...s.rg, ...patch } })),

      publishUgc: (g) => {
        const game: UgcGame = {
          ...g,
          id: 'ugc-' + randomHex(4),
          createdAt: Date.now(),
          volume: 0,
          players: 0,
          plays: 0,
          rating: 0,
        };
        set((s) => ({ ugc: [game, ...s.ugc] }));
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
      name: 'soltrend-casino',
      partialize: (s) => ({
        balance: s.balance,
        ageVerified: s.ageVerified,
        seeds: s.seeds,
        history: s.history,
        rg: s.rg,
        sessionLossToday: s.sessionLossToday,
        lossDay: s.lossDay,
        ugc: s.ugc,
      }),
    },
  ),
);

function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

export { sha256Hex };

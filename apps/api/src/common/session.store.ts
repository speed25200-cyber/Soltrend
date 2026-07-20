import { Injectable } from '@nestjs/common';
import { createServerSeed, randomHex } from '@soltrend/shared';

export interface SeedSnapshot {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface Session {
  id: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  /** Set after a rotation so past bets can be independently verified. */
  previous?: { serverSeed: string; serverSeedHash: string; finalNonce: number };
}

/**
 * In-memory session + seed registry. This is deliberately behind a tiny
 * interface: swap it for Redis/Postgres in production without touching the
 * services. The important property is that the SERVER holds the server seed and
 * only ever exposes its hash until a rotation reveals it — that's what makes the
 * fairness guarantee server-authoritative rather than client-trusted.
 */
@Injectable()
export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  getOrCreate(id: string, clientSeed?: string): Session {
    let s = this.sessions.get(id);
    if (!s) {
      const { serverSeed, serverSeedHash } = createServerSeed();
      s = { id, serverSeed, serverSeedHash, clientSeed: clientSeed || randomHex(8), nonce: 0 };
      this.sessions.set(id, s);
    } else if (clientSeed) {
      s.clientSeed = clientSeed;
    }
    return s;
  }

  setClientSeed(id: string, clientSeed: string): Session {
    const s = this.getOrCreate(id);
    s.clientSeed = clientSeed;
    return s;
  }

  /** Reserve the next nonce for a bet and return the immutable snapshot used. */
  reserve(id: string): SeedSnapshot {
    const s = this.getOrCreate(id);
    s.nonce += 1;
    return {
      serverSeed: s.serverSeed,
      serverSeedHash: s.serverSeedHash,
      clientSeed: s.clientSeed,
      nonce: s.nonce,
    };
  }

  /** Rotate the server seed, revealing the previous one. */
  rotate(id: string): { revealed: Session['previous']; serverSeedHash: string } {
    const s = this.getOrCreate(id);
    const revealed = { serverSeed: s.serverSeed, serverSeedHash: s.serverSeedHash, finalNonce: s.nonce };
    const { serverSeed, serverSeedHash } = createServerSeed();
    s.serverSeed = serverSeed;
    s.serverSeedHash = serverSeedHash;
    s.nonce = 0;
    s.previous = revealed;
    return { revealed, serverSeedHash };
  }

  peek(id: string): Session {
    return this.getOrCreate(id);
  }
}

import { Injectable } from '@nestjs/common';
import { sha256Hex, firstFloat, type Template } from '@soltrend/shared';
import { SessionStore } from '../common/session.store';
import { computeOutcome } from '../games/outcome';

/**
 * Provably-fair service (§4.3). The server owns the server seed and only ever
 * exposes its hash until a rotation reveals it, at which point any past bet can
 * be replayed and checked. `verify` reproduces a result purely from the seeds.
 */
@Injectable()
export class FairService {
  constructor(private readonly store: SessionStore) {}

  current(sessionId: string, clientSeed?: string) {
    const s = this.store.getOrCreate(sessionId, clientSeed);
    return { serverSeedHash: s.serverSeedHash, clientSeed: s.clientSeed, nonce: s.nonce };
  }

  setClientSeed(sessionId: string, clientSeed: string) {
    const s = this.store.setClientSeed(sessionId, clientSeed);
    return { serverSeedHash: s.serverSeedHash, clientSeed: s.clientSeed, nonce: s.nonce };
  }

  rotate(sessionId: string) {
    const { revealed, serverSeedHash } = this.store.rotate(sessionId);
    return {
      revealed: {
        serverSeed: revealed!.serverSeed,
        serverSeedHash: revealed!.serverSeedHash,
        finalNonce: revealed!.finalNonce,
        hashCheck: sha256Hex(revealed!.serverSeed) === revealed!.serverSeedHash,
      },
      newServerSeedHash: serverSeedHash,
    };
  }

  /** Recompute a bet from revealed seeds — the client-verifiable proof. */
  verify(input: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    template: Template;
    bet?: number;
    params?: Record<string, any>;
    edge?: number;
    expectedHash?: string;
  }) {
    const seeds = {
      serverSeed: input.serverSeed,
      serverSeedHash: sha256Hex(input.serverSeed),
      clientSeed: input.clientSeed,
      nonce: input.nonce,
    };
    const outcome = computeOutcome(
      input.template,
      input.params ?? {},
      input.edge ?? 0.01,
      input.bet ?? 1,
      seeds,
    );
    return {
      serverSeedHash: seeds.serverSeedHash,
      hashMatches: input.expectedHash ? seeds.serverSeedHash === input.expectedHash : null,
      float: firstFloat(input.serverSeed, input.clientSeed, input.nonce),
      outcome,
    };
  }
}

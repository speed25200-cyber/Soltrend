/**
 * @soltrend/shared — the single source of truth for provably-fair math and the
 * GameSpec contract, shared across the web client, the API/settlement service,
 * and any third-party verifier. Because settlement parity depends on byte-exact
 * reproduction, these modules are dependency-free and deterministic.
 */
export * from './sha256';
export * from './provably-fair';
export * from './games';
export * from './gamespec';

/** A settled bet as recorded off-chain and mirrored by the on-chain event. */
export interface BetResult {
  game: string;
  template: import('./games').Template;
  bet: number;
  multiplier: number;
  payout: number;
  win: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

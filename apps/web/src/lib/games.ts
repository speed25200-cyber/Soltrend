/**
 * The game engine — re-exported, not reimplemented.
 *
 * This file used to be a copy of `packages/shared/src/games.ts`, and the two
 * drifted: the client was fixed to solve Plinko's payout tables for an exact
 * edge while the settlement service kept the hand-written ones, whose real
 * edges ran from 0.9% to 38%. A client and a server that disagree about a
 * payout is the end of any "provably fair" claim, so there is now exactly one
 * copy and everything imports it.
 */
export * from '@soltrend/shared/games';

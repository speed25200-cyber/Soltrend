# house_vault — audit checklist

The program implements the zero-house-capital model (see `docs/TOKENOMICS.md`):
per-game bankroll pools funded by community stakers, a staker-favoured edge split,
and a bankroll-relative payout cap. **It is unaudited.** This checklist is the
spec an external auditor should verify before mainnet.

## Security invariants

1. **Pool isolation.** Each game's bankroll is its own program-owned `GamePool`
   account holding its own lamports. A `settle_bet` can only debit the pool passed
   in, and the pool PDA is derived from `game.key()` — one game can never pay from
   another's bankroll. Verify the `seeds = [b"pool", game.key()]` constraint and
   the `has_one`/`address` checks tying `game`↔`pool`↔`creator`.

2. **Bankroll cap.** In `settle_bet`, `payout * RUIN_K ≤ bankroll` where
   `bankroll = pool.lamports() − rent`, measured **before** the player's bet is
   added. Also `payout ≤ config.max_payout_lamports`. Confirm the ordering
   (bankroll read before the inbound transfer) and the u128 math can't overflow.

3. **Edge band.** `register_game` clamps `edge_bps ∈ [min_edge_bps, max_edge_bps]`,
   and `max_edge_bps ≤ 2000` (20%) is enforced at `init_config`.

4. **Pro-rata shares (ERC-4626 style).** `stake` mints
   `shares = amount · total_shares / pool_value` (or `amount` for the first
   staker); `unstake` returns `shares · pool_value / total_shares`. Verify:
   rounding always favours the pool (integer division), a zero-share mint is
   rejected (`ZeroShares`), and `unstake` can't take a pool below rent-exemption.
   Check first-deposit share-inflation / donation attacks (a griefer donating
   lamports to the pool before the first stake to skew `pool_value`).

5. **Split conservation.** `RevenueSplit` sums to 10 000 bps. Only the non-staker
   cuts (`creator + platform + insurance`) physically leave the pool into the
   treasury; the staker share (`bankroll_bps`) is the residual kept as yield.
   Confirm `skim ≤ pool balance − rent` at settle time so a skim can't undercut
   solvency, and that treasury accounting (`platform_accrued`, `insurance_accrued`,
   `creator_vault.accrued`) matches lamports actually moved.

6. **KYC-gated claims.** `claim_royalties` requires `creator_vault.kyc_verified`.
   `claim_platform` is admin-only (`has_one = admin`). Both debit the treasury and
   respect rent-exemption.

7. **Authority.** `set_kyc`, `set_paused`, `claim_platform` are `has_one = admin`.
   `unstake` / `claim_royalties` are gated by `has_one = owner` on the position /
   creator vault. Verify no instruction lets a non-owner move another's funds.

8. **Pause.** `settle_bet` checks `!config.paused`. Consider whether `unstake`
   should remain enabled while paused (recommended: yes, so stakers can always
   exit) — document the decision.

## Lamport-safety notes for the auditor

- All pool/treasury debits use direct `try_borrow_mut_lamports` (the program owns
  these accounts). Inbound player/staker funds use `system_program::transfer`
  (those sources are system-owned). Confirm no path attempts a system transfer
  *from* a program-owned account.
- `settle_bet` performs, in order: read bankroll → cap checks → pull bet in → pay
  player → skim to treasury → accrue. Re-verify the pool can always cover
  `payout + skim + rent` given the cap.

## Not covered on-chain (by design)

- **Outcome integrity** — `payout_multiplier_bps` is computed off-chain from the
  provably-fair stream / VRF. The commit-reveal / VRF proof must be validated
  before this instruction is trusted (out of scope for this program; see the
  fairness service). An auditor should confirm the calling authority is
  constrained so a malicious caller can't pass an arbitrary multiplier.
- **Geo / KYC / RG** — enforced at the app + compliance layer.

## Test coverage

`tests/house_vault.ts` exercises: config + split validation, game+pool
registration, edge-band rejection, staking (share mint), the bankroll-cap
rejection, a settled bet with edge skim, KYC-gated royalty claim, and unstake.
Run against a local validator with `anchor test`. Property/fuzz tests for the
share math and the cap arithmetic are recommended before audit sign-off.

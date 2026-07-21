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

2. **Bankroll cap + liability reservation.** Bets are two-phase. `open_bet`
   reserves `max_payout` against `pool.locked` and requires
   `max_payout * RUIN_K ≤ free` where `free = pool.lamports() − rent − pool.locked`
   (and `max_payout ≤ config.max_payout_lamports`), so concurrent open bets can
   never over-commit the bankroll. `settle_bet` requires `payout ≤ bet.max_payout`
   and releases the reservation. Verify `locked` is always incremented on open and
   decremented on exactly one of settle/cancel (no double-release, no leak).

2b. **Settlement authorisation + commit-reveal (the critical control).** Only
   `config.settlement_authority` may call `settle_bet` (`has_one`), closing the
   previous hole where anyone could pass an arbitrary multiplier and drain a pool.
   The instruction verifies `sha256(server_seed) == bet.server_seed_hash`, so the
   outcome is bound to a seed fixed at `open_bet` (published by the fairness
   service beforehand) — the authority cannot grind it, and `client_seed` is
   player-chosen. The revealed seed + multiplier are emitted for public
   verification. `cancel_bet` lets the player reclaim funds after
   `SETTLE_TIMEOUT_SLOTS` if the authority withholds. **Auditor:** confirm the
   authority cannot pay to an address other than `bet.player`, cannot settle
   twice (the Bet account is `close`d), and that a compromised authority is bounded
   to `bet.max_payout` per bet (it cannot mint beyond the reserved liability).

3. **Edge band.** `register_game` clamps `edge_bps ∈ [min_edge_bps, max_edge_bps]`,
   and `max_edge_bps ≤ 2000` (20%) is enforced at `init_config`.

4. **Pro-rata shares (ERC-4626 style) + inflation defence.** `stake` mints
   `shares = amount · (total_shares + VIRT) / (pool_value + VIRT)`; `unstake`
   returns `shares · (pool_value + VIRT) / (total_shares + VIRT)`. The `VIRT`
   virtual offset (1e6) neutralises the classic first-depositor donation/inflation
   attack — a griefer would need an economically absurd donation to round a
   victim's mint to zero. Verify: rounding always favours the pool (integer
   division), a zero-share mint is rejected (`ZeroShares`), `unstake` can only take
   the pool's *free* value (not `locked`), and it can't breach rent-exemption.
   Re-check the arithmetic bounds of `VIRT` against `u128` overflow.

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

- **Outcome→multiplier mapping** — the program verifies the *randomness*
  (commit-reveal on `server_seed`) and constrains *who* settles (the authority)
  and *how much* (`≤ bet.max_payout`), but it does not re-run the off-chain
  GameSpec to check that `payout_multiplier_bps` is the correct function of the
  revealed float (that would require the graph interpreter on-chain). This is a
  bounded trust assumption on the operator: every settlement emits the seed +
  multiplier, so with the public GameSpec anyone can recompute and publicly prove
  a mismatch. For full trustlessness, replace the authority multiplier with an
  on-chain VRF + a restricted set of verifiable game templates.
- **Geo / KYC / RG** — enforced at the app + compliance layer.

## Test coverage

`tests/house_vault.ts` exercises: config + split validation, game+pool
registration, edge-band rejection, staking (share mint), the bankroll-cap
rejection, a settled bet with edge skim, KYC-gated royalty claim, and unstake.
Run against a local validator with `anchor test`. Property/fuzz tests for the
share math and the cap arithmetic are recommended before audit sign-off.

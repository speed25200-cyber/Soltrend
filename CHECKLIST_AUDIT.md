# CHECKLIST_AUDIT.md — Soltrend smart-contract audit prep

For the auditor of `programs/house_vault`. This is the pre-mainnet gate.

## Program invariants (must hold under all inputs)

| # | Invariant | Where enforced |
|---|-----------|----------------|
| 1 | **Vault solvency** — a payout/claim can never exceed vault lamports (minus rent). | `settle_bet`, `withdraw_liquidity`, `claim_royalties` → `InsufficientVault` |
| 2 | **Payout cap** — no single settled bet pays more than `config.max_payout_lamports`. | `settle_bet` → `PayoutTooLarge` |
| 3 | **Edge band** — every game's `edge_bps ∈ [min_edge_bps, max_edge_bps]`, and the band itself ≤ 20%. | `register_game` → `EdgeOutOfBand`, `init_config` → `InvalidEdgeBand` |
| 4 | **Split integrity** — revenue split always sums to 10,000 bps. | `RevenueSplit::validate` → `InvalidSplit` |
| 5 | **Custody authority** — only `config.admin` moves house liquidity or sets KYC/pause. | `has_one = admin` on `ManageLiquidity`, `SetKyc`, `AdminOnly` |
| 6 | **KYC gate** — royalties claimable only when `creator_vault.kyc_verified`. | `claim_royalties` → `KycRequired` |
| 7 | **No creator custody** — creators only register a spec *hash*; they never receive player stakes. | account model: no player→creator transfer path |
| 8 | **Arithmetic safety** — payout math uses `u128` intermediates + checked ops; `overflow-checks = true`. | `settle_bet`, `Cargo.toml` release profile |

## Areas requiring auditor focus

- **Lamport bookkeeping** via direct `try_borrow_mut_lamports` in `settle_bet` / `withdraw_liquidity` /
  `claim_royalties` — confirm no double-spend, and that vault is a `SystemAccount` PDA (no data) so
  rent math is stable.
- **PDA seeds & bump handling** — `config`, `vault`, `game` (`creator || spec_hash`), `creator`.
  Confirm no seed collisions and that `vault_bump` is trusted from config.
- **Outcome trust boundary** — `payout_multiplier_bps` is computed off-chain from the provably-fair
  stream / VRF. Auditor should confirm the settlement authority model (who may call `settle_bet`) and
  recommend the VRF-backed variant for high-value / multiplayer games (Switchboard/ORAO).
- **Reentrancy / CPI ordering** — stake-in precedes payout-out; verify ordering can't be exploited.
- **Pausing** — `set_paused` blocks `settle_bet`; confirm no fund-locking griefing.

## Required before mainnet

- [ ] Full audit by a recognised Solana firm; all criticals/highs resolved.
- [ ] Fuzz `settle_bet` over (bet_amount, multiplier, vault_balance) incl. boundaries (0, u64::MAX).
- [x] Unit tests for the payout arithmetic (invariant 8), run on every push by CI:
      `apply_bps` and `edge_cuts` in `src/lib.rs`, covering zero, the 1000x ceiling,
      rounding direction, refusal to truncate a `u128` result into `u64`, and a bet
      large enough that `edge * bps` overflows `u64`. That last case used to panic
      under `overflow-checks`, which made such a bet unsettleable.
- [x] Property tests for the staker share accounting (invariant 4), run by CI:
      `shares_for_stake` / `lamports_for_shares` in `src/lib.rs`. Covers the round trip
      (redeeming can never return more than was staked), non-dilution of an existing
      position, monotonicity, dust stakes, refusal to overflow or truncate, and an
      explicit first-depositor inflation attack — stake 1 lamport, donate 10,000 SOL
      directly to the pool, then check the next staker still recovers their deposit and
      the attacker recovers under a thousandth of what they spent. The virtual offset
      does not forbid that manoeuvre; it makes it ruinous.
- [ ] Property tests for the remaining invariants 1–3 and 5–7 (these need account state,
      so they belong in `tests/house_vault.ts` under a validator rather than in unit tests);
      coverage report generated.
- [ ] Migrate outcome generation to VRF for multiplayer Crash.
- [ ] Multisig/timelock on `admin`; documented key-management.
- [ ] Bug bounty open before real liquidity is deposited.
- [ ] Legal sign-off on the creator-royalty structure (design licence, not profit share).

## Off-chain parity

The settlement service and client both derive results from `@soltrend/shared`. The engine is
byte-verified against Node `crypto` (SHA-256/HMAC) and simulated to confirm each game realises its
configured house edge. Any change to the engine must re-run parity + edge simulations.

# Architecture

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND — apps/web (Next.js 14 App Router, mobile-first)│
│  Wallet (Phantom/Solflare/Backpack) · Lobby · 7 games ·   │
│  Studio (GameSpec builder) · Discover · Leaderboards ·    │
│  Profile + Responsible Gaming · client-side PF verifier   │
└───────────────┬──────────────────────────────────────────┘
                │  (in production) REST/WS
┌───────────────▼──────────────────────────────────────────┐
│  BACKEND — settlement/API (NestJS or Next routes)         │
│  Provably-fair server seeds · bet orchestration · KYC ·   │
│  geo-block · responsible gaming · AML · metrics indexing  │
│  Shared math: @soltrend/shared (byte-identical to client) │
└───────────────┬──────────────────────────────────────────┘
                │  Anchor CPI
┌───────────────▼──────────────────────────────────────────┐
│  SOLANA — programs/house_vault (Anchor 0.30 / Rust)       │
│  House Vault PDA · settle_bet · creator vaults + split ·  │
│  register_game (edge-bounded) · VRF hook (Switchboard/ORAO)│
└──────────────────────────────────────────────────────────┘
```

## Provably fair

`result = HMAC-SHA256(serverSeed, "clientSeed:nonce:cursor")` → grouped into 4-byte floats in `[0,1)`.
The server-seed **hash** is published before the bet; the seed is revealed on rotation. Games that
need many draws (Mines, Plinko) advance a `cursor`, re-hashing per block for an unbounded stream. For
high-value / multiplayer games, an on-chain **VRF** replaces the HMAC float so the result is
unpredictable even to the operator.

Implementation: `packages/shared/src/{sha256,provably-fair,games}.ts` — mirrored into
`apps/web/src/lib` for a self-contained client build.

## GameSpec (UGC core)

A game is **data, not code** (`packages/shared/src/gamespec.ts`): `template`, bounded `params`,
`edge` (validated in the global band), theme. `validateSpec` rejects anything mathematically
dangerous (edge out of band, payout that could drain the vault). The audited program reads a spec's
*hash* and executes payouts — the creator never runs a contract or holds funds.

## Custody & settlement

House Vault PDA holds the bankroll. A bet stakes into the vault; `settle_bet` computes the payout
(`bet × multiplier_bps / 10_000`), enforces the payout cap and vault solvency, pays the player
atomically, and accrues the creator's cut. A "hot balance" UX (deposit once, play many) is modelled
client-side in this reference build and maps 1:1 onto the on-chain flow.

## Revenue split

House edge is split (default **55/30/5/10** — platform / creator / referral / treasury). The
creator share is a **design royalty paid by the operator**, KYC-gated at claim — deliberately *not* a
share of player losses (see `COMPLIANCE.md`).

## Roadmap

- **Phase 0** — foundations: wallet, vault, provably-fair, compliance.
- **Phase 1** — 8 Originals at 1/week (Dice → Limbo → Coinflip → Mines → Crash → Plinko → Wheel → Towers).
- **Phase 2** — Studio UGC: GameSpec engine, validation, creator vaults, split, leaderboards.
- **Phase 3** — creator economy: trending feed, referrals, community jackpots, weekly tournaments,
  community-produced **Game of the Week**.

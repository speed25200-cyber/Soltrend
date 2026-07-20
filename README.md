# Soltrend

**The on-chain casino the community builds.** A provably-fair Solana casino with instant "Originals"
and a no-code **Studio** where anyone designs a casino game from audited primitives and earns a
royalty on every bet it generates — *"the Roblox of on-chain casino."*

Players connect with **Phantom** (Solflare & Backpack also supported), and every result is verifiable
in the browser.

**Live demo:** https://speed25200-cyber.github.io/Soltrend/ — auto-deployed via GitHub Pages
(enable once under Settings → Pages → Source: GitHub Actions; see [`docs/DEPLOY.md`](docs/DEPLOY.md)).

> **Reference build.** This is a fully-playable product built on a Solana **devnet / demo hot-balance**
> flow. It is not a licensed operator and ships no real-money custody. See
> [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) and [`CHECKLIST_AUDIT.md`](CHECKLIST_AUDIT.md) before any
> mainnet consideration.

---

## What's inside

```
soltrend/
├─ apps/web/                 Next.js 14 (App Router) casino — Phantom, 7 games, Studio, leaderboards
├─ apps/api/                 NestJS backend — server-authoritative provably-fair, settlement, metrics, compliance
├─ packages/shared/          Canonical provably-fair engine + GameSpec contract (dependency-free)
└─ programs/house_vault/     Anchor/Rust program — custody, settlement, revenue split, creator vaults
```

### The casino (`apps/web`)
- **Wallet:** `@solana/wallet-adapter` — Phantom / Solflare / Backpack, custom-styled connect flow.
- **7 playable Originals**, each provably fair with bounded house edge (1–5%):
  Crash (live curve + cash-out) · Dice · Mines · Plinko · Limbo · Coinflip · Wheel.
- **Studio:** assemble a game (mechanic → math → theme) into a validated *GameSpec*, with a live
  house-edge / RTP / max-win preview that **refuses invalid or vault-draining configs**. Publish →
  it appears in Discover and starts accruing creator royalties.
- **Discover / Leaderboards:** trending feed, "Game of the Week", top games & creators by real volume.
- **Provably-fair verifier** (`/verify`): re-derive any bet from its seeds, entirely client-side.
- **Compliance first-class:** 18+ gate, geo posture banner, and a full responsible-gaming panel
  (max bet, daily-loss limit, cooling-off / self-exclusion, KYC status).

### The backend (`apps/api`)
A **NestJS** service that owns the server seeds and settles every bet through a
single compliance-guarded, provably-fair path — then indexes metrics for the
leaderboards. It exposes the fairness lifecycle over HTTP (`/fair/current`
publishes only the seed *hash*; `/fair/rotate` reveals; `/fair/verify` replays)
and enforces geo-blocking + responsible-gaming limits. Unit + HTTP e2e tests
cover the full settle → reveal → verify loop. See `apps/api/README.md`.

### The engine (`packages/shared`)
Dependency-free **SHA-256 + HMAC-SHA256** (byte-verified against Node `crypto`), a deterministic
float stream, and the generic game math for every template. The exact same code runs on the client,
the settlement service, and any third-party audit — that's what makes "provably fair" real.

### The program (`programs/house_vault`)
Idiomatic **Anchor 0.30** program that is the *sole legal operator*:
- House Vault PDA custody; admin-gated liquidity.
- `settle_bet` — atomic stake/payout with a hard **per-bet payout cap** and a **vault-solvency** check.
- `register_game` — a creator registers a GameSpec *hash* with an edge clamped to the global band.
  Creators never touch funds and can't bias the RNG.
- Creator vaults + **revenue split** (default 50/20/20/10 — platform / creator / bankroll-LP / community) with **KYC-gated** royalty claims. See [`docs/TOKENOMICS.md`](docs/TOKENOMICS.md).
- Tests cover every security invariant (`tests/house_vault.ts`).

---

## Design language

Deliberate colour psychology for long, high-trust sessions (see `apps/web/tailwind.config.ts`):
near-black "void" backgrounds so neon reads as premium; **emerald reserved for wins**, **rose for
losses**, **gold for jackpots/VIP** — the palette never lies about outcomes. Glassmorphism, aurora
gradients, spring physics, and reduced-motion support throughout.

---

## Getting started

```bash
# from repo root
npm install                       # installs all workspaces
npm run dev                       # http://localhost:3000  (apps/web)

# production
npm run build && npm run start
```

Configure RPC via `apps/web/.env.local` (see `.env.example`). Defaults to public devnet.

### The backend

```bash
cd apps/api
npm install
npm start          # http://localhost:4000
npm test           # unit + HTTP e2e
```

### The Anchor program

```bash
cd programs/house_vault
anchor build
anchor test                       # local validator + invariant tests
```

Requires the Solana + Anchor toolchain (`avm install 0.30.1`).

---

## Verify a bet yourself

1. Note the **server-seed hash** shown before you bet (in the fairness bar).
2. After rotating seeds, the **server seed** is revealed.
3. Open `/verify`, paste `serverSeed`, `clientSeed`, `nonce` → recompute
   `HMAC-SHA256(serverSeed, "clientSeed:nonce:0")` → the float → your result.
   If `SHA-256(serverSeed)` equals the pre-committed hash and the result reproduces, the bet was fair.

---

## Roadmap

Fondations → 8 Originals (1/week) → Studio UGC → creator economy (referrals, jackpots, weekly
tournaments, community-produced "Game of the Week"). Full plan in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Legal

This repository is a product/technical reference, **not legal advice**. The UGC + revenue-share model
is the most regulator-sensitive surface and must be reviewed by iGaming counsel before launch. See
`docs/COMPLIANCE.md`.

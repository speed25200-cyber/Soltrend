# Soltrend — Economic model

How the platform makes money while creators are incentivised to build and fund
great games. Designed to be **capital-light and profitable**: the platform takes
a risk-free rake; creators (and, later, community LPs) bring the bankroll.

## Two revenue engines

### 1. Creation deposit → game bankroll (upfront fee)
To publish a game, the creator **deposits SOL** that becomes the game's
**bankroll** (it pays that game's winners). The platform skims a small
**creation fee** off the deposit:

| Item | Value |
|---|---|
| Creation fee | **3%** of the deposit — instant platform revenue + anti-spam |
| Net bankroll | 97% of the deposit — pays winners, earns yield |
| Min deposit | 1 SOL (recommended ≥ 10 for a healthy max bet) |

The bankroll auto-derives a **safe max bet** (a single payout can never exceed
~20% of the bankroll, `maxPayout ≤ bankroll / 5`) so one lucky player can't ruin
a game. Creators can top up or withdraw surplus like a liquidity provider.

### 2. House-edge rake on every bet (recurring)
Every game runs a bounded house edge (1–5%). That edge is split so the
**platform takes the single largest, risk-free slice**:

| Party | Share of edge | Notes |
|---|---|---|
| **Platform** | **50%** | pure protocol rake — no bankroll variance |
| Creator | 20% | design royalty (KYC-gated claim) |
| Bankroll / LPs | 20% | yield to whoever funds the game (creator + community) |
| Community | 10% | jackpot + treasury |

Because the **creator both designs and funds** their game, they earn the 20%
royalty **plus** the 20% bankroll yield (~40% of the edge) — while carrying the
bankroll variance. The platform keeps 50% with **zero variance**. When community
LPs co-fund a game, the 20% bankroll share splits pro-rata with the creator.

> This is the "Uniswap-for-casino-games" shape: **the protocol takes rake,
> creators bring the liquidity, revenue scales linearly with volume.** No large
> platform bankroll is required to grow.

## Why it's profitable (worked example)

Platform rake = `50% × edge × volume`. At a 2% average edge that's **1% of all
wagered volume, risk-free**:

| Daily community volume | Platform / day | Creator (all) / day |
|---|---|---|
| ◎5,000 | ◎50 | ◎40 |
| ◎100,000 | ◎1,000 | ◎800 |
| ◎1,000,000 | ◎10,000 | ◎8,000 |

Plus creation fees (e.g. 50 games/week × ◎0.3 avg ≈ ◎15/week passive) and the
treasury's 10% edge slice funding jackpots/retention.

## Two operating modes (pick per jurisdiction)

- **Operator mode (licensed, compliance-safe).** The platform bankroll is the
  house; creators receive a **design royalty only** (no player-loss share, no
  variance). Cleanest legally; the creation fee is anti-spam. Recommended for a
  licensed launch.
- **Protocol mode (capital-light, DeFi-native).** Creators/community stake the
  bankroll and earn the edge (they bear variance). Maximises TVL and virality
  but makes funders economic participants — the regulator-sensitive path that
  must be structured with iGaming + securities counsel first.

The on-chain `house_vault` program supports both: `RevenueSplit` is configurable
and defaults to **50 / 20 / 20 / 10** (platform / creator / bankroll-LP /
community). Royalty claims are **KYC-gated** on-chain.

## Optional: $TREND token (phase 3+)
A platform token could let holders stake for a share of the platform rake,
govern featured games, and boost creators. ⚠️ A token adds significant
securities-law surface — not at launch.

*This is a product/economics design, not legal advice. Have iGaming counsel
validate the revenue-share and bankroll structure before mainnet.*

# Soltrend — the zero-capital economic model

**Goal: launch a real-money casino without putting up a house bankroll.** The
house is not us — it's the community. Stakers provide the capital and carry the
variance; creators bring the games and the players; the protocol takes a lean,
risk-free rake on the flow. We never fund a bankroll, yet earn from the first
real bet.

This is the "Uniswap-for-casino-games" structure: liquidity is provided by the
crowd, the protocol is a thin, profitable layer on top.

---

## 1. The core: player-vs-pool with a community bankroll

A player never bets against *us*. They bet against a **bankroll pool** funded by
**stakers (LPs)**. The stakers *are* the house:

- They earn the house edge as yield (positive expected value, long-run).
- They carry the variance (a lucky player run costs the pool short-term).
- The edge (1–5%, `MIN_EDGE`/`MAX_EDGE`) guarantees the pool profits over volume.

Because stakers supply the capital, **we need zero house capital**. Our job is to
build the mechanism and make staking attractive.

## 2. Per-game bankrolls — the key idea ("stake behind a game")

Instead of one monolithic house, **every game has its own bankroll shard**,
funded by:

1. the **creator's bond** (a deposit required to publish — skin in the game +
   anti-spam, costs us nothing), and
2. **community LPs** who stake specifically behind a game they believe will be
   popular, and earn *that game's* edge yield pro-rata.

Consequences:

- **A game can launch on a tiny bankroll** — even just the creator's bond —
  because bet size is capped relative to the shard (see §3). It grows its limits
  organically as stakers pile in.
- **Creation becomes a yield-bearing asset.** A popular game pays its stakers a
  lot → more people stake it → deeper bankroll → bigger bets allowed → more
  volume → more yield. A self-funding flywheel, per game.
- This is the Roblox-economy analog: creators + fans **co-own the house** of the
  games they love.

Implemented in `src/lib/store.ts` (`stakeBankroll`, `unstakeBankroll`,
`bankrollStakes`, per-game `tvl`) and `src/lib/economics.ts`.

## 3. Solvency: the bankroll-relative bet cap

One lucky player must never be able to drain a shard. Every round's **max payout
is capped at a fraction of the game's bankroll**:

```
maxPayout ≤ bankroll / RUIN_K          (RUIN_K = 5 → 20% of bankroll)
maxBet   = (bankroll / RUIN_K) / maxWinMult
```

So a game with 100 SOL staked and a 100× top multiplier allows a max bet of
`(100/5)/100 = 0.2 SOL` (max payout 20 SOL = 20% of pool). As stake grows, the
cap rises automatically. This is what makes a **tiny starting bankroll safe** and
lets the system scale itself. (`maxBetFor` in `economics.ts`.)

## 4. Splitting the edge (staker-favoured by design)

Every bet's house edge is divided so the people taking the risk earn the most —
otherwise no one funds the house and the bootstrap stalls:

| Party | Share | Why |
|-------|:-----:|-----|
| **Stakers** (bankroll) | **60%** | they supply the capital + carry the variance |
| **Creator** (royalty) | **20%** | incentive to ship good, popular games |
| **Protocol** (us) | **15%** | risk-free rake — our margin, zero capital in |
| **Insurance fund** | **5%** | backstops stakers against black-swan runs |

The creator can *also* stake their own bond behind the game, so they earn a share
of the 60% on top of their 20% royalty. (`EDGE_SPLIT` in `economics.ts`.)

Plus a **3% creation fee** (`CREATION_FEE`) skimmed off the creator's bond at
publish — instant, risk-free protocol revenue and an anti-spam gate.

## 5. Our revenue — with zero capital in

- **Protocol rake:** 15% of every game's edge, across all games, forever.
- **Creation fees:** 3% of every creator bond.
- Both scale with **volume**, never with luck — we hold no bankroll variance.

Illustrative: at a 2% average edge, **◎1,000,000 wagered/month** →
◎20,000 total edge → **◎3,000/month protocol rake** + creation fees, with **◎0 of
our own capital at risk**. Stakers earn ◎12,000, creators ◎4,000.

## 6. Bootstrap sequence (from zero)

1. **Play-money first** *(done — the current devnet build)*. Prove the games,
   recruit creators, grow an audience. **Zero liability**, no bankroll needed.
2. **Open the staking vault.** Early LPs seed shards for yield. Even a few
   hundred SOL of community stake runs a real casino, because bets are capped to
   a fraction of each shard (§3).
3. **Creators drive volume.** Edge accrues → stakers earn → more stakers deposit
   → shards deepen → bigger bets allowed → more volume. The flywheel turns,
   funded entirely by the community.
4. **We earn from bet #1.** Protocol rake + creation fees flow from day one of
   real play, with no capital from us.

## 7. Staker economics

Annualised yield scales with a game's turnover vs its bankroll:

```
staker APR ≈ (daily_volume × edge × 0.60 / bankroll) × 365
```

A game doing 2× its bankroll in daily volume at a 2% edge yields stakers
~`2 × 0.02 × 0.6 × 365 ≈ 876%` APR *gross* — high because casino turnover is
high, and precisely why LPs will fund the house. Variance is real; the cap (§3)
and the insurance fund (§4) are what make it a rational bet. (`stakerApr` in
`economics.ts`.)

## 8. Risks & honest caveats

- **It's not zero capital in the *system*** — stakers supply it. It's zero from
  **us**. The whole design is about making it rational for *them* to.
- **Staker variance.** Mitigated by bankroll-relative caps, a positive edge, and
  the insurance fund. Communicate it clearly; never imply risk-free yield.
- **Smart-contract risk.** The vault + settlement must be audited before mainnet.
- **Regulatory / licensing.** Real-money crypto gaming needs licences and
  geo-restriction; crypto-wagering is not permitted on the Apple App Store, so
  real-money play ships as **web / PWA**. This is the heaviest external
  constraint, not a code problem.

---

*Parameters live in `apps/web/src/lib/economics.ts` and are enforced in the
client ledger (`store.ts`) today; on mainnet the same split + caps live in the
`house_vault` Solana program.*

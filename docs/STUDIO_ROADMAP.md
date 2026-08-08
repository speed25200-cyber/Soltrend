# Soltrend Creator Studio — roadmap

The goal: a Roblox-grade studio where creators build addictive, original casino
games with no code, and earn from them. This tracks the vision and what's shipped.

## Shipped

**Creation surfaces**
- Unified `/studio` — one page, two modes: **3D World** (board + decor + logic
  core) and **Node game** (visual node graph).
- **Node Forge** — 15 node kinds: rng, const, math, branch, curve, randint, map,
  chance, segments, ladder (risk tower), multidraw, clamp, **reel (slot)**,
  **scratch (card)**, payout. Mobile pan/zoom + duplicate.
- **3D Worlds** — Three.js, PBR tiles, bloom, 5 environments, editable decor
  props, ship skins, optional node "logic core" (edge-neutral bonus). Three
  spatial mechanics: **Board** (reveal tiles on a grid), **Ascent** (climb a
  tower floor by floor, camera rising with you), and **Nexus**.
- **Nexus — creators author the topology, not the parameters.** Every other
  casino hands the creator a fixed shape and lets them tune numbers on it. Here
  they draw the structure itself: rooms in 3D space, each with its own danger,
  wired by one-way paths, sealed behind **keys and gates**. Players walk the map
  and choose their route — safe corridor or lethal shortcut — and bank anywhere.
  A room pays exactly 1/survival and the edge applies once at cash-out, so the
  house edge is **identical down every route through any topology**; no drawing
  a creator can make is able to tilt the game. Only the vault cap needs checking,
  and the richest-route search is exact, not sampled.

**Genres unlocked**
- Dice, Coinflip, Limbo, Crash, Mines/board, Wheel, **Towers (interactive
  dungeon-climb — playable + creator-themeable via the Classic builder)**,
  Best-of-N, **Slot machine**, **Scratch card**, plus arbitrary node mechanics.

**Ease + variety**
- **Generator** — pick a "feeling" → 3 structurally distinct, playable games.
- **Novelty score** — payout-distribution distance blocks clone spam.
- **Reusable modules** — save a mechanic, drop it into any game.
- Surprise-me, name generator, style presets, remix.

**Creator art + assets**
- **Pixel sprite editor** — draw your own slot/scratch symbols (12/16/24
  grids), saved to a personal library, rendered inline in your games.
- **Asset marketplace** (`/market`) — install curated + community symbol packs
  in one tap; publish your own. Share codes for symbols and modules.
- **Node-module marketplace** — trade reusable mechanics (the logic economy):
  import/share/publish modules from the node editor.
- **"Describe your game"** — offline keyword→feeling/style assistant generates
  a playable draft from a text idea.

**Community + discovery**
- **Creator pages** — a maker's catalog + aggregate stats + remix reach.
- **Top creators** + **novelty-ranked "genuinely new"** sections on Discover.
- **The Floor** — a spatial 3D discovery view of the community's games.
- **Collection / journeys** — cosmetic per-game tiers + a collection wall
  (Explorer→Diamond), purely decorative and vault-safe.

**Multiplayer**
- **Live Crash rooms** + shared **3D plaza** (presence).
- Four PvP templates on `/duel` — **1v1 duel** (stake-weighted coin),
  **shared jackpot** (community-pot raffle), **game-show elimination** (fair
  last-one-standing) and **co-op heist** (shared multiplier + crew vault).
  Server-authoritative, commit-reveal, unit-tested, graceful offline.

**Feel**
- Animated scenes incl. a real 3-reel slot, sound packs, win effects,
  procedural palettes, 3D atmospheres.

**Economy (for creators + stakers)**
- Per-game community bankroll + staking (pro-rata shares), staker-favoured edge
  split (60/20/15/5), bankroll-relative bet cap, creator bond.
- **Remix royalty lineage** — originals earn 15% of their remixes' royalties.
- **On-chain asset sales** — `buy_asset` splits a marketplace purchase (5%
  platform, rest to the seller's creator vault); no house exposure.
- On-chain: `house_vault` program with commit-reveal, authority-gated + native
  trustless settlement, per-pool kill-switch.
- **Wallet-signed money loop** — staking, unstaking and royalty claims are real
  transactions (no settlement authority involved), with the local demo ledger
  as a fallback when the program is unconfigured. The cashier reads the wallet's
  live on-chain balance.

**Safety**
- One funnel (`usePlay`) enforces balance, responsible-gaming limits and the
  bankroll-relative bet cap for every game, so a game cannot forget the check.
- Player-chosen multipliers (Limbo) are capped at the game's payout ceiling, so
  worst-case payout stays within bankroll / RUIN_K.

## Planned (the rest of the vision)

**Needs hosted infrastructure** (the client app is a static export; the gateways
are built + unit-tested but only run once the API is deployed):
1. **Multiplayer templates** — **duel**, **shared jackpot**, **game-show
   elimination** and **co-op heist** gateways all ship today (`/duel`),
   degrading gracefully offline. This line is complete; deploying the API is
   all that's left to make them live.
2. **LLM game creation** — the client is wired: when `NEXT_PUBLIC_AI_URL` is set,
   the description is sent to a hosted model that returns generator inputs (the
   validated generator still builds the game, so the model can't emit an unsafe
   curve), falling back to the offline keyword assistant otherwise. Deploying a
   model endpoint is the remaining step; an AI balance/tuning assistant is a
   further extension.

The **on-chain asset revenue-share** is fully wired: `house_vault::buy_asset`
settles a marketplace sale (5% platform, rest to the seller's creator vault), and
the client sends the wallet-signed purchase when a program id is configured
(`NEXT_PUBLIC_HOUSE_VAULT_PROGRAM`), falling back to free installs otherwise.
Deploying the program (see `docs/DEPLOY.md`) is all that's left to make it live.

**Cross-round progression** ships in its vault-safe form: cosmetic per-game
**journeys** (a collection meta — rounds played climb decorative Explorer→Diamond
tiers, shown on the profile + play screen) that never touch odds, payouts or the
bankroll, so per-round independence and the vault-safety simulator are unaffected.

**Deliberately NOT built (a principled boundary):**
- A **payout-affecting** progression node (streak bonuses that raise the ceiling)
  would break per-round vault-safety and needs a bounded, provably-capped design
  decision before it could ship. The cosmetic journey above is the safe version.
- **Quests / battle-pass / loot drops** as *new spend incentives* — the platform
  already has XP/VIP, missions and achievements; adding grind-to-win loops on a
  gambling product cuts against the responsible-gaming guardrail below.

## Guardrails

Every "addictive / engagement" mechanic ships behind the existing
responsible-gaming limits (max bet, daily loss cap, self-exclusion). Engagement,
not harm — and a regulatory requirement, not optional.

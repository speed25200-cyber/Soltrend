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
- **3D Worlds** — Three.js board, PBR tiles, bloom, 5 environments, editable
  decor props, ship skins, optional node "logic core" (edge-neutral bonus).

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

**Feel**
- Animated scenes incl. a real 3-reel slot, sound packs, win effects,
  procedural palettes, 3D atmospheres.

**Economy (for creators + stakers)**
- Per-game community bankroll + staking (pro-rata shares), staker-favoured edge
  split (60/20/15/5), bankroll-relative bet cap, creator bond.
- **Remix royalty lineage** — originals earn 15% of their remixes' royalties.
- On-chain: `house_vault` program with commit-reveal, authority-gated + native
  trustless settlement, per-pool kill-switch.

## Planned (the rest of the vision)

**Needs hosted infrastructure** (the client app is a static export; these are
scaffolded but can't run until the API is deployed):
1. **LLM game creation** — a true "describe → game" model + an AI balance/tuning
   assistant. The offline keyword assistant ships today; the LLM upgrade needs a
   hosted model.
2. **Multiplayer templates** — PvP duel builder, shared-jackpot / co-op games,
   live game-show host mode. The NestJS realtime gateways (crash rooms, plaza)
   exist; the game-builder templates ride on top once the API is hosted.
3. **Revenue-share market payouts** — on-chain settlement of asset-sale royalties
   (the browsable market + install tracking ship today, client-side).

**Deliberately deferred for safety / scope:**
4. **Cross-round state (progression node)** — persisting value across rounds
   breaks the per-round independence the vault-safety simulator relies on; needs
   a bounded design that keeps every round provably capped before it ships.
5. **Per-game quests / battle pass** and **collectibles / loot drops** —
   engagement metas. The platform already has XP/VIP, missions and achievements;
   any per-game layer must stay cosmetic and behind the RG limits below.
6. **"The Floor"** — spatial 3D discovery layered on the existing novelty feed.

## Guardrails

Every "addictive / engagement" mechanic ships behind the existing
responsible-gaming limits (max bet, daily loss cap, self-exclusion). Engagement,
not harm — and a regulatory requirement, not optional.

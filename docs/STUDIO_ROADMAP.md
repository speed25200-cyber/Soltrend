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
  dungeon-climb)**, Best-of-N, **Slot machine**, **Scratch card**, plus
  arbitrary node mechanics.

**Ease + variety**
- **Generator** — pick a "feeling" → 3 structurally distinct, playable games.
- **Novelty score** — payout-distribution distance blocks clone spam.
- **Reusable modules** — save a mechanic, drop it into any game.
- Surprise-me, name generator, style presets, remix.

**Creator art**
- **Pixel sprite editor** — draw your own slot/scratch symbols (12/16/24
  grids), saved to a personal library, rendered inline in your games.
- **Shareable symbol packs** — export/import a library as a code (no server).

**Community + discovery**
- **Creator pages** — a maker's catalog + aggregate stats + remix reach.
- **Top creators** discovery on the Discover feed.

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

1. **Asset marketplace** — publish/sell/remix symbol packs, modules, skins,
   scenes, sound packs (revenue-share). Sharing codes exist; the browsable,
   monetised market is next. A second creator economy.
2. **Creator-themeable Towers** — let the studio emit the Towers template so
   creators reskin/retune the dungeon-climb, not just play the Original.
3. **Cross-round state (progression node)** — persist streaks/levels/collections
   across rounds for sunk-cost progression loops (runtime state, RG-guarded).
4. **Per-game quests / battle pass** — creators define missions + unlockables in
   their game; players grind them.
5. **AI creation** — "describe your game" → generated playable game; an AI
   balance/tuning assistant (needs a hosted model).
6. **Multiplayer templates** — PvP duel builder, shared-jackpot / co-op games,
   live game-show host mode (needs the hosted realtime API).
7. **Novelty-ranked "genuinely new" feed + "The Floor"** — surface original
   games (payout-distribution distance) and spatial discovery.
8. **Collectibles / provably-fair loot drops** — a collection meta that drives
   return visits.

## Guardrails

Every "addictive / engagement" mechanic ships behind the existing
responsible-gaming limits (max bet, daily loss cap, self-exclusion). Engagement,
not harm — and a regulatory requirement, not optional.

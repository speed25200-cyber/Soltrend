# Soltrend Live — server-authoritative multiplayer

Live **Crash rooms** are the multiplayer layer: one shared round runs on the
server, every connected client watches the *same* multiplier climb in real time,
and players race to cash out before the bust.

Because the round is authoritative and stateful, it needs a **hosted Node
process** — GitHub Pages (a static host) cannot run it. The web app degrades
gracefully: the `/live` page shows an "offline" panel until a realtime URL is
configured, then connects automatically.

## Architecture

```
 Browser (static, GitHub Pages)                 Hosted API (apps/api)
 ┌─────────────────────────────┐   socket.io    ┌──────────────────────────────┐
 │ /live page                  │ ───────────────▶│ RealtimeGateway  (/live ns)  │
 │ useCrashRoom()  ◀───ticks───│                 │  • round loop (betting →     │
 │  emits: bet, cashout        │                 │    running → result)         │
 │  NEXT_PUBLIC_REALTIME_URL   │◀──state/bust────│  • authoritative multiplier  │
 └─────────────────────────────┘                 │  • commit-reveal fairness    │
                                                  └──────────────────────────────┘
```

- **Commit-reveal fairness.** Before each round the server broadcasts
  `sha256(serverSeed)` (the commit). The crash point is derived deterministically
  from `serverSeed + roundSeed + nonce`. After the bust the server reveals
  `serverSeed`, so anyone can recompute the crash point and check it against the
  hash — the house cannot change an outcome mid-round.
- **Authoritative clock.** Only the server advances the multiplier
  (`liveMultiplier(elapsedMs)`), so all clients agree and a client cannot fake a
  late cash-out.
- **In-memory state.** Matches the rest of this reference API. A production build
  would settle cash-outs against the on-chain house vault instead of play-money.

Key files:
- `apps/api/src/realtime/crash.ts` — provably-fair crash point + climb curve.
- `apps/api/src/realtime/realtime.gateway.ts` — the room engine + socket events.
- `apps/web/src/hooks/useCrashRoom.ts` — the client (lazy socket.io, gated by env).
- `apps/web/src/app/live/page.tsx` — the room UI (Solo · 3D + Live rooms).

### Shared 3D plaza (`/plaza`)

A second namespace, **`/plaza`** (`PlazaGateway`), is a lightweight presence
channel: each client is a Peer with `{ name, ship, x, z }`, the server keeps the
authoritative roster and broadcasts it at 10 Hz, and every client renders the
others as ship avatars gliding around a shared 3D space (`usePlaza` +
`PlazaScene`). Movement is cosmetic (no funds). Offline it degrades to a solo
plaza with ambient ships; hosting the API fills it with real players.

### PvP duel (`/duel`)

**`DuelGateway`** (`/duel` namespace) is 1v1 matchmaking. A player emits `queue`
with an ante; the server pairs them with the next waiting player, commits
`sha256(serverSeed)`, then after a short reveal window emits `duel-result` with
the winner and the revealed seed. The winner is a single uniform draw split by
stake-weighted threshold (`anteA / (anteA+anteB)`), so equal antes are a fair
coin and EV stays neutral before the 2% rake; winner takes the pot minus rake. A
disconnect mid-match forfeits to the opponent. Client: `useDuel` + the `/duel`
page (Duel tab).

### Shared jackpot (`/jackpot`)

**`JackpotGateway`** (`/jackpot` namespace) is a community-pot raffle. Players
`enter` a growing pot during an open window; at close, a provably-fair draw walks
the stake-weighted entry list to pick a winner (win chance == pot share), who
takes the pot minus a 3% rake. Commit-reveal per round. Client: `useJackpot` +
the Jackpot tab on `/duel`.

Both duel and jackpot resolution are covered by unit tests in
`apps/api/test/settlement.spec.ts` (reproducibility, stake-weighted odds,
distribution).

## Going live

1. **Deploy the API** (`apps/api`) to any Node host — Render, Fly.io, Railway, or
   a VPS. It listens on `PORT` (default 4000) and exposes a Socket.IO `/live`
   namespace. Example (Fly/Render): build with `npm i` then `npm run start
   --workspace @soltrend/api`.
2. **Point the site at it.** Set the build-time env var and rebuild:
   ```bash
   NEXT_PUBLIC_REALTIME_URL=https://your-api-host \
   STATIC_EXPORT=true BASE_PATH=/Soltrend npm run build --workspace @soltrend/web
   ```
3. Open `/live` — it connects and the shared round begins.

## Socket events

| Direction | Event | Payload |
|-----------|-------|---------|
| C→S | `bet` | `{ amount, wallet }` (betting phase only) |
| C→S | `cashout` | — (running phase only) |
| S→C | `snapshot` / `state` | full round state incl. `hash`, `phase`, `players` |
| S→C | `tick` | `{ roundId, multiplier }` (~10/s while running) |
| S→C | `bust` | `{ crashPoint, serverSeed, roundSeed, nonce, players }` |
| S→C | `history` | recent crash points |

## Scaling notes

The reference gateway runs a single in-process room. To scale horizontally, move
round state to Redis and use the Socket.IO Redis adapter so ticks fan out across
instances; keep exactly one authoritative "round ticker" (a leader lock or a
dedicated worker) so the multiplier has a single source of truth.

# @soltrend/api

Server-authoritative backend (NestJS). Owns the server seeds, settles bets
through a single compliance-guarded path, indexes metrics, and enforces
geo/responsible-gaming rules. Game math comes from `@soltrend/shared`, so the
API, the client, and the on-chain `settle_bet` all agree byte-for-byte.

```bash
npm install
npm start        # ts-node → http://localhost:4000
npm test         # jest: unit + HTTP e2e (settle → reveal → verify)
npm run typecheck
```

State is in-memory behind small services (`SessionStore`, `MetricsService`,
`ComplianceService`) — swap for Redis/Postgres without touching controllers.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness. |
| GET | `/fair/current?sessionId=&clientSeed=` | Current commitment: server-seed **hash**, client seed, nonce. |
| POST | `/fair/client-seed` | Set the player's client seed. |
| POST | `/fair/rotate` | Rotate → **reveals** the previous server seed (with `hashCheck`). |
| POST | `/fair/verify` | Reproduce a bet from revealed seeds. |
| GET | `/games` · `/games/:id` | List / read registered games (Originals + UGC). |
| POST | `/games` | Publish a UGC game (validated GameSpec). |
| POST | `/games/settle` | Settle one bet — the single provably-fair, compliance-guarded path. |
| GET | `/metrics/games` · `/metrics/creators` | Leaderboards by real wagered volume. |
| GET | `/compliance/geo?country=` | Geo allow/deny. |
| GET·POST | `/compliance/limits` | Read / set responsible-gaming limits. |

## The fairness guarantee

1. `/fair/current` returns only `SHA-256(serverSeed)` — the seed itself never leaves the server.
2. Each `/games/settle` reserves the next `nonce` and derives the result from
   `HMAC-SHA256(serverSeed, "clientSeed:nonce:cursor")`.
3. `/fair/rotate` reveals the old server seed; `hashCheck` confirms it matches the published hash.
4. `/fair/verify` (or the client, or an auditor) replays any past bet from the revealed seeds.

The e2e test exercises exactly this loop.

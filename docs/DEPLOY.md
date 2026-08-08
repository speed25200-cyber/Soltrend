# Deploying the web app

`apps/web` is a standard Next.js app. Two supported targets:

## GitHub Pages (static, free, public link)

A workflow (`.github/workflows/pages.yml`) builds a **static export** and
publishes it. Live URL once enabled:

> **https://speed25200-cyber.github.io/Soltrend/**

### One-time setup (repo owner)

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `claude/solana-casino-complete-23elkr` or `main` (or run the workflow
   manually via **Actions → Deploy web to GitHub Pages → Run workflow**).
3. The `deploy` job prints the live URL; it's also shown under **Settings → Pages**.

Notes:
- The base path is `/Soltrend` (must match the repo name, case-sensitive). If you
  rename the repo, update `BASE_PATH` in the workflow.
- A **public** Pages site requires either a public repo or GitHub Pro for a
  private one.
- Everything runs client-side (games are provably-fair in the browser, balance is
  a local hot-balance), so no server/API is needed for the static site. The
  NestJS API (`apps/api`) is optional and deployed separately.

### Build it yourself

```bash
cd apps/web
STATIC_EXPORT=true BASE_PATH=/Soltrend npm run build   # → apps/web/out
```

## Vercel (SSR, custom domain)

Import the repo in Vercel, set **Root Directory = `apps/web`**, framework
Next.js. No env required (defaults to devnet RPC; override `NEXT_PUBLIC_SOLANA_RPC`
with a Helius/Triton endpoint for production). Gives a `*.vercel.app` URL.

## Local

```bash
cd apps/web && npm install && npm run dev   # http://localhost:3000
```

## Optional backends — what deploying unlocks

Everything runs client-side by default. Two backends add live features when
deployed; unset, both degrade gracefully (offline panels / free installs).

| Feature | Needs | Build-time env var |
|---|---|---|
| Live Crash rooms, plaza, PvP (duel · jackpot · show · heist) | realtime API (`apps/api`) | `NEXT_PUBLIC_REALTIME_URL` |
| On-chain staking, bets, **paid asset sales** | `house_vault` deployed to a cluster | `NEXT_PUBLIC_HOUSE_VAULT_PROGRAM`, `NEXT_PUBLIC_SOLANA_RPC` |

### Realtime API (`apps/api`)

NestJS + Socket.IO. Listens on `PORT` (default 4000); namespaces `/live`,
`/plaza`, `/duel`, `/jackpot`, `/showdown`, `/heist`.

```bash
npm ci && npm run start --workspace @soltrend/api
```

Turn-key configs included: `Dockerfile`, `render.yaml`, `fly.toml`. Point the
site at it with `NEXT_PUBLIC_REALTIME_URL=https://your-api-host` and rebuild.
Scaling notes in `docs/REALTIME.md`.

### `house_vault` program

```bash
cd programs/house_vault
anchor build && anchor deploy --provider.cluster devnet
# init_config with the 60/20/15/5 split + settlement authority — see tests/house_vault.ts
```

Set `NEXT_PUBLIC_HOUSE_VAULT_PROGRAM` to the program id and
`NEXT_PUBLIC_SOLANA_RPC` to your RPC, then rebuild. This activates staking, the
bet flow, and `buy_asset` (paid marketplace sales — 5% platform, rest to the
seller's creator vault). See `programs/house_vault/CHECKLIST_AUDIT.md`; do not
run mainnet with real funds before an external audit.

### Env var reference

| Var | Where | Purpose |
|---|---|---|
| `STATIC_EXPORT` / `BASE_PATH` | web build | static export + sub-path host |
| `NEXT_PUBLIC_REALTIME_URL` | web build | realtime API origin; unset = offline panels |
| `NEXT_PUBLIC_HOUSE_VAULT_PROGRAM` | web build | deployed program id; unset = free installs |
| `NEXT_PUBLIC_SOLANA_RPC` | web build | RPC endpoint (defaults to devnet) |
| `NEXT_PUBLIC_AI_URL` | web build | hosted "describe your game" model; unset = offline keyword assistant |
| `PORT` | API | listen port (default 4000) |

### AI creation endpoint (optional)

Set `NEXT_PUBLIC_AI_URL` to a service exposing `POST /create` that accepts
`{ prompt: string }` and returns `{ feeling, presentation?, name?, edge? }`
(`feeling ∈ fast|tense|jackpot|slowburn`, `presentation` a scene id). The client
sanitises the response to known values and the validated generator builds the
game, so the model only influences *style*, never the payout math. Unset, the
studio uses the built-in offline keyword mapper.

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

# Security

## Reporting

Report a vulnerability privately — open a GitHub security advisory on this
repository rather than a public issue. Please include a reproduction and, for
anything touching payouts or the vault, the seeds and nonce so the round can be
replayed.

The on-chain program has **not** been audited. Do not deposit real funds. See
[`CHECKLIST_AUDIT.md`](CHECKLIST_AUDIT.md) for the pre-mainnet gates.

## What is enforced, and where

| Guarantee | Enforced by |
|---|---|
| A round's outcome is fixed by its reserved seed before anything is shown | `packages/shared/src/provably-fair.ts`, pinned byte-for-byte against Node `crypto` |
| Every game returns exactly `1 - edge` | `src/lib/__tests__/house-edge.test.ts`, closed-form wherever one exists |
| The edge stays inside [1%, 5%] for every configuration a creator can publish | `clampEdge` + `src/lib/__tests__/vault-safety.test.ts`, which enumerates the space rather than sampling it |
| No round quotes past the vault's payout ceiling | `MAX_MULTIPLIER` at each engine's point of production; asserted per engine |
| One maximal win cannot take more than 1/`RUIN_K` of a game's bankroll | `maxBetFor`, mirrored on-chain by the reserve taken at `open_bet` |
| Payout arithmetic cannot overflow or truncate | `apply_bps` / `edge_cuts` in the program, with unit tests including the overflow case |
| A self-exclusion survives a corrupt saved session | `sanitize` in `src/lib/store.ts` — it fails closed |

The client, the settlement service and any third-party verifier all import
`packages/shared`. There is one copy of the maths; a divergence between them was
a real defect once, and is the reason the duplication was removed.

## Dependency advisories

`npm audit` is triaged rather than treated as a number to drive to zero. CI
fails on any **critical** advisory in production dependencies; the rest are
reviewed here.

Current state (production dependencies, `npm audit --omit=dev`): **0 critical,
2 high, 14 moderate.** Down from 1 critical / 14 high / 71 moderate, by dropping
`@solana/wallet-adapter-wallets` — an aggregate that pulls in every adapter it
knows about, 254 MB including Trezor and WalletConnect, for two wallets this app
never registers. It now depends on the Phantom and Solflare adapters directly.

What remains, and why:

- **`next`** — every open advisory is server-side: the Image Optimizer, Server
  Actions, Server Components, middleware, rewrites, request smuggling, SSRF on
  custom servers. This app ships as a **static export** to GitHub Pages. There is
  no Node server, no image optimizer, no server actions and no middleware in the
  deployed artifact, so none of them are reachable. The fixed range starts at
  15.5.x, a major upgrade; it is tracked, not urgent.
- **`postcss`** (high) — the copy vendored inside `next`, used at build time
  only. The direct dependency is on a patched version.
- **`@nestjs/platform-express` / `multer`** — the API, which is not deployed as
  part of this build. The API accepts no file uploads.
- Everything else is test and lint tooling (jest, vitest, eslint, playwright) —
  build-time only, never shipped to a browser.

Anything reaching a browser or moving funds is expected to be clean. If that
stops being true, the CI gate should be tightened rather than this list grown.

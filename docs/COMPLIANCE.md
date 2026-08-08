# Compliance & Responsible Gaming

> This document is engineering guidance, **not legal advice**. Engage specialist iGaming counsel
> (Anjouan/Curaçao licensing) before operating with real funds.

## Posture

Soltrend is architected so the **platform is always the sole legal operator**. Creators design games
from audited primitives and receive a **design royalty**; they never custody funds, set payouts
freely, or operate a game. This is the single most regulator-sensitive design choice and is baked
into the program (`register_game` stores only a spec hash + a band-clamped edge; no creator payout path).

## Blocking vs configurable

| Control | Status | Notes |
|---|---|---|
| 18+ age gate | **Blocking** | `AgeGate` — no play until acknowledged. |
| Geo-blocking (IP + wallet) | **Blocking (prod)** | Reference build shows a posture banner; production returns a hard restriction screen for prohibited jurisdictions (US, UK w/o UKGC, FR casino, …). |
| Responsible-gaming limits | **Blocking once set** | Max bet, daily-loss limit, cooling-off / self-exclusion — enforced in `usePlay` before any settlement. |
| KYC (Sumsub or equiv.) | **Blocking above threshold** | Required for large withdrawals and for **any** creator royalty claim (`kyc_verified` on-chain). |
| AML monitoring | **Blocking (prod)** | Deposit/withdraw logging + suspicious-pattern detection. |
| House edge band 1–5% | **Blocking** | Enforced in `validateSpec` (client) and `register_game` (chain). |
| Payout cap / vault solvency | **Blocking** | `settle_bet` invariants. |

## Responsible gaming (implemented in this build)

- **Self-exclusion / cooling-off** (24h / 7d / 30d) — `settle_bet` guard refuses play while active.
- **Daily loss limit** — tracked per UTC day; play refused once reached.
- **Max bet per wager** — hard ceiling.
- **Help links** — surfaced in the age gate and profile.

All limits live in `apps/web/src/hooks/usePlay.ts` (single settlement path) and `store.ts` (state).

## Creator royalties — legal framing

Present and pay the creator share as a **licence/design royalty from the operator**, not a share of
player losses. Creators must be **KYC-verified** before claiming (enforced on-chain). Have counsel
validate this structure pre-launch.

## Pre-mainnet

See [`../CHECKLIST_AUDIT.md`](../CHECKLIST_AUDIT.md) for the non-negotiable list (licence, audit,
geo/age, KYC/AML, RG tools, payout invariants proven, bug bounty).

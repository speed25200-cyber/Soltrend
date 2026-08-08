# Design & production QA record

A route-by-route record of the visual, accessibility and resilience audits
run against the static production build (the same build the Pages workflow
deploys). Every check below was executed in a real Chromium against every
route, at desktop (1440×950) and mobile (390×844) viewports.

## The gates every deploy passes

| Gate | Scope | Result |
| --- | --- | --- |
| Typecheck (`tsc --noEmit`) | whole app | clean |
| Lint (`next lint --max-warnings=0`) | whole app | zero warnings |
| Engine tests (vitest) | 103 tests: provably-fair, paytables, game maths | all passing |
| Smoke sweep (`scripts/smoke.mjs`) | 68 page loads — every route × desktop + mobile | no console errors, no blank pages, no horizontal overflow |
| axe-core sweep | 16 routes, serious + critical rules (incl. colour-contrast) | 0 violations |
| WebGL-off probe | every game route with `--disable-webgl` | all controls render, zero uncaught errors |

The CI workflow (`.github/workflows/ci.yml`) runs the same typecheck, lint,
tests, build and browser sweep on every push; the Pages workflow re-runs it
before publishing. Nothing reaches production unverified.

## Design system

One token system in `tailwind.config.ts`, used by DOM and WebGL alike:

- **Surfaces** — `void.600–950` (deep indigo scale).
- **Accents** — `neon.violet/purple/magenta/pink/blue/cyan`.
- **Semantics** — `win`, `loss`, `gold`, each in three intensities.
- **Glows** — `glow-violet`, `glow-win`, `glow-loss` shadow tokens.
- **Type** — `sans` (UI), `display` (headings, machine marquees), `mono`
  (numbers — every multiplier, seed and balance is tabular mono).

The 3D scenes deliberately reuse the exact token hexes (`#a855f7`,
`#22d3ee`, `#ffd25f`, `#10f5a0`, `#ff3b6b`), so canvas and DOM read as one
material world.

## Game stages — what each one shows

Every stage was screenshotted at idle, mid-round and settled states.

| Game | Stage | Verified states |
| --- | --- | --- |
| Goldmine Express | Full WebGL slot machine: GPU-textured drums with motion-blur swap, brass cabinet, lamp chase, marquee, canyon set, ore train; camera adapts to portrait | idle, spin, settle, line win + confetti, mobile framing |
| Crash (`/play` + `/live`) | 3D rocket flight with ship skins, star field, bust fireball; the simulated table rides along as ships that green on cash-out | idle on pad, flight, bust with debris |
| Plinko | Instanced brass pin field (2 draw calls at any row count) with per-pin strike flashes, heat-coloured bucket wells, landing burst ring, neon rails, pointer parallax | idle, drop, land + bucket flash |
| Wheel | 3D carnival wheel machine | idle, spin, settle |
| Mines | Orbitable 3D board (lacquered slabs, hover halos, atmosphere) | idle, reveals, bust, cash-out |
| Coinflip | WebGL coin with engraved canvas faces; leaps, tumbles, lands on the seed's answer with a bounce and a verdict ring | idle breathing, mid-air, heads and tails landings |
| Dice | Oracle crystal behind the glass gauge — tumbles during the roll, rings green/red on the verdict | rest, roll, win, loss |
| Limbo | Same crystal + the climb arc | rest, climb, bust |
| Towers | DOM board with gradient tile faces; multiplier ladder colours track the climb | rest, climb, bust, cash-out |

Performance discipline is uniform: instanced meshes, all per-frame motion
written to refs inside `useFrame` (zero React renders per frame), DPR
clamped, bloom gated above 1.0 so only true emitters glow.

## UI component system

Every interactive surface is built from one set of primitives defined in
`globals.css` and shared components, so polish applied once applies
everywhere:

- **Buttons** — `.btn-primary` (gradient fill, sweep highlight on hover,
  press compression, disabled dimming), `.btn-win` (cash-out green
  variant), `.btn-ghost` (outline). Every game uses `BetButton`, which
  wraps the guard state (insufficient funds, limits, self-exclusion)
  into the disabled reason.
- **Forms** — `BetAmount` (shared bet input with ½/2×/Max and quick
  chips), `.input-num` (mono numeric fields with a styled select
  variant), range sliders accented to the palette; all carry accessible
  labels (see the axe pass).
- **Navigation** — `AppShell` header (active-route highlight, jackpot
  ticker, wallet button) + mobile bottom tab bar; every page renders
  inside the same shell.
- **Surfaces** — `.glass` / `.glass-hover` panels, `.chip` badges,
  `label-eyebrow` section headings, `neon-text` display accents.
- **Modals** — one `Modal` component (wallet, confirmations) with
  backdrop blur and motion in/out.
- **Feedback** — win/loss colour semantics everywhere, `sfx` audio
  cues, confetti bursts scaled to the multiplier, and the `DemoBar`
  strip tracking rounds/hit-rate/return in demo play.

The smoke sweep loads all of these on every route at both viewports;
the axe sweep checks them against serious/critical WCAG rules.

## Error, loading and empty states

- **404** — branded `not-found.tsx`, compiled to `404.html`, which GitHub
  Pages serves for unknown routes.
- **Route errors** — `app/error.tsx`.
- **WebGL failure** — every canvas sits behind a GL error boundary:
  ornaments (hero, crystal) vanish silently; game stages fall back to a
  text panel while the DOM controls keep the game fully playable
  (verified with WebGL disabled).
- **Loading** — every dynamic scene has a branded placeholder ("Stoking
  the boiler…", "Fuelling the rocket…", "Minting the coin…").
- **Resting states** — number games show explicit resting copy (Dice's
  "--.--  Set your target, then roll") instead of fake zeros.

## Accessibility

Fixed in the axe pass (previously serious/critical):

- Accessible labels on the shared bet input and every bespoke input
  (auto cash-out, target multiplier, threshold and mines sliders).
- Towers tiles announce row, column and revealed state.
- The live-wins ticker is a labelled, keyboard-focusable region.

## Engagement mechanics (what "immersive" is built from)

Sound engine with per-event cues, win bursts and confetti, progressive
jackpots with a visible ladder, XP/VIP levels, missions and daily runs,
frictionless demo mode (identical maths, no wallet), pointer-parallax
cameras, reel motion blur, camera shake on busts, and sub-second settles.
Validating that these read as *addictive* requires real players; the
instrumentation seams (game/round events in `settle()`) are in place for
analytics when the site launches.

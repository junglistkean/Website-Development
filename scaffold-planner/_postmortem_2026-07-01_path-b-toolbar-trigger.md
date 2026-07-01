# Post-mortem — Scaffold: add Path B toolbar trigger — 2026-07-01

## Problem

Path B ("Send as Pending Layout") worked and was wired correctly, but its only trigger sat
inside the collapsible BOM/Schedule panel (`.bom-panel--hidden { display:none }` by default).
Eddie drives from the toolbar, where Path A has an always-visible "SEND QUOTE" button, so he
never opened the panel and never reached Path B. (Diagnosed the prior turn — not a wiring bug,
a placement gap: Path A had both a toolbar and an in-panel trigger; Path B had only the in-panel one.)

## What was built

Mirrored Path A exactly — Path B now has both a toolbar and an in-panel trigger.

- **`src/components/Toolbar.jsx`** — added `onOpenPush` to the props and a second `isInternal`-gated
  button immediately after "SEND QUOTE": `SEND AS PENDING ⇪`, calling the same `onOpenPush`
  handler the in-panel button already uses. No new logic — just a second trigger.
- **`src/App.jsx`** — passes `onOpenPush={() => setShowPushModal(true)}` to `Toolbar`, the same
  way `onOpenQuote` is already passed.
- The in-panel `SEND AS PENDING LAYOUT ⇪` button is left as-is (Path A/B now symmetric: each has
  a terse toolbar label + a fuller in-panel label).

## Styling decision (reported, not silent)

Toolbar Path B uses **plain `toolbar-btn`**, not `toolbar-btn--accent`. The gold accent stays
reserved for the primary "send the finished quote" action (Path A), so the two are
distinguishable side by side — and it matches the in-panel treatment (Path A `sb-btn--accent`,
Path B plain `sb-btn`). Label `SEND AS PENDING ⇪` mirrors Path A's toolbar/panel label split
(`SEND QUOTE` vs `SEND TO QUOTE BUILDER ✉`).

## Why it works even with the panel collapsed

`PushModal` (like `QuoteModal`) is rendered inside `BomPanel` but via
`createPortal(…, document.body)`, so it escapes the `display:none` aside. The toolbar button sets
`showPushModal` in App state; the portal mounts on `document.body` and is visible regardless of
the Schedule panel. This is the exact mechanism Path A's toolbar button already relies on.

## Verified

Live internal build (`scaffold-planner.pages.dev`, bundle `main-BbKn2n2Z.js`) contains all four
labels: `SEND QUOTE`, `SEND AS PENDING` (toolbar) + `SEND TO QUOTE BUILDER`, `SEND AS PENDING
LAYOUT` (in-panel). Both toolbar triggers present without opening the Schedule panel; in-panel
Path B preserved.

## Scope / notes

- UI-only: one button + one prop pass-through. No schema, endpoint, or Path B contract change —
  no CLAUDE.md contract update needed beyond the fact that a second trigger now exists.
- Nothing to flag; clean.

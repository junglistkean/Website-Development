# Post-mortem — Scaffold Path B ("pending layout" push to QB) — 2026-07-01

## What was built

A second, additive push path in the scaffold planner that mirrors litedeck's Path B
(`submitQbPush`). Path A ("open QB pre-loaded" via `window.open ?data=`) is untouched.

- **`src/state/scaffoldStore.js`** — added `runningId: null` to `initialState` (the QB
  stage-lineage key) and a `SET_RUNNING_ID` reducer case (sets it without `record()`, since
  it's push metadata, not an undoable canvas edit). Because `handleSave` serialises the whole
  state and `LOAD_STATE` spreads `{ ...initialState, ...payload }`, the field auto-persists to
  the saved `.json` and rehydrates on load — no save/load code changes needed.
- **`src/components/BomPanel.jsx`** — added:
  - `qbFetch(path, opts)` — cross-origin fetch to QB with the `x-planner-key` header (prompted
    once, stored in `localStorage['qb_planner_key']`, cleared + re-prompted on 401).
  - `PushModal` — job `<select>` populated from `qbFetch('/api/planner-jobs')`, layout-name
    input, replace/duplicate radios (shown only when `runningId != null`, default replace),
    status line. Submits `{ name, jobId|null, components, layoutState, intent, runningId }` to
    `POST /api/planner-layouts` and stamps the response `runningId` back via `SET_RUNNING_ID`.
  - A "SEND AS PENDING LAYOUT" button next to the existing Path A button (both `isInternal`).
- **`src/App.jsx`** — added `showPushModal` state; passes `dispatch` + the push-modal props to
  `BomPanel`.
- **`CLAUDE.md`** — documented Path A vs Path B, the `group:{id,name,qty}` field, the persisted
  `runningId` + fresh-session-duplicates limitation, the transom omission, and the three £0
  reminders.

## Verified (live D1 round-trip, throwaway rows, then discarded)

Against the real `quote-builder.e-kean.workers.dev`, job "Jarno & Sonny work exp.":
1. First push (`intent:duplicate`, `runningId:null`) → `{ok:true, runningId:35}`; pending row
   landed tagged to the job, `component_count:2` (the ladder beam kept its `priceName`).
2. Re-send (`intent:replace`, `runningId:35`) → same `running_id:35`; the first row left the
   pending list (superseded) while the new row took its place — i.e. **replace, not duplicate**.
3. Discarded both → 0 matching pending rows. Clean.

## Wrong assumptions caught / decisions made

- **Do NOT strip components to `{category,description,qty}` like litedeck does.** Litedeck's
  every item description is an exact PRICE_LIST key, so its `.map()` strip is lossless. Scaffold
  emits the ladder beam as `"Ladder beam — X.XXm span"` with a separate `priceName:'Ladder beam'`
  — stripping `priceName` would make it re-resolve to **£0** on injection. Path B therefore sends
  `buildQuoteItems(bom)` as-is. (Handover already anticipated this with "components … unchanged".)
- **"No stable identity" STOP condition did not fire.** Scaffold's save/load serialises the full
  state, so a new `runningId` field is a legitimate, litedeck-equivalent identity anchor. No
  improvisation, no silent duplicate-only fallback.

## Handover warnings for the next session

- **Replace scope is session + saved-file only (accepted, not a bug).** Scaffold has no
  "reload sent layout from QB" list. A fresh session with no local save file has no `runningId`
  and will mint a NEW stage on push. If someone later reports "re-sending duplicates my stage",
  that's expected unless they reopened the saved `.json` first. Building the server-side reload
  list was explicitly out of scope for this handover.
- **The planner key** lives in `quote_builder/.planner-push-key.txt` (gitignored) and as the QB
  `PLANNER_PUSH_KEY` secret. The scaffold user is prompted for it once per browser.
- **Lint is red repo-wide pre-existing** (unused `React` under React 19, `const {history,...}`
  destructure-to-omit). The new code follows the same idioms; `npm run build` is green.
- **Transoms are intentionally disabled** — not generated, not in the BOM, not quoted. They'll
  return as the deck-support piece only when Litedeck decking is stocked, and will need a QB
  PRICE_LIST key added then (none exists now). NB the phantom transom generation is still in
  `calculateBom`/`BomPanel` at this commit; its removal is the immediately-next change. Narrow
  bays and the £0 base plate are also known-and-intended (see CLAUDE.md).

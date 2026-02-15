# Work Packet: WP-0067 — Near-duplicate finder (perceptual)

Date: 2026-02-15
Owner: Codex
Status: IN_PROGRESS

## Summary
Add a “visually similar” scan using perceptual hashing (pHash/aHash/dHash) to group near-duplicates (cropped/resized/re-encoded).

## Why
- Exact-hash duplicates are only half the problem; near-duplicates create clutter.
- Improves library hygiene without needing external tools.
- Spec: `CastKit_Codex_Spec_v00.043.md` §11.14.

## Scope
### In
- Compute a perceptual hash per image (cached in DB).
- Group into similarity clusters based on threshold.
- UI: show groups with side-by-side thumbnails + context.
- Provide safe actions:
  - Open in character
  - Mark/flag as redundant (no auto-delete)

### Out
- Automatic deletions.
- “Best pick” heuristics (initially).

## Acceptance criteria
- [ ] Scan completes on moderate libraries without locking UI (progress + cancel).
- [ ] Similarity groups are plausible at default settings.
- [ ] No destructive actions without explicit confirmation.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] Manual: import resized/cropped variants; verify grouping.

## Notes
- Do NOT touch `D:`.

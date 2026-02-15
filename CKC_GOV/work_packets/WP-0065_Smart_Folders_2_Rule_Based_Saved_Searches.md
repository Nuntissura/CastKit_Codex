# Work Packet: WP-0065 — Smart Folders 2.0 (rule-based saved searches)

Date: 2026-02-15
Owner: Codex
Status: BACKLOG

## Summary
Upgrade saved searches into rule-based “Smart Folders” (editable rules + live results), including tag logic and common media filters.

## Why
- Saved searches become durable workflows, not one-off snapshots.
- Matches the “asset manager” muscle memory (Eagle-like Smart Folders).
- Spec: `CastKit_Codex_Spec_v00.039.md` §11.12.

## Scope
### In
- Saved search rules support:
  - Scope: global vs current character
  - Favorite only
  - Rating operator + value
  - Tags include/exclude (AND/OR, minimal but useful)
- Editor UI for rules + preview result count.
- Persist rules in DB (preferred) or config (if already used for saved searches).

### Out
- Full boolean query language.
- Nested rule groups beyond one level (initially).

## Acceptance criteria
- [ ] Smart Folder rules can be created/edited/deleted.
- [ ] Applying a Smart Folder reliably reproduces its rule filters.
- [ ] Rules persist across restarts.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] Manual: create Smart Folder with tags+rating; verify it updates after adding tags to an image.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Reuse existing filter state structures where possible; add a stable `SavedSearch.rules_json`.

## Notes
- Do NOT touch `D:`.


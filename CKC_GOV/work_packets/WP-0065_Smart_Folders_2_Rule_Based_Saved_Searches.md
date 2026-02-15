# Work Packet: WP-0065 — Smart Folders 2.0 (rule-based saved searches)

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Upgrade saved searches into rule-based “Smart Folders” (editable rules + live results), including tag logic and common media filters.

## Why
- Saved searches become durable workflows, not one-off snapshots.
- Matches the “asset manager” muscle memory (Eagle-like Smart Folders).
- Spec: `CastKit_Codex_Spec_v00.042.md` §11.12.

## Scope
### In
- Saved search rules support:
  - Scope flags (Name/Tags/IDs/Labels/Values)
  - Favorite only
  - Rating operator + value
  - Tags include/exclude (AND/OR, minimal but useful)
- Editor UI for rules + preview result count.
- Persist rules in DB (preferred) or config (if already used for saved searches).

### Out
- Full boolean query language.
- Nested rule groups beyond one level (initially).

## Acceptance criteria
- [x] Smart Folder rules can be created/edited/deleted.
- [x] Applying a Smart Folder reliably reproduces its rule filters.
- [x] Rules persist across restarts.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] Manual: create Smart Folder with tags+rating; verify it updates after adding tags to an image.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (v00.042).

## Implementation notes
- Shipped:
  - Saved searches support `tagMode` (`all`/`any`) and `tagExcludeFilters` (exclude list).
  - DB upgrade adds `SavedSearch.tag_mode` and `SavedSearch.tag_exclude_json`.
  - Library filtering (`listCharacters`) supports include-any/include-all and excludes deterministically.

## Notes
- Do NOT touch `D:`.

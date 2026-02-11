# Work Packet: WP-0016 — Smart tags + saved searches UX

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Make the hideable command bar useful for real workflows:
- Saved searches (save/apply/update/delete) for Library character search + filters.
- Search scope toggles (name/tags/ids/labels/values).
- Tag filters (character tags) and better tag affordances (“smart tags” visibility).

## Why
Recovered requirements call out a minimal UI with a hideable command bar that contains search + saved searches + tags + filters. Without saved searches and tag controls, filtering workflows are too slow.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.023.md`

## Scope
### In
- Library: command bar includes saved searches + scope toggles + tag filters.
- Character: basic manual tag editing (so tag filters + saved searches have something to operate on).
- Smart tags surface: list/suggest tags from the DB (no heavy “analytics”).

### Out
- Full smart-tag recommendation engine.
- Advanced query DSL.

## Acceptance criteria
- [x] Can save a search (name + current query/filters/scope/tag filters) and re-apply it later.
- [x] Can update/delete a saved search.
- [x] Scope toggles affect search results deterministically.
- [x] Character manual tags can be added/removed and show up in Library filtering.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke: create tags, filter by tag, save search, restart app, re-apply saved search.

## Rollback
- Revert commits associated with WP-0016.

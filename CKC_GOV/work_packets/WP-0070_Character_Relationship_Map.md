# Work Packet: WP-0070 — Character relationship map

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add explicit character→character relationship edges (type + notes) and a lightweight graph view to browse and navigate.

## Why
- Story/worldbuilding workflows need explicit relationships.
- Links/backlinks show mentions; relationships provide structured intent.
- Spec: `CastKit_Codex_Spec_v00.046.md` §11.17.

## Scope
### In
- Relationship editor (per character):
  - Add target character
  - Relationship type (free text)
  - Notes
- Graph view (simple):
  - Nodes: characters
  - Edges: relationships
  - Click node to navigate to character

### Out
- Auto-extract relationships from text.
- Complex layout controls (beyond basic zoom/pan).

## Acceptance criteria
- [x] Relationships persist in DB.
- [x] Graph view renders and navigation works.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] Manual: create relationships, reopen app, verify graph matches.

## Notes
- Do NOT touch `D:`.

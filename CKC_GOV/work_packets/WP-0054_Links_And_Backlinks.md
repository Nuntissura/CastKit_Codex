# Work Packet: WP-0054 — Links + Backlinks

Date: 2026-02-14
Owner: Codex
Status: BACKLOG

## Summary
Add a lightweight linking system across CKC text surfaces (Notes/Stories/Moodboard text, and optionally the character sheet) plus a backlinks panel so CKC behaves more like a local “wiki” without rewriting user text.

## Why
- High ROI navigation: jump between characters, docs, and images without searching.
- Enables “knowledge base” workflows similar to Obsidian-style linking while keeping CKC’s byte-preservation rules.
- Spec: `CastKit_Codex_Spec_v00.038.md` §11.1.

## Scope
### In
- Parse outbound links from text using `[[...]]` syntax (implementation-defined, stable once shipped).
- UI affordance to navigate by clicking a parsed link.
- Backlinks panel for the active item (character/doc/image) showing incoming links.

### Out
- Full markdown rendering.
- Auto-fixing/bulk-renaming links inside user text (must remain manual only).

## Acceptance criteria
- [ ] Notes/Stories/Moodboard text containing `[[...]]` produces a list of outbound links.
- [ ] Clicking a link navigates to the target (character/doc/image/tag) without leaving docs mode unexpectedly.
- [ ] Backlinks panel shows incoming links to the active character/doc/image.
- [ ] User text is never modified unless the user explicitly edits/pastes text.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual: create links between two notes and a character; verify outbound links + backlinks update after save/reopen.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale):
  - `CKC_GOV/spec/CastKit_Codex_Spec_v*.md`
  - Mirror: `CKC_main/docs/`
- [ ] Session dump alignment: no conflicts; if representation differs, document mapping in the spec.

## Implementation notes
- Likely approach:
  - Parse links on-demand (no background indexing required initially).
  - Maintain a small link index table in SQLite for fast backlinks (computed on save).
- Key files to touch:
  - `CKC_main/app/backend/library.js`
  - `CKC_main/src/ui/views/CharacterView.tsx`
  - `CKC_main/src/ui/components/*` (docs editor + sheet + media)
- Data model changes:
  - Add a link index (table) keyed by `source_type/source_id` → `target_type/target_id`.

## Risks / mitigations
- Risk: ambiguous names (multiple “Karina”).
  - Mitigation: allow explicit prefixes (`doc:`, `img:`) and resolve with a chooser when ambiguous.

## Rollback
Drop the link index table and remove link UI panels; user text remains unchanged.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.


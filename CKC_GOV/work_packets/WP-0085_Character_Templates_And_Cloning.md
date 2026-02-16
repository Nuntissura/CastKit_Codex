# Work Packet: WP-0085 — Character templates & cloning

Date: 2026-02-15  
Owner: Codex  
Status: DONE (2026-02-16)

## Summary
Add the ability to save characters as reusable templates, create new characters from templates, and clone existing characters (sheet-only or with images).

## Why
- Users often create character variations (AUs, NPC archetypes, character families).
- Repeatedly filling in common fields is tedious.
- Templates lower the barrier to entry (starter archetypes).
- Spec: `CastKit_Codex_Spec_v00.053.md` §12.3 "Character templates & cloning".

## Scope
### In (shipped)
- Save character as template:
  - Character → Tools → **Save as template…**
  - Stores **non-empty, non-rule** field values (never includes `CHAR-ID-001`).
  - Option: include reference images (copies current character images).
  - Storage:
    - Template JSON: `<libraryRoot>/templates/CHARACTER_TEMPLATE__<id>.json`
    - Template images: `<libraryRoot>/templates/CHARACTER_TEMPLATE__<id>__images/`
- Create character(s) from template:
  - Library → **New from template…** (picker dialog)
  - Options: count, include images, numbered names (batch).
  - Character ID always generated fresh.
- Clone character:
  - Character → Tools → **Clone character…**
  - Options: clone sheet-only or with images (copies image files + metadata; best-effort thumbs; copies annotations JSON).
- Built-in template library:
  - Shipped templates live in `CKC_main/app/templates/character_templates/*.json` (read-only).
- Batch character creation:
  - Picker supports creating 5+ characters from one template with numbered names.

### Out (not in this WP)
- Template marketplace / sharing UX
- Advanced “inherit specific fields” UI
- Template versioning / migration rules

## Acceptance criteria (DONE)
- [x] Can save a character as a template (with/without images)
- [x] Can create a new character from a template
- [x] Can clone an existing character (sheet-only or with images)
- [x] Built-in templates ship with the app
- [x] Batch character creation works (5+ characters from one template)
- [x] Templates are portable (live under `<libraryRoot>/templates/`)

## Test plan (DONE)
- [x] Unit/integration tests for template save/list/get + create-from-template + clone (`CKC_main/test/backend_character_templates.test.js`)
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Governance checklist (MUST) (DONE in completion commit)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (bump + archive).

## Implementation notes (as-built)
- Backend: `CKC_main/app/backend/library.js`
  - `listCharacterTemplates`, `getCharacterTemplate`
  - `saveCharacterTemplateFromCharacter`
  - `createCharactersFromTemplate`
  - `cloneCharacter`
- IPC + preload:
  - `CKC_main/app/main.js` IPC handlers
  - `CKC_main/app/preload.js` API surface
- UI:
  - `CKC_main/src/ui/components/CharacterTemplatePickerModal.tsx`
  - `CKC_main/src/ui/components/CharacterTemplateActionModals.tsx`
  - Library button wired in `CKC_main/src/ui/views/LibraryView.tsx`
  - Character Tools actions wired in `CKC_main/src/ui/views/CharacterView.tsx`

## Notes
- Do NOT touch `D:`.

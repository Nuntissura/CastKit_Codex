# Work Packet: WP-0085 — Character templates & cloning

Date: 2026-02-15
Owner: TBD
Status: BACKLOG

## Summary
Add the ability to save characters as reusable templates, create new characters from templates, and clone existing characters with field inheritance options.

## Why
- Users often create character variations (same character in different AUs, NPC archetypes, character families).
- Repeatedly filling in common fields (Universe, Species, Role) is tedious.
- Templates lower the barrier to entry for new users (pre-filled D&D NPC, Romance Lead, Villain, etc.).
- Spec: `CastKit_Codex_Spec_v00.052.md` §12.3 "Character Templates & Cloning".

## Scope
### In
- Save character as template:
  - "Save as Template" action in Character view
  - Template stores field structure + optionally field values
  - Template can optionally include reference images
  - Templates stored in `<libraryRoot>/templates/` as `.json` files
- Create character from template:
  - "New from Template" button in Library view
  - Template picker UI (list with preview)
  - Inherited fields are pre-filled but editable
  - Character ID is always generated fresh
- Clone existing character:
  - "Clone Character" action in Character view
  - Options: "Clone with images" or "Clone sheet only"
  - Clone creates a new character folder with copied data
  - User can customize which fields to inherit
- Built-in template library:
  - Ship with 5-10 starter templates (D&D NPC, Modern Human, Fantasy Creature, etc.)
  - Stored in `CKC_main/app/templates/` (read-only)
  - User templates stored in `<libraryRoot>/templates/` (user-managed)
- Batch character creation:
  - "Create N characters from template" (useful for NPCs)
  - Auto-generates unique IDs (CHAR-000010, CHAR-000011, ...)

### Out
- Template marketplace / sharing (future consideration)
- Advanced field inheritance rules (e.g., "inherit Species but randomize Name")
- Template versioning

## Dependencies
None (pure feature, uses existing SQLite and file operations)

## Acceptance criteria
- [ ] Can save a character as a template (with/without images)
- [ ] Can create a new character from a template
- [ ] Can clone an existing character (with field inheritance options)
- [ ] Built-in templates ship with the app
- [ ] Batch character creation works (5+ characters from one template)
- [ ] Templates are portable (can export/import with library)

## Test plan
- [ ] Unit tests for template serialization/deserialization
- [ ] Integration test: save template, create character from it, verify fields
- [ ] Manual: clone character with images, verify folder structure
- [ ] Manual: batch create 10 NPCs from template
- [ ] `npm test`
- [ ] `npx tsc --noEmit`

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (`CastKit_Codex_Spec_v00.052.md` §12.3).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/app/lib/templates.js` — Template CRUD operations
  - `CKC_main/app/ipc/templates.js` — IPC handlers
  - `CKC_main/src/ui/components/TemplatePickerDialog.tsx` — Template selection UI
  - `CKC_main/src/ui/components/CloneCharacterDialog.tsx` — Clone options UI
  - `CKC_main/app/templates/` — Built-in template directory
- Template JSON schema:
  ```json
  {
    "template_id": "tpl-dnd-npc-v1",
    "name": "D&D NPC",
    "description": "Basic NPC template for D&D campaigns",
    "version": "1.0",
    "fields": [
      { "field_id": "CHAR-NAME-001", "value": "" },
      { "field_id": "CHAR-SPECIES-001", "value": "Human" },
      { "field_id": "CHAR-ROLE-001", "value": "Commoner" }
    ],
    "include_images": false,
    "reference_images": []
  }
  ```
- Clone operation:
  1. Generate new Character ID (CHAR-NNNNNN)
  2. Copy Character row with new ID
  3. Copy CharacterField rows (optionally filter by user selection)
  4. If "Clone with images": copy ImageAsset rows + physical files
  5. Update `libraryRoot` folder structure

## Notes
- Built-in templates to include:
  1. Blank Character (empty sheet)
  2. D&D NPC (Name, Species, Role, Class, Alignment)
  3. Modern Human (Name, Age, Occupation, Location)
  4. Fantasy Creature (Name, Species, Powers, Weaknesses)
  5. Sci-Fi Character (Name, Species, Homeworld, Tech Level)
  6. Romance Lead (Name, Age, Personality, Love Language)
  7. Villain (Name, Motivation, Powers, Weakness)
- Template picker UI: grid with thumbnail + name + description
- Consider allowing templates to specify *required* vs *optional* fields
- Do NOT touch `D:`.

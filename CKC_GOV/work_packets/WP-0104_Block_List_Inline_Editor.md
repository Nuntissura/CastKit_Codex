# Work Packet: WP-0104 - Block-List Inline Editor for Sheet Fields

Date: 2026-05-06
Owner: Codex
Status: DONE

## Summary
Replace the single-textarea fallback for block-list fields (e.g. `<list of Hustle_Block | optional>`, `<list of Animal_Comparison_Block | optional>`) with a proper inline editor that renders each block instance as a sub-form whose inputs are typed per the block schema. Render empty schema-descriptor lines (e.g. `HUS-BLK-001 — Hustle_Name: <string>`) only inside their parent block context — not as standalone empty `ckc-field-*` divs at the top sheet level.

## Why
The post-WP-0099/WP-0100 sheet test campaign found that ~417 of 896 `ckc-field-*` divs on a fresh character sheet have no input control. These are block-schema descriptor lines (`HUS-BLK-001 — Hustle_Name: <string>` etc.) — definitions of what fields a block instance contains, not fillable fields on the character itself. They render as empty containers because the SheetEditor doesn't know to skip them or to delegate them to a block context.

The block-list parent fields themselves (e.g. `CHAR-WRK-007 — Side_Hustles: <list of Hustle_Block | optional>`) render as a single `<textarea>` with placeholder `<list of Hustle_Block | optional>`. The operator must hand-type JSON-like content matching the block schema. There is no per-field input, no validation per sub-field, no add/remove block buttons, no preview. Together this makes block-list fields effectively unfillable through the UI.

The character template defines six block schemas (`Hustle_Block`, `Animal_Comparison_Block`, `Zodiac_Block`, `Language_Block`, `Sibling_Block`, `Parent_Min_Block`, etc.) and roughly 20+ block-list parent fields. Without a proper editor, the operator can only fill these via direct DB writes or by hand-crafting JSON strings — neither is acceptable for a production character sheet.

## Scope
### In

#### 1. Parser surface (`CKC_main/app/backend/templateParser.js`)
- The parser already extracts block schemas into `blockSchemas[]`. Surface them on the AST so the renderer can look up a schema by name (`blockSchemaName`).
- Each block schema entry should have `name` and `fields[]` with the same per-field shape as top-level fields (id, label, type, enumValues, allowOtherType, allowedSpecialValues).

#### 2. New `BlockListEditor` component (`CKC_main/src/ui/components/BlockListEditor.tsx`)
- Props: `field` (the block-list parent), `blockSchema`, `value` (string, JSON-serialized list of blocks), `onChange(newValue)`.
- Renders:
  - Field header (label, field id) consistent with the rest of the sheet.
  - One `<BlockEditor>` per block instance.
  - "+ Add" button to append a new empty block with all schema fields blank.
  - Per-block "Remove" button.
  - "Move up" / "Move down" buttons for reorder.
  - Empty state ("No items — click + Add to create one") when list is empty.
- Internal state: parsed list of blocks. On any sub-field edit, serialize back to JSON and call `onChange(newJson)` so the parent `draftValuesById` stays in sync with the JSON form.
- Tolerant JSON parse: if the existing value is malformed or empty, start with `[]`.

#### 3. New `BlockEditor` component (`CKC_main/src/ui/components/BlockEditor.tsx`)
- Props: `blockSchema`, `value` (object), `onChange(newObj)`, `onRemove`, `onMoveUp`, `onMoveDown`.
- Renders each schema field as the same input control the main `SheetEditor` uses (string → input, enum → input + datalist, descriptor → textarea, etc.). Reuse the existing input switch logic — extract it into a shared helper if needed.
- Each field's value is keyed by the block schema's field id (`HUS-BLK-001`). Validation per block-field reuses `validateValueForField` from `validation.js`.
- Render the block id label (`Hustle_Block #1` etc.) and a remove button at the top.

#### 4. `SheetEditor` integration
- When the field's `type === 'block_list'` or `type === 'block'`, delegate to `BlockListEditor` (or `BlockEditor` for single blocks) instead of the textarea fallback.
- Drop the empty `ckc-field-*` divs for block-schema descriptor lines: filter them out of the top-level field list (they live inside the block schemas, not on the sheet).

#### 5. Storage format
- Block-list values continue to be stored as JSON strings in `FieldValue.value_text` (matches the current canonical format).
- Single-block values stored as a JSON object string.
- Empty/missing list = `'[]'` (or empty string for "unset").
- Validator's existing `block_list` / `block` JSON-parse check stays in place.

#### 6. Sub-field validation
- Run `validateValueForField(blockSchemaField, blockValue.fieldId)` per block instance per field.
- Aggregate issues with field id of the form `<parentFieldId>[<blockIndex>].<blockFieldId>` for display.
- The Save flow surfaces these in the existing `saveIssues` UI.

#### 7. Tests
- `test/block_list_editor_serialize.test.js` — JS-level: serialize/parse roundtrip, add/remove/reorder, empty handling, malformed input recovery.
- `test/block_list_validation.test.js` — feed a sample Hustle_Block array through the validator with a mix of valid/invalid sub-field values; assert correct issue paths.
- Smoke (manual, dev mode + packaged): create a character, fill a `Side_Hustles` block with one Hustle_Block, save, reload, verify per-field roundtrip including descriptor word count and score_10 range.

#### 8. Test suite + manual + spec
- Update `CKC_GOV/test_suites/CKC_TEST_SUITE.md`: F1.7 row marked resolved (with the new check rows), add a Section F1.7.x sub-suite covering block-list editor behaviors.
- Bump `MANUAL_VERSION` in `automationManual.js`; add a note to the operating contract about block-list fields being structured + validated per sub-field.
- Spec bump `v00.067 -> v00.068`. Document the JSON serialization format for block lists.

#### 9. Ship as packaged build (per ship-as-packaged memory)
- `npm run package:win` produces v0.2.10 (or whatever the current patch number is at that point).

### Out
- Drag-drop reorder (use up/down arrow buttons for now).
- Block templates / pre-fill common patterns (`+ Add Hustle from preset` etc.).
- Conditional sub-fields (e.g. "show field X only when field Y is set"). The template doesn't currently encode conditional logic.
- Cross-block validation rules (e.g. "at most one Sibling marked relationship='close'"). Per-block validation only.
- Inline error display next to each sub-field (errors surface in the top `saveIssues` panel as today).
- Auto-save (still operator-driven Save button per current sheet).
- Block-level undo/redo (rely on operator's Save/discard pattern).

## Acceptance criteria
- [ ] Parser AST exposes `blockSchemas[]` keyed by name; each entry has `fields[]` with per-field shape matching top-level fields.
- [ ] `SheetEditor` delegates `block_list` and `block` type fields to the new editor components.
- [ ] Top-level `ckc-field-*` divs no longer include empty schema-descriptor lines (e.g. `HUS-BLK-001`); their count drops from ~896 to ~480 on a fresh sheet.
- [ ] Adding a Hustle_Block via the new + Add button creates an empty block, fields render with the right input types, save → reload roundtrip preserves all sub-field values byte-exact (including Unicode, descriptor word count, score_10 normalization).
- [ ] Removing a block deletes it from the list and the saved JSON.
- [ ] Move up / Move down reorder reflects in the saved JSON.
- [ ] Per-block sub-field validation surfaces in `saveCharacter` `issues[]` with field-id path `<parentFieldId>[<index>].<blockFieldId>`.
- [ ] Empty list save yields `'[]'` (or empty string consistent with how missing optional fields are stored elsewhere).
- [ ] Malformed pre-existing JSON gracefully recovers to an empty list with a one-time warning rather than blocking the editor.
- [ ] All existing tests still pass; new block-list tests pass.
- [ ] Spec bumped to v00.068; v00.067 archived.
- [ ] Manual `MANUAL_VERSION` bumped; operating contract documents the block-list editor.
- [ ] Test suite F1.7 marked resolved with the new check rows.
- [ ] `npm run package:win` produces a tagged Windows release; smoke against the packaged build verifies the new editor.

## Test plan
- Unit: serialize/parse roundtrip for `[]`, single block, multiple blocks, blocks with Unicode + emoji + special chars, malformed input recovery.
- Unit: per-block-field validation routing (e.g. score_10 sub-field with `11/10` produces an issue with the right path).
- Smoke (manual, dev mode): UI walkthrough — create test character → fill Side_Hustles with two Hustle_Block entries (different `Hustle_Type` enum values, different `Time_Commitment` score_10 values) → save → close + reopen character → verify all values restore.
- Smoke (manual, packaged): same flow on the packaged build.
- Visual regression: capture before/after screenshots of a character sheet showing the Side_Hustles section both empty and populated.

## Governance checklist
- [ ] Task Board updated with WP-0104 row at `IN_PROGRESS`, then `DONE`.
- [ ] Spec bumped `v00.067 -> v00.068`; old archived.
- [ ] No file/folder/artifact names with spaces.
- [ ] Planning-checkpoint commit (WP file + Task Board row) pushed before any code changes.
- [ ] Shipping-checkpoint commit pushed after implementation.
- [ ] In-app manual updated in the same commit as the new editor (per codex hard-requirement rule).
- [ ] Test suite updated with F1.7 resolution and new check rows.
- [ ] Live verification: drive the new editor end-to-end via CDP. Capture screenshots into `CKC_GOV/targets/CKC/automation_captures/`.
- [ ] NAS mirror backup script run after the shipping commit.

## Implementation notes
- Files expected to change / be added:
  - `CKC_main/app/backend/templateParser.js` — surface block schemas on the AST.
  - `CKC_main/src/ui/components/BlockListEditor.tsx` (new).
  - `CKC_main/src/ui/components/BlockEditor.tsx` (new).
  - `CKC_main/src/ui/components/blockListEditor.module.css` (new) and `blockEditor.module.css` (new), or a shared module if the styles overlap.
  - `CKC_main/src/ui/components/SheetEditor.tsx` — delegate block-list/block fields; consider extracting the per-field input switch into a `SheetField.tsx` for reuse.
  - `CKC_main/app/backend/automationManual.js` — operating-contract note + MANUAL_VERSION bump.
  - `CKC_main/test/block_list_editor_serialize.test.js` (new).
  - `CKC_main/test/block_list_validation.test.js` (new).
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.068.md` (new); v00.067 archived.
  - `CKC_GOV/test_suites/CKC_TEST_SUITE.md` — F1.7 resolution + new checks.
- Reuse the existing input switch from `SheetEditor.tsx` (lines ~169-219) for block sub-fields. Refactor into a small `SheetField` component if it simplifies the BlockEditor markup.
- The current SheetEditor uses datalists keyed by `ckc-field-suggest-${field.id}` for cross-character preset reuse. For block sub-fields, suggestion ids should be namespaced: `ckc-field-suggest-${parentFieldId}.${blockFieldId}` (or similar) so suggestions are scoped to the block sub-field, not pulled from the top-level.
- Keep the editor stateless beyond local block draft state — the parent's `draftValuesById[parentFieldId]` is still the source of truth (as a JSON string).
- Identity decoupling: block sub-field values are operator-typed text. They go on the sheet, which is the only allowed place for identity. No new constraints needed.

## Risks / mitigations
- **Risk:** existing operator-saved JSON in block-list fields becomes unparseable in the new editor. **Mitigation:** tolerant parse with empty-list fallback + a one-time warning surfaced in `saveIssues`. The original raw bytes stay intact in `FieldValue.value_text` until the operator saves, so they're recoverable from the DB.
- **Risk:** the SheetEditor refactor causes regressions on top-level fields. **Mitigation:** keep the input switch logic identical; the only delta is the routing for `type === 'block_list' / 'block'`. The existing F-block test suite checks all top-level types.
- **Risk:** save flow's `saveIssues` UI doesn't display nested block-field paths well. **Mitigation:** for this WP, surface the issue with a flat path label (e.g. `Side_Hustles[0].Hustle_Name: required`); a richer tree-view UI is a follow-up.
- **Risk:** block schemas evolve in template v2.01+ and existing block instances become invalid. **Mitigation:** out of scope for this WP — schema migration of stored block instances is a separate, larger concern.

## Rollback
- Revert the WP commit. Block-list fields fall back to the textarea editor; no data is lost (storage format unchanged). Spec/manual revert. Test suite F1.7 row goes back to OPEN BUG.

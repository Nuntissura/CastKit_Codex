# Work Packet: WP-0006 — Exports: empty template + LLM-friendly + custom field selection

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Implement frontpage (Library) exports:
- Export an **empty character sheet** that matches the canonical template bytes/layout.
- Export an **LLM-friendly empty** variant (Field ID lines), driven by reusable presets.

## Why
Exports are a core workflow feature: producing clean, deterministic templates for editing, sharing, and LLM-assisted filling without breaking template integrity rules.

## Inputs
- Canonical template bytes:
  - `CKC_GOV/templates/character sheet templates/CHARACTER_SHEET__v2.00.txt`
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.023.md`

## Scope
### In
- Library view UI entrypoints to trigger exports.
- Output folder chooser (default to library root `exports/`).
- Empty-template export preserves bytes/layout (no generation).
- LLM-friendly empty export:
  - Field ID lines only (no values)
  - Reusable presets via TemplateSpinOffs (includes built-in “Safe Subset”).

### Out
- Full field/section selection editor UI for presets (can be added later).
- Character filled export selection/presets beyond existing `exportBundle`.

## Acceptance criteria
- [x] Export empty canonical template produces a file identical to `CHARACTER_SHEET__v2.00.txt` (line endings preserved).
- [x] Export LLM-friendly empty pack produces deterministic `FIELD_ID: ` lines using a selected preset.
- [x] User can choose output folder; cancel does nothing.
- [x] No export writes inside `CKC_main` repo.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke: export both variants; open output folder; verify template bytes + line endings.

## Implementation notes
- Prefer copying built-in template bytes for the canonical export.
- Use TemplateSpinOff presets (built-in safe subset) for LLM-friendly export.

## Rollback
- Revert commits associated with WP-0006.

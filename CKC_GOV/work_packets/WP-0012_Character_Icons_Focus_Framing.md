# Work Packet: WP-0012 — Character icons + focus framing

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Add per-character icons to the Library character list, with selectable icon image and adjustable focus framing (`focusX/focusY`) so icons don’t default to a random center crop.

## Why
The recovered session dump explicitly calls out character icons as a key Library UX feature, especially on large displays.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.024.md`

## Scope
### In
- DB columns on `Character` for:
  - `icon_image_id` (references an `ImageAsset.image_id`)
  - `icon_focus_x`, `icon_focus_y` (normalized 0..1)
- Backend API to set/clear icon and adjust focus.
- UI in Character view (Tools tab) to:
  - pick icon from character images
  - adjust focus X/Y with sliders
  - preview the icon
- Library list shows the icon (thumb) using focus framing.

### Out
- Zoom/scale controls, rotation, multi-crop variants.
- Batch icon assignment.

## Acceptance criteria
- [x] Library list shows icon when set; otherwise shows a placeholder.
- [x] Changing focus updates the crop (object-position) deterministically.
- [x] Clearing icon removes it from Library list without breaking anything.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke: set icon, tweak focus, return to Library, confirm icon + crop persists after app restart.

## Rollback
- Revert commits associated with WP-0012.

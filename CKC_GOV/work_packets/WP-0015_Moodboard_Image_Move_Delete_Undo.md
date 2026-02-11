# Work Packet: WP-0015 — Moodboard: move/delete images + undo

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Add basic “Milanote-ish” usability to the moodboard canvas:
- Move/position placed images.
- Delete a selected image.
- Undo last stroke and undo last image add.

## Why
The baseline canvas supports drawing and placing images, but without move/delete/undo it’s too easy to “brick” a board and require starting over.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.024.md`

## Scope
### In
- Add a `Move` tool.
- Hit-test and select a moodboard image instance.
- Drag to reposition (normalized coordinates).
- Delete selected image.
- Undo last stroke.
- Undo last image add.

### Out
- Rotation, scaling handles, snapping, layering UI, vector masks.

## Acceptance criteria
- [x] Can reposition images reliably (no accidental drawing while moving).
- [x] Can delete a selected image.
- [x] Undo works for strokes and image adds.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke: place 2 images, move them, delete one, undo stroke/image, save/reopen doc.

## Rollback
- Revert commits associated with WP-0015.

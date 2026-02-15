# Work Packet: WP-0061 — Image Annotations / Pins (Non-destructive)

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add non-destructive annotations on top of images (pins + simple shapes) stored as JSON per image.

## Why
- High ROI for reference work: mark details, colors, outfit parts, etc.
- Keeps originals untouched while adding meaning inside CKC.
- Spec: `CastKit_Codex_Spec_v00.039.md` §11.8.

## Scope
### In
- Annotation data model keyed by `imageId`.
- Viewer overlay with:
  - Add/move/delete text pins
  - (Stretch) simple shapes (rect/ellipse/arrow)
- Show/hide toggle in viewer chrome.

### Out
- Rasterizing annotations into exported images (optional later).
- Advanced drawing tools (moodboard already covers freehand).

## Acceptance criteria
- [ ] User can add a text pin to an image and it persists across reopen.
- [ ] Pins can be moved and deleted.
- [ ] Annotations can be shown/hidden without affecting the original image file.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] Manual: annotate an image, restart app, verify annotation persists; toggle show/hide.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Data model options:
  - New table `ImageAnnotation(image_id, annotations_json, updated_at)`
  - Or new column on image asset (less flexible).
- Key files:
  - `CKC_main/app/backend/library.js`
  - `CKC_main/src/ui/components/MediaPane.tsx`

## Risks / mitigations
- Risk: overlay coordinate mapping across zoom/contain.
  - Mitigation: store normalized (0..1) positions relative to the displayed image rect.

## Rollback
Drop annotation table/column and remove overlay UI.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

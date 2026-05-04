# Work Packet: WP-0094 - Image Intake Sorter

Date: 2026-05-04
Owner: Codex
Status: DONE - implementation complete; validation not run in this pass

## Summary
Add an image intake sorter for pass/reject/pending review, with optional CKC profile linking.

## Why
Avatar/profile image collection needs fast triage. CKC already stores image pools, tags, notes, source paths, hashes, and thumbnails, so intake integrates with existing profile galleries instead of becoming a separate app.

## Scope
### In
- Select a source folder and scan common image formats: `jpg`, `jpeg`, `png`, `webp`, `gif`, `bmp`.
- Folder-only mode: move originals into `pass/`, `reject/`, or `pending/`; no CKC notes or tags are available.
- Linked profile mode: copy accepted images into the CKC profile image pool.
- Linked profile mode: copy pending images into CKC as pending and expose them through pending-image listing.
- Allow notes and tags only when linked to a CKC profile.
- Preserve source files in linked mode.
- Use style guide layout rules and no-space generated names.

### Out
- External legal/consent tracking.
- AI auto-rating decisions.

## Acceptance criteria
- [x] Folder-only sessions create required status folders and move files.
- [x] Folder-only UI hides/disables notes and tags.
- [x] Linked sessions copy accepted images into the selected profile.
- [x] Linked sessions expose pending images through `ckc:listPendingImages`.
- [x] Notes/tags written in linked mode reuse existing CKC image metadata.
- [x] Duplicate handling follows current image import policy.
- [ ] Manual narrow-window UI review run.

## Test plan
- [ ] Unit tests for scan/filter/status path planning.
- [ ] Backend tests for linked copy/import and pending metadata.
- [ ] Manual smoke with a temp folder containing mixed image formats.
- [ ] Narrow-window UI review against the style guide checklist.

## Governance checklist
- [x] Task Board updated with this WP status.
- [x] Spec updated with sorter behavior and profile-link rules.
- [x] Session dump alignment checked; no censorship/template conflicts expected.

## Implementation notes
- Key files touched:
  - `CKC_main/app/backend/library.js`
  - `CKC_main/app/backend/db.js`
  - `CKC_main/app/main.js`
  - `CKC_main/app/preload.js`
  - `CKC_main/src/ui/App.tsx`
  - `CKC_main/src/ui/components/Drawer.tsx`
  - `CKC_main/src/ui/views/IntakeSorterView.tsx`
  - `CKC_main/src/ui/views/intakeSorterView.module.css`
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.062.md`
- Data model changes:
  - `ImageAsset.review_status` with default `accepted`.
- IPC/API changes:
  - `ckc:scanIntakeFolder`
  - `ckc:classifyIntakeImage`
  - `ckc:listPendingImages`

## Risks / mitigations
- Risk: destructive moves in folder-only mode.
- Mitigation: folder-only moves only into explicit sibling status folders and uses no-space unique destination names; linked mode is copy-only.

## Rollback
Remove the sorter view and IPC handlers; imported CKC images remain normal gallery assets unless manually cleaned up.

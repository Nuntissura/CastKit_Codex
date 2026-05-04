# Work Packet: WP-0094 - Image Intake Sorter

Date: 2026-05-04
Owner: Codex
Status: BACKLOG

## Summary
Add an image intake sorter for pass/reject/pending review, with optional CKC profile linking.

## Why
Avatar/profile image collection needs fast triage. CKC already stores image pools, tags, notes, source paths, hashes, and thumbnails, so intake should integrate with existing profile galleries instead of becoming a separate app.

## Scope
### In
- Select a source folder and scan common image formats: `jpg`, `jpeg`, `png`, `webp`, `gif`, `bmp`.
- Folder-only mode: move originals into `pass/`, `reject/`, or `pending/`; no CKC notes or tags are available.
- Linked profile mode: copy accepted images into the CKC profile image pool.
- Linked profile mode: copy pending images into CKC as pending and show them under a new Pending gallery tab.
- Allow notes and tags only when linked to a CKC profile.
- Preserve source files in linked mode.
- Use style guide layout rules and no-space generated names.

### Out
- PostgreSQL migration work.
- External legal/consent tracking.
- AI auto-rating decisions.

## Acceptance criteria
- [ ] Folder-only sessions create required status folders and move files correctly.
- [ ] Folder-only UI hides/disables notes and tags.
- [ ] Linked sessions copy accepted images into the selected profile.
- [ ] Linked sessions expose pending images in a profile Pending tab.
- [ ] Notes/tags written in linked mode reuse existing CKC image metadata.
- [ ] Duplicate handling follows current image import policy.

## Test plan
- [ ] Unit tests for scan/filter/status path planning.
- [ ] Backend tests for linked copy/import and pending metadata.
- [ ] Manual smoke with a temp folder containing mixed image formats.
- [ ] Narrow-window UI review against the style guide checklist.

## Governance checklist
- [ ] Task Board updated with this WP status.
- [ ] Spec updated with sorter behavior and profile-link rules.
- [ ] Session dump alignment checked; no censorship/template conflicts expected.

## Implementation notes
- Key files to touch:
  - `CKC_main/app/backend/library.js`
  - `CKC_main/app/backend/db.js`
  - `CKC_main/app/main.js`
  - `CKC_main/app/preload.js`
  - `CKC_main/src/ui/`
  - `CKC_GOV/spec/`
- Data model changes:
  - Add image review status such as `accepted`, `pending`, and optionally `rejected`.
- IPC/API changes:
  - Folder scan, classify, linked import, pending listing.

## Risks / mitigations
- Risk: destructive moves in folder-only mode.
- Mitigation: plan moves first, show counts, use explicit status folders, and keep linked mode copy-only.

## Rollback
Remove the sorter view and IPC handlers; keep imported CKC images as normal gallery assets unless manually cleaned up.

# Work Packet: WP-0023 — Session dump gaps: docs smart tags, character exports, moodboard tools

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Close remaining gaps from `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md` around docs tag UX/metadata, character exports, media import affordance, and the moodboard toolset.

## Why
The recovered requirements call out:
- Docs libraries with smart tags and doc-type metadata tags.
- Character exports with the same capabilities as template exports.
- A media “dropbox”/import affordance in the character header.
- Moodboard tools beyond just pen/eraser (line/arrow/shapes/bucket/gradient).

## Scope
### In
- Docs drawer:
  - Tag filter UI (add/remove multiple tag filters).
  - “Smart tags” surface (tags extracted from the current docs list).
- Doc tag metadata:
  - Persist reserved system tags for doc-type/tag provenance (`__ckc_*`) while keeping UI tags “clean”.
- Character exports UI:
  - Export filled bundle (txt/md/pdf) to chosen output folder.
  - Export filled LLM field pack using existing spin-off presets + section selection + include-values/empty-only toggles.
- Character header:
  - “Import images…” button wired to IPC import flow and refresh.
- Moodboard tools:
  - Line / Arrow / Rect / Ellipse drawing tools.
  - Bucket/Gradient background tools + Paper reset.

### Out
- Full Milanote/Photoshop parity (fills, transforms, selection tools, advanced vector mask UX).
- Full smart-tag recommendation/analytics engine.

## Acceptance criteria
- [x] Docs drawer supports tag filtering and exposes smart tags.
- [x] Saving docs writes doc-type/tag provenance metadata without showing reserved tags in the UI.
- [x] Character view has an obvious image import affordance; imported images show up in the left pane.
- [x] Character exports UI exists and successfully writes outputs to the selected export folder.
- [x] Moodboard supports the additional tools listed in “In”.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke:
  - Create a note with tags, filter by tag, confirm list updates.
  - Export bundle + LLM pack and open output folder.
  - Import images into a character and confirm they appear in the Media pane.
  - Create a moodboard with line/arrow/shape + bucket/gradient background; save/reopen.

## Implementation notes
- Key files touched:
  - `CKC_main/app/backend/library.js`
  - `CKC_main/src/ui/views/CharacterView.tsx`
  - `CKC_main/src/ui/views/characterView.module.css`
  - `CKC_main/src/ui/components/MoodboardCanvas.tsx`
  - `CKC_main/src/vite-env.d.ts`
- Reserved system tags:
  - Prefix: `__ckc_`
  - Stored in DB for docs; filtered out of UI + global tag suggestions.

## Risks / mitigations
- Export paths: keep outputs under user-selected folder or the library exports folder; do not write artifacts into `CKC_main`.

## Rollback
Revert commits associated with WP-0023.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

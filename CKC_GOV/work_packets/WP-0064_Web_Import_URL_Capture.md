# Work Packet: WP-0064 — Web Import (URL capture)

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add an explicit “Import from URL” action that downloads a file and imports it through CKC’s normal ingest pipeline, storing provenance metadata (`source_url` + optional `source_note`).

## Why
- Fast capture loop (screenshots, references) without manual download steps.
- Provenance matters for later tracing/credits.
- Spec: `CastKit_Codex_Spec_v00.041.md` §11.11.

## Scope
### In
- Import from URL (Library/Inbox and Character header).
- Download to a temp file, then ingest using the existing import code path.
- Store metadata per imported asset:
  - `source_url` (string)
  - `source_note` (string, optional)
- UI shows provenance on the image metadata panel (read-only display + editable note).

### Out
- Automatic/background fetching.
- Full web clipper (HTML capture, multi-asset pages).
- Authenticated downloads / cookies.

## Acceptance criteria
- [x] User can paste a URL and import; errors are shown clearly if download fails.
- [x] Imported assets record `source_url` and can show/edit `source_note`.
- [x] No imports touch `D:`; downloads/temps live under app temp or libraryRoot.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] Manual: import a direct image URL; confirm it appears in Inbox/Character and provenance is visible.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (v00.041).

## Implementation notes
- Prefer Electron main process download (Node `fetch` + stream) to avoid CORS.
- Add DB columns on `ImageAsset` (schema upgrade).
- Shipped:
  - New IPC: `ckc:importFromUrl` → `CKCLibrary.importFromUrl`.
  - DB: `ImageAsset.source_url` (read-only provenance) + `ImageAsset.source_note` (editable).
  - UI: “Import URL…” in Character header and in Library → Inbox bar.
  - Viewer: provenance shown in the bottom metadata panel (copy URL + edit note).

## Risks / mitigations
- Risk: downloading non-image content.
  - Mitigation: detect content-type, validate file extension, and show a warning.

## Rollback
DB schema changes are additive; feature can be disabled via UI gating if needed.

## Notes
- Do NOT touch `D:`.

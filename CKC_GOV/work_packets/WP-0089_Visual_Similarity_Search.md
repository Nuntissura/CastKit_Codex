# Work Packet: WP-0089 — Visual similarity search

Date: 2026-02-15
Owner: Codex
Status: DONE (2026-02-16)

## Summary
Add "Find similar images" feature using perceptual hashing (dHash) to find visually similar images in the library.

## Why
- "I have the perfect reference somewhere..." is a daily problem for large image libraries.
- Text tags don't capture visual similarity (e.g., similar poses, compositions, color schemes).
- Helps users discover forgotten references and find alternatives.
- Complements existing color search (WP-0066) and near-duplicate finder (WP-0067).
- Spec: `CastKit_Codex_Spec_v00.058.md` §12.7 "Visual Similarity Search".

## Scope
### In
- Similarity metric:
  - dHash (`ImageAsset.dhash_hex`) + Hamming distance (0..64)
- "Find similar" action:
  - MediaPane metadata bar: "Similar…" (single selection)
  - Results modal with distance threshold (0..32) and re-search
  - Click result: select (if in current list) or jump-to owning character+image (when host provides a jump handler)

### Out
- Reverse image search from external URLs (can add later)
- 3D model similarity (images only for v1)
- Face similarity / character recognition (privacy concern)

## Dependencies
None (reuses existing dHash implementation from near-duplicate finder).

## Acceptance criteria
- [x] Can compute/store dHash for images (existing; reused)
- [x] "Find similar" returns results sorted by dHash distance
- [x] Similarity threshold control filters results
- [x] Similarity results can be opened/jumped-to from the UI
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Test plan
- [x] Unit tests for dHash similarity scoring (`findSimilarImages`)
- [ ] Manual: find similar for various image types (photos, art, screenshots)
- [ ] Performance test: similarity search on 10k images
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (`CastKit_Codex_Spec_v00.058.md` §12.7).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/app/backend/library.js` — `findSimilarImages` (dHash + Hamming distance)
  - `CKC_main/app/main.js` + `CKC_main/app/preload.js` — IPC wiring (`ckc:findSimilarImages`)
  - `CKC_main/src/ui/components/MediaPane.tsx` — Similar… button + modal UI
  - `CKC_main/src/ui/App.tsx` + `CKC_main/src/ui/views/CharacterView.tsx` — jump-to wiring
  - `CKC_main/test/backend_similarity_search.test.js` — unit test

## Notes
- CLIP model (~400MB) shared with AI tagging (WP-0084)
- Embedding storage: 512 floats × 4 bytes = 2KB per image (acceptable overhead)
- Consider showing similarity score as percentage (0.85 → "85% similar")
- Future enhancement: "Cluster by visual similarity" view (group similar images automatically)
- Do NOT touch `D:`.

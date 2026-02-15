# Work Packet: WP-0089 — Visual similarity search

Date: 2026-02-15
Owner: TBD
Status: BACKLOG

## Summary
Add "Find similar images" feature that uses perceptual hashing or embeddings to find visually similar images in the library.

## Why
- "I have the perfect reference somewhere..." is a daily problem for large image libraries.
- Text tags don't capture visual similarity (e.g., similar poses, compositions, color schemes).
- Helps users discover forgotten references and find alternatives.
- Complements existing color search (WP-0066) and near-duplicate finder (WP-0067).
- Spec: `CastKit_Codex_Spec_v00.052.md` §12.7 "Visual Similarity Search".

## Scope
### In
- Perceptual image embeddings:
  - Use CLIP embeddings (512-dim vectors) for semantic similarity
  - Store embeddings in `ImageAsset.clip_embedding` (BLOB or JSON)
  - Compute embeddings on import (background job)
- "Find similar" action:
  - Right-click image → "Find similar"
  - Shows top 20 most similar images
  - Similarity threshold slider (0.5 - 0.95)
  - Results sorted by similarity score
- Similarity metrics:
  - Cosine similarity for CLIP embeddings
  - Visual preview: side-by-side comparison
- Bulk embedding generation:
  - "Generate embeddings for all images" action (Tools menu)
  - Progress UI with cancel support
- Similarity search UI:
  - Grid view with similarity scores
  - Click to open image or add to collection
  - "More like this" button to chain searches

### Out
- Reverse image search from external URLs (can add later)
- 3D model similarity (images only for v1)
- Face similarity / character recognition (privacy concern)

## Dependencies
- `@xenova/transformers` — CLIP model for embeddings (already planned for WP-0084)
- `sharp` — image preprocessing

## Acceptance criteria
- [ ] Can compute CLIP embeddings for images
- [ ] "Find similar" shows relevant visually similar images
- [ ] Similarity search completes in <500ms for 10k image library
- [ ] Embeddings persist in database (not recomputed every time)
- [ ] Bulk embedding generation works with progress/cancel

## Test plan
- [ ] Unit tests for embedding computation and similarity scoring
- [ ] Integration test: import images, generate embeddings, search for similar
- [ ] Manual: find similar for various image types (photos, art, screenshots)
- [ ] Performance test: similarity search on 10k images
- [ ] `npm test`
- [ ] `npx tsc --noEmit`

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (`CastKit_Codex_Spec_v00.052.md` §12.7).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/app/ai/embeddings.js` — CLIP embedding generation
  - `CKC_main/app/lib/similarity-search.js` — Similarity search logic
  - `CKC_main/app/ipc/similarity.js` — IPC handlers
  - `CKC_main/src/ui/components/SimilarImagesPanel.tsx` — Search results UI
- Database schema changes:
  - Add `ImageAsset.clip_embedding` (BLOB or TEXT JSON array)
  - Add `ImageAsset.embedding_version` (track model version)
- CLIP embedding generation:
  ```javascript
  import { pipeline } from '@xenova/transformers';
  const extractor = await pipeline('feature-extraction', 'Xenova/clip-vit-base-patch32');
  const embedding = await extractor(imageBuffer, { pooling: 'mean', normalize: true });
  // embedding is a 512-dim float32 array
  ```
- Similarity search:
  ```javascript
  function cosineSimilarity(a, b) {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magA * magB);
  }

  function findSimilar(targetEmbedding, allEmbeddings, threshold = 0.7) {
    return allEmbeddings
      .map((emb, idx) => ({ idx, score: cosineSimilarity(targetEmbedding, emb) }))
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }
  ```
- Optimization:
  - For very large libraries (10k+ images), consider using FAISS or Annoy for approximate nearest neighbors
  - For v1, brute-force cosine similarity is fast enough (10k × 512 floats = ~5MB, easily fits in memory)

## Notes
- CLIP model (~400MB) shared with AI tagging (WP-0084)
- Embedding storage: 512 floats × 4 bytes = 2KB per image (acceptable overhead)
- Consider showing similarity score as percentage (0.85 → "85% similar")
- Future enhancement: "Cluster by visual similarity" view (group similar images automatically)
- Do NOT touch `D:`.

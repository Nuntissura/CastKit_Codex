# Work Packet: WP-0084 — AI-assisted image tagging

Date: 2026-02-15
Owner: TBD
Status: BACKLOG

## Summary
Add AI-powered automatic tagging for images on import and bulk tagging for existing untagged/under-tagged images using local vision models or cloud APIs.

## Why
- Manual tagging is the #1 time sink for large image libraries (5000+ images).
- Users import hundreds of reference images and need fast organization.
- Auto-tagging can suggest: objects, scenes, moods, art styles, colors, character features.
- 10x speed improvement for library organization.
- Spec: `CastKit_Codex_Spec_v00.052.md` §12.2 "AI-Assisted Tagging".

## Scope
### In
- Auto-tag on import (optional, configurable):
  - Detect objects, scenes, moods, art styles
  - Store suggested tags with confidence scores
  - User can accept/reject/edit suggestions before finalizing
- Bulk tag existing images:
  - "Tag untagged images" action (Library toolbar or Export Hub)
  - Progress UI with cancel support
  - Review suggested tags before applying
- Model options (user-configurable):
  - **Local model** (privacy-first): CLIP, BLIP, or similar via local inference
  - **Cloud API** (optional): OpenAI Vision, Google Cloud Vision, etc.
  - Fallback to local if cloud unavailable
- Tag suggestion UI:
  - Show confidence scores
  - Batch accept/reject
  - Edit before applying
  - Remember user corrections (reinforce model)

### Out
- Training custom models on user's library (v1 keeps it simple)
- Face recognition / character identification (privacy/complexity concern)
- NSFW detection (future consideration)

## Dependencies
Required packages:
- `@xenova/transformers` — run CLIP/BLIP models in Node.js (ONNX runtime)
- `sharp` — image preprocessing (resize/normalize for model input)
- Optional cloud SDKs (if user enables):
  - `openai` — for GPT-4 Vision
  - `@google-cloud/vision` — for Google Cloud Vision API

## Acceptance criteria
- [ ] Can auto-tag images on import with user confirmation
- [ ] Bulk tagging works for 100+ images with progress/cancel
- [ ] Tags include confidence scores
- [ ] User can review and edit before applying
- [ ] Works offline with local model (no internet required)
- [ ] Settings UI to choose model provider and configure API keys

## Test plan
- [ ] Unit tests for tag extraction and scoring
- [ ] Integration test: import 10 images, verify tag suggestions
- [ ] Performance test: bulk tag 100 images, measure time
- [ ] Manual: import various image types (photos, art, screenshots), verify tag quality
- [ ] Manual: test offline mode (local model only)
- [ ] `npm test`
- [ ] `npx tsc --noEmit`

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (`CastKit_Codex_Spec_v00.052.md` §12.2).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/app/ai/vision.js` — Vision model inference wrapper
  - `CKC_main/app/ai/tag-suggestions.js` — Tag extraction and scoring
  - `CKC_main/app/ipc/ai-tagging.js` — IPC handlers for tagging operations
  - `CKC_main/src/ui/components/TagSuggestionPanel.tsx` — Tag review UI
  - `CKC_main/src/ui/components/SettingsDialog.tsx` — AI model configuration
- Database schema changes:
  - Add `ImageAsset.suggested_tags_json` (store suggestions before user confirms)
  - Add `ImageAsset.auto_tagged_at` timestamp
- Local model approach (privacy-first default):
  ```javascript
  // Use CLIP for zero-shot classification
  import { pipeline } from '@xenova/transformers';
  const classifier = await pipeline('zero-shot-image-classification');
  const result = await classifier(imageBuffer, candidateLabels);
  ```
- Model storage:
  - Download models to `<CKC_ROOT>/CKC_GOV/targets/cache/ai-models/`
  - First-run downloads CLIP model (~400MB)
  - Progress UI during model download

## Notes
- Start with CLIP (zero-shot) for simplicity
- Candidate labels: curated list of ~200 common tags for worldbuilding (fantasy, sci-fi, modern, etc.)
- User can add custom labels to the candidate list
- Consider tag taxonomy/hierarchy in future iterations
- Do NOT touch `D:`.

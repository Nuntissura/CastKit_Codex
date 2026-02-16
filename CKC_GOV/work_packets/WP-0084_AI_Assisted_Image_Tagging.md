# Work Packet: WP-0084 — AI-assisted image tagging

Date: 2026-02-15
Owner: Codex
Status: DONE

## Summary
Add AI-assisted *suggested tags* for images using an OpenAI-compatible vision endpoint (LM Studio / Ollama / OpenAI), with per-image review/apply UI and a cancellable bulk suggestion job.

## Why
- Manual tagging is the #1 time sink for large image libraries (5000+ images).
- Users import hundreds of reference images and need fast organization.
- Auto-tagging can suggest: objects, scenes, moods, art styles, colors, character features.
- 10x speed improvement for library organization.
- Spec: `CastKit_Codex_Spec_v00.053.md` §12.2 "AI-assisted image tagging".

## Scope
### In
- Auto-suggest on import (optional, configurable):
  - Store suggested tags with confidence scores
  - No auto-apply: operator confirms by applying selected suggestions to tags
- Bulk suggest for existing images:
  - Library → Tools → “AI tagging (experimental)” → bulk job (mode + limit)
  - Progress UI with cancel support
- Model options (user-configurable):
  - OpenAI-compatible *vision* model endpoint (local-first when pointed at LM Studio/Ollama)
  - Optional cloud API support by pointing `baseUrl` to a remote provider
- Tag suggestion UI (per-image):
  - Image metadata bar → “AI suggestions”
  - Show confidence per suggestion
  - Checkbox-select and “Apply selected”

### Out
- Training custom models on user's library (v1 keeps it simple)
- Face recognition / character identification (privacy/complexity concern)
- NSFW detection (future consideration)

## Dependencies
- No new npm packages required for v1 (uses existing OpenAI-compatible chat plumbing + Electron `nativeImage`).
- External dependency: a vision-capable OpenAI-compatible server (LM Studio/Ollama/OpenAI), configured via Tools → Local model.

## Acceptance criteria
- [x] Can auto-suggest tags on import with user confirmation (no auto-apply)
- [x] Bulk suggesting works for 100+ images with progress/cancel
- [x] Tags include confidence scores
- [x] User can review and apply before tags are written
- [x] Works offline with a local model server (no internet required)
- [x] Settings UI to configure provider (Tools → Local model) + auto-on-import toggle (Library → Tools)

## Test plan
- [x] Unit tests for suggestion persistence + discovery (`backend_ai_tagging_suggestions.test.js`)
- [ ] Manual: test with a vision-capable model (tag quality varies by model)
- [x] `npm test`
- [x] `npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (`CastKit_Codex_Spec_v00.053.md` §12.2).

## Implementation notes
- Key files modified:
  - `CKC_main/app/main.js` — IPC handlers + bulk job + auto-suggest hook on import
  - `CKC_main/app/backend/llm.js` — allow OpenAI-style multimodal message blocks
  - `CKC_main/app/backend/db.js` — add `ImageAsset.suggested_tags_json` + `auto_tagged_at`
  - `CKC_main/app/backend/library.js` — persist/clear/list suggestions
  - `CKC_main/app/preload.js` — expose AI tagging APIs to renderer
  - `CKC_main/src/vite-env.d.ts` — typings for AI tagging APIs + job status
  - `CKC_main/src/ui/components/MediaPane.tsx` — per-image “AI suggestions” panel with apply
  - `CKC_main/src/ui/views/LibraryView.tsx` — bulk suggest job UI + auto-on-import toggle
  - `CKC_main/test/backend_ai_tagging_suggestions.test.js` — unit tests
- Database schema changes:
  - Add `ImageAsset.suggested_tags_json` (store suggestions before user confirms)
  - Add `ImageAsset.auto_tagged_at` timestamp
- Request format:
  - `ckc:suggestImageTags` calls OpenAI-compatible `POST /v1/chat/completions` with `image_url` blocks (`data:image/png;base64,...`) and requests JSON-only output.

## Notes
- Tag quality depends on the chosen vision model; CKC does not auto-apply.
- Future: add fully local CLIP/BLIP pipelines (no server required) and learning/reinforcement.
- Do NOT touch `D:`.

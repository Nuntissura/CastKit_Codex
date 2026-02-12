# Work Packet: WP-0039 — Local Model Integration Spike (Experimental)

Date: 2026-02-12
Owner: Codex
Status: DONE

## Summary
Add an experimental “local model” integration path by letting CKC call a locally running LLM server (OpenAI-compatible HTTP API) via Electron main-process IPC, with a minimal UI to test prompts and view responses.

## Why
Local/offline generation is useful for character/notes workflows and avoids cloud dependency. This WP is a feasibility spike: integrate the thinnest vertical slice to prove the plumbing and UX, without shipping model weights or complex agent features.

## Scope
### In
- Configurable local LLM settings stored in `ckc-config.json` (e.g. base URL + model name; optional API key).
- One IPC method (renderer → main) to send a prompt and receive a response.
- Minimal UI (Tools tab) to:
  - configure settings
  - send a test prompt
  - view the response/error
- Spec update documenting the feature and config keys.

### Out
- Bundling model weights/binaries with the app.
- Streaming responses, embeddings, RAG, tool calling, or automatic tagging features.
- Any background indexing pipeline.

## Acceptance criteria
- [ ] User can configure a local server base URL + model, send a prompt, and see a response.
- [ ] If the server is not running / misconfigured, CKC surfaces a clear error and does not crash.
- [ ] Settings persist via `ckc-config.json` and do not break existing config fields.
- [ ] Spec updated and mirrored.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual (no server): try prompt → shows error without crashing.
- [ ] Manual (with local server): run a local LLM (e.g. Ollama or LM Studio) → prompt returns response.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored (version bump + changelog entry + archive old spec):
  - update `CKC_GOV/spec/CastKit_Codex_Spec_v*.md`
  - mirror into `CKC_main/docs/`
- [x] Session dump alignment: no conflicts; if representation differs, document the mapping in the spec (session dump remains verbatim).

## Implementation notes
- Key files to touch:
  - `CKC_main/app/main.js` (IPC handler + HTTP call)
  - `CKC_main/app/preload.js` (expose method)
  - `CKC_main/src/vite-env.d.ts` (typed API)
  - `CKC_main/src/ui/views/CharacterView.tsx` (Tools UI)
  - Optional: `CKC_main/app/backend/llm.js` (client helper)
- Data model changes:
  - None (config-only).
- IPC/API changes:
  - Add `ckc:llmChat` (name TBD) and expose as `window.ckc.llmChat(...)`.

## Risks / mitigations
- Different local servers vary in API compatibility → target OpenAI-compatible `/v1/chat/completions` first; document known-good defaults.
- Prompt content may contain sensitive data → make it explicit this is local-only and user-controlled.

## Rollback
Remove the IPC + UI and delete the `llm` config fields (leave unknown keys tolerated).

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

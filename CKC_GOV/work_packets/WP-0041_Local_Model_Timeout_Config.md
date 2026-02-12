# Work Packet: WP-0041 — Local Model Timeout (Configurable)

Date: 2026-02-12
Owner: Codex
Status: BACKLOG

## Summary
Increase the local model request timeout and make it configurable in the UI/config so slow LM Studio generations (especially with “thinking”) don’t fail.

## Why
LM Studio local models can take longer than 60s to respond. CKC currently hard-times out local model calls too aggressively, causing “LLM request timed out.”

## Scope
### In
- Add `llm.timeoutSec` to config (`ckc-config.json`) with a reasonable default.
- Expose the timeout setting in Character → Tools → Local model (experimental).
- Use `llm.timeoutSec` for the IPC call timeout.

### Out
- Streaming responses.
- Cancellation UI.
- Any model bundling.

## Acceptance criteria
- [ ] Local model requests don’t time out at ~60s by default (default timeout increased).
- [ ] User can set a longer timeout in the UI and it persists.
- [ ] Misconfigured timeout values are clamped to a safe range (no crashes).

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual: set timeout to a low value (e.g. 5s) and confirm timeout error; set high (e.g. 900s) and confirm long-running call can complete.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (version bump + changelog entry + archive old spec):
  - update `CKC_GOV/spec/CastKit_Codex_Spec_v*.md`
  - mirror into `CKC_main/docs/`
- [ ] Session dump alignment: no conflicts; if representation differs, document the mapping in the spec (session dump remains verbatim).

## Implementation notes
- Key files to touch:
  - `CKC_main/src/ui/views/CharacterView.tsx`
  - `CKC_main/app/main.js`
  - `CKC_GOV/spec/CastKit_Codex_Spec_v*.md`
- Data model changes:
  - None (config-only).
- IPC/API changes:
  - None (uses existing `ckc:llmChat`; timeout comes from config).

## Risks / mitigations
- Excessive timeouts can hang the UI waiting on IPC → clamp to a max (e.g. 2 hours) and surface “busy” state.

## Rollback
Revert the config/UI changes and restore the previous timeout behavior.

## Notes
- Do NOT touch `D:`.


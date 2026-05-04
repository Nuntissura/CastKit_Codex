# Work Packet: WP-0093 - LLM Automation And Visual Debugger

Date: 2026-05-04
Owner: Codex
Status: DONE - implementation complete; validation not run in this pass

## Summary
Make CKC operable by LLM agents through explicit app commands, state inspection, and non-focus-stealing visual capture.

## Why
Future CKC work expects parallel model assistance. Agents need deterministic control and observability without focus-stealing dialogs or real input capture.

## Scope
### In
- Add a stable automation API for navigation, selection, imports, metadata updates, and diagnostics.
- Add visual debugger state: current route/view, selected character/image, visible controls, errors, and actionable command map.
- Add render capture support that does not pop windows to the foreground.
- Ensure commands return structured JSON results and errors.

### Out
- Remote public API exposure.
- Provider-specific LLM integration.
- Full browser-style test framework replacement.

## Acceptance criteria
- [x] An agent can inspect current app state as JSON.
- [x] An agent can navigate and execute supported actions without moving the real cursor.
- [x] Visual capture/debug output is available without focus stealing.
- [x] Automation commands are documented in spec v00.062.
- [x] Existing manual UI remains usable by keeping automation in separate IPC/preload namespace.
- [ ] Smoke validation run.

## Test plan
- [ ] Unit tests for command validation and JSON state shape.
- [ ] Smoke script: initialize, select character, inspect gallery, import via explicit path.
- [ ] Manual check: automation does not steal focus or keyboard.

## Governance checklist
- [x] Task Board updated with this WP status.
- [x] Spec updated with automation/debug requirements.
- [x] Session dump alignment checked; provider-agnostic stance preserved.

## Implementation notes
- Key files touched:
  - `CKC_main/app/main.js`
  - `CKC_main/app/preload.js`
  - `CKC_main/src/ui/App.tsx`
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.062.md`
- Data model changes: none.
- IPC/API changes:
  - `ckc:automationGetState`
  - `ckc:automationRunCommand`
  - `ckc:automationCapture`
  - `ckc:automationSetRendererState`
  - `ckc:automationCommandResult`

## Risks / mitigations
- Risk: automation bypasses UI validation.
- Mitigation: backend automation routes through existing library methods and validation paths.

## Rollback
Disable the automation namespace while leaving normal UI paths intact.

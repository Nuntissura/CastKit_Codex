# Work Packet: WP-0093 - LLM Automation And Visual Debugger

Date: 2026-05-04
Owner: Codex
Status: BACKLOG

## Summary
Make CKC fully operable by LLM agents through explicit app commands, state inspection, and a visual debugger that does not hijack the operator's screen, cursor, or keyboard.

## Why
Future CKC work expects parallel model assistance. Agents need deterministic control and observability without focus-stealing dialogs or real input capture.

## Scope
### In
- Add a stable automation API for navigation, selection, imports, metadata updates, and diagnostics.
- Add visual debugger state: current route/view, selected character/image, visible controls, errors, and actionable command map.
- Add screenshot or render capture support that does not pop windows to the foreground.
- Replace avoidable modal OS dialogs in automation paths with parameterized commands.
- Ensure commands return structured JSON results and errors.

### Out
- Remote public API exposure.
- Provider-specific LLM integration.
- Full browser-style test framework replacement.

## Acceptance criteria
- [ ] An agent can inspect current app state as JSON.
- [ ] An agent can navigate and execute supported actions without moving the real cursor.
- [ ] Visual capture/debug output is available without focus stealing.
- [ ] Automation commands are documented and covered by smoke tests.
- [ ] Existing manual UI remains usable.

## Test plan
- [ ] Unit tests for command validation and JSON state shape.
- [ ] Smoke script: initialize, select character, inspect gallery, import via explicit path.
- [ ] Manual check: automation does not steal focus or keyboard.

## Governance checklist
- [ ] Task Board updated with this WP status.
- [ ] Spec updated with automation/debug requirements.
- [ ] Session dump alignment checked; provider-agnostic stance preserved.

## Implementation notes
- Key files to touch:
  - `CKC_main/app/main.js`
  - `CKC_main/app/preload.js`
  - `CKC_main/src/ui/`
  - `CKC_GOV/spec/`
- Data model changes: none expected.
- IPC/API changes: new automation/debug IPC namespace.

## Risks / mitigations
- Risk: automation bypasses UI validation.
- Mitigation: route commands through existing backend validation and audit paths.

## Rollback
Disable the automation namespace while leaving normal UI paths intact.

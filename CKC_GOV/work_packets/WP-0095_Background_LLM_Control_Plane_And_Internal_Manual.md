# Work Packet: WP-0095 - Background LLM Control Plane And Internal Manual

Date: 2026-05-04
Owner: Codex
Status: IN_PROGRESS

## Summary
Make CKC usable by one or more LLM agents as a background process through an internal manual, explicit command API, session coordination, non-focus-stealing visual capture, and deterministic navigation/testing helpers.

## Why
Agents must be able to operate and inspect the app without stealing the operator's keyboard, cursor, focus, or foreground windows. Multiple LLMs should be able to coordinate through app state and documented commands while the operator sleeps.

## Scope
### In
- Add an indexed internal manual that describes all Task Board features in practical LLM/operator terms.
- Expose the manual through IPC/preload and automation command results.
- Add multi-agent background sessions with IDs, heartbeats, leases, command logs, and structured state.
- Add non-focus-stealing screenshot/capture helpers that write files under `CKC_GOV/targets/CKC/automation_captures/`.
- Add background-safe navigation and command automation; no OS cursor, keyboard, or focus hijack.
- Add command discovery with examples and feature index.
- Document the control plane in the spec.

### Out
- Public remote API exposure.
- Browser-test framework replacement.
- OS-level input injection.

## Acceptance criteria
- [ ] An LLM can fetch an indexed internal manual as JSON and markdown.
- [ ] Multiple LLMs can create named sessions and heartbeat without foregrounding the app.
- [ ] Commands are executed through explicit IPC/backend paths, not cursor/keyboard input.
- [ ] Screenshots/captures can be saved in the background for visual debugging.
- [ ] Manual covers all Task Board features at a useful operational level.
- [ ] Spec and Task Board are updated.

## Test plan
- [ ] Manual JSON shape smoke.
- [ ] Session create/heartbeat/end smoke.
- [ ] Background capture smoke.
- [ ] Navigation command smoke.

## Governance checklist
- [ ] Task Board updated with this WP status.
- [ ] Spec updated with control-plane/manual requirements.
- [ ] No generated file/folder names with spaces.

## Implementation notes
- Expected files:
  - `CKC_main/app/backend/automationManual.js`
  - `CKC_main/app/backend/automationControl.js`
  - `CKC_main/app/main.js`
  - `CKC_main/app/preload.js`
  - `CKC_GOV/spec/`
  - `CKC_GOV/work_packets/`

## Risks / mitigations
- Risk: multiple LLMs issue conflicting commands.
- Mitigation: sessions, leases, and command log make ownership explicit; commands remain explicit and structured.
- Risk: screenshots steal focus.
- Mitigation: use Electron capture APIs only; never OS screenshot/input APIs.

## Rollback
Disable the automation/manual IPC namespace. Normal UI paths remain untouched.

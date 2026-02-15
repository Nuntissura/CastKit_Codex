# Work Packet: WP-0060 — Pop-out Reference Window (Always-on-Top)

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add a separate pop-out window for reference viewing (image viewer, optionally moodboard) with an always-on-top toggle.

## Why
- Mimics PureRef-like workflows: keep reference visible while writing/editing.
- High ROI for multi-monitor setups.
- Spec: `CastKit_Codex_Spec_v00.039.md` §11.7.

## Scope
### In
- “Pop out viewer” action from Character/Library image pane.
- Pop-out window shows the currently selected image and tracks selection changes.
- Always-on-top toggle.

### Out
- Advanced window tiling/docking.
- Multiple pop-out windows.

## Acceptance criteria
- [ ] User can open a pop-out reference window.
- [ ] Window can be toggled always-on-top.
- [ ] Pop-out updates when the selected image changes in the main window.

## Test plan
- [ ] `cd CKC_main; npm test`
- [ ] Manual: open pop-out, switch images, verify pop-out updates; toggle always-on-top.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale).

## Implementation notes
- Likely Electron multi-window work:
  - Create a new BrowserWindow and a small IPC channel for selection sync.
- Key files:
  - `CKC_main/app/main.js`
  - `CKC_main/app/preload.js`
  - `CKC_main/src/ui/*`

## Rollback
Remove the reference window and related IPC.

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.

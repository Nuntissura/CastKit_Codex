# Work Packet: WP-0051 - Moodboard text / sticky notes

Date: 2026-02-14
Owner: Codex
Status: DONE

## Summary
Add text elements:
- Create text boxes / sticky notes.
- Move/resize (ties into transform tool).
- Basic styling (text color, background color).

## Why
- Moodboards need labeling, callouts, and quick notes directly on-canvas.

## Scope
### In
- Text tool to add new text item.
- Edit selected text in a simple inspector (toolbar/panel).
- Render wrapped text on canvas.

### Out
- Rich text (bold/italics), markdown parsing (later).

## Acceptance criteria
- [x] Can add a text item, move it, edit its content.
- [x] Text persists in the moodboard JSON.

## Test plan
- [x] Manual: create/edit multiple notes; verify autosave restores them.
- [x] `cd CKC_main; npx tsc --noEmit`

## Governance checklist (MUST)
- [x] Task Board updated with this WP status.
- [x] Spec updated + mirrored.

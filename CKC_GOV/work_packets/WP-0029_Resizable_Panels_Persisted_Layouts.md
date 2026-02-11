# WP-0029 — Resizable panels + persisted layouts (2-panel vs 3-panel)

Date: 2026-02-11
Owner: Codex
Status: BACKLOG

## Summary
Add draggable splitters so panel widths can be adjusted in 2-panel and 3-panel modes, persist the layouts per mode, and restore them on restart.

## Motivation / context
CKC is used as a “portfolio book” with a primary 2-panel layout (media left, sheet right). When Notes/Stories/Moodboard is open, it becomes 3 panels (media, docs, sheet). Users need to resize these panels and have CKC remember their preferred layout.

## Scope
- Add splitters:
  - Library page: 2 panels (media | character list)
  - Character page:
    - default: 2 panels (media | sheet)
    - docs mode: 3 panels (media | docs | sheet)
- Persist layout widths:
  - Store a 2-panel layout and a 3-panel layout separately.
  - Restore on restart and when switching modes.
- Ensure resizing one panel adjusts others appropriately (sum stays 100%).

## Non-goals
- Complex docking/undocking system.
- Per-monitor layouts.

## Acceptance criteria
- [ ] Dragging splitter changes panel widths live.
- [ ] 2-panel layout is remembered when switching away and back.
- [ ] 3-panel layout is remembered when switching away and back.
- [ ] Layouts persist after app restart.
- [ ] Minimum widths prevent panels collapsing to unusable sizes.

## Test plan
- [ ] Manual: resize in Library, restart, confirm restored.
- [ ] Manual: open docs mode, resize 3 panels, switch back to 2 panels, confirm both remembered.
- [ ] Automated: `npm test`.

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [ ] Spec impact: yes (layout persistence). Bump spec + mirror into `CKC_main/docs/`.


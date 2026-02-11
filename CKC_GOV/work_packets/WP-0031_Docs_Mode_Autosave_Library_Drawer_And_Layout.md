# WP-0031 — Notes/Stories/Moodboard: autosave + library drawer search + layout restoration

Date: 2026-02-11
Owner: Codex
Status: IN_PROGRESS

## Summary
Make Notes/Stories/Moodboard safe to use as a writing surface: autosave drafts, preserve state when switching tabs/docs, improve the docs-only library drawer (search + tags), and restore the “notes always visible” layout (notes top, stories/moodboard below).

## Motivation / context
- Switching doc type/doc currently risks losing unsaved content.
- The “docs library drawer” should support search + filters specific to docs.
- Requested layout: Notes always at top; below it show either Stories or Moodboard (toggle).
- “Full library” mode should allow browsing all docs types together when desired.

## Scope
- Autosave:
  - Debounced autosave while typing (and on blur) for notes/stories.
  - Moodboard autosave on change.
  - Persist drafts per doc id (no loss when switching docType or closing docs mode).
- Layout:
  - In docs mode, show Notes editor always on top.
  - Below Notes, show either Stories or Moodboard (toggle).
  - Keep 3-panel mode behavior (media | docs | sheet).
- Docs library drawer:
  - Search + tag filters apply to docs only.
  - Add “Full library” switch to browse all doc types.
  - Tag suggestions reflect the active docs scope.
- Tag semantics:
  - Confirm tags are doc-type aware (via hidden meta tags) while keeping user-visible tags simple.

## Non-goals
- Full rich-text editor.
- Complex multi-user editing.

## Acceptance criteria
- [ ] Switching docs/tabs never loses typed text (autosave works).
- [ ] Notes are always visible at top in docs mode.
- [ ] Drawer supports docs-only search + tag filtering and has a “Full library” view.
- [ ] State persists after restart (open doc selection and drafts where applicable).

## Test plan
- [ ] Manual: type in note, switch to story, come back: text is saved.
- [ ] Manual: type and kill app; restart: latest draft is present.
- [ ] Automated: `npm test`.

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [ ] Spec impact: yes (docs UX). Bump spec + mirror into `CKC_main/docs/`.

# Work Packet: WP-0047 - Carousel slideshow behavior

Date: 2026-02-13
Owner: Codex
Status: DONE

## Summary
Make Carousel mode behave like a slideshow in the normal (non-fullscreen) viewer:
- Auto-advance images on a timer.
- Provide a `Slideshow/Stop` toggle in the MediaPane header.
- Pause auto-advance while `Controls` is open to prevent mid-edit selection changes.

## Why
- “Carousel” is intended to be a passive viewing mode (TV/4K usage) more than a manual gallery.
- Auto-advance makes it feel like a real slideshow without requiring fullscreen.
- Pausing while controls are open prevents confusing/unsafe UX while editing notes/tags.

## Scope
### In
- MediaPane slideshow running in normal viewer (not only fullscreen).
- Enable + auto-start slideshow for:
  - Library frontpage carousel
  - Character view in Carousel mode
- Spec bump to reflect the shipped behavior.

### Out
- Fancy cross-fade transitions or preloading optimizations (future polish).
- New slideshow settings UI (interval customization) (future).

## Acceptance criteria
- [x] In carousel contexts, images auto-advance without entering fullscreen.
- [x] `Slideshow/Stop` toggle exists in the header bar.
- [x] Auto-advance pauses while `Controls` is open.

## Test plan
- [x] `cd CKC_main; npm test`
- [x] `cd CKC_main; npx tsc --noEmit`
- [ ] Manual: open Library, watch global carousel advance; open Character carousel; verify pause while editing notes/tags.

## Governance checklist (MUST)
- [x] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [x] Spec updated + mirrored:
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.036.md`
  - Mirror: `CKC_main/docs/CastKit_Codex_Spec_v00.036.md`

## Implementation notes
- Key files:
  - `CKC_main/src/ui/components/MediaPane.tsx`
  - `CKC_main/src/ui/views/LibraryView.tsx`
  - `CKC_main/src/ui/views/CharacterView.tsx`

## Rollback
Revert the MediaPane slideshow changes and remove the viewer-mode slideshow toggle.


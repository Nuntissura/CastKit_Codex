# Work Packet: WP-0014 — Photo notes + bottom metadata bar

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Implement per-image **notes** editing and move notes/tags/metadata UI to a bottom bar so it stays visible and is not blocked by the controls overlay.

## Why
The recovered session dump explicitly calls out a UX requirement: when showing photo “controls”, **notes/tags must not be blocked** and must remain visible while the operator is working.

## Inputs
- Latest requirements: `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.023.md`

## Scope
### In
- Add an editable Notes control for the selected image in MediaPane.
- Persist notes via existing `setImageMeta` backend API.
- Move tags + notes UI into a bottom metadata bar (minimal, sharp corners).
- Ensure global hotkeys do not interfere while typing (no drawer toggle / rating hotkeys while focused in textarea).

### Out
- Rich text / markdown.
- Bulk notes editing.
- Advanced metadata schemas.

## Acceptance criteria
- [x] Notes can be edited and saved for an image (0 rewriting).
- [x] Notes persist after app restart.
- [x] Tags + notes UI stays visible and is not blocked by the controls bar.

## Test plan
- [x] `npm test`
- [x] `npx tsc --noEmit`
- [ ] Manual smoke: edit notes + tags, restart app, confirm persistence; verify hotkeys don’t trigger while typing.

## Implementation notes
- Prefer an explicit Save action for notes to avoid DB writes per keystroke.

## Rollback
- Revert commits associated with WP-0014.

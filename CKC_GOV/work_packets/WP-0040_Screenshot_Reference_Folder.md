# Work Packet: WP-0040 — Screenshot Reference Folder

Date: 2026-02-12
Owner: Codex
Status: BACKLOG

## Summary
Create a dedicated folder for dumping UI screenshots as reference material for CKC development and LLM discussions, without polluting git status.

## Why
Screenshots are useful for describing UI/UX issues to Codex and other models. We need a predictable location where screenshots can be dropped and found later.

## Scope
### In
- Add `CKC_GOV/references/screenshots/` as the canonical “drop zone”.
- Ensure dropped files are ignored by git by default.
- Provide a `keep/` subfolder for any screenshots that should be committed/shared via git.
- Move any stray governance-root screenshot into the new drop zone (local organization).

### Out
- Any changes to backup scripts or packaging outputs.
- Any UI changes.

## Acceptance criteria
- [ ] Folder exists: `CKC_GOV/references/screenshots/`.
- [ ] Dropping screenshots into the folder does not create noisy untracked git status by default.
- [ ] A `keep/` subfolder exists for screenshots that should be committed.

## Test plan
- [ ] Manual: drop a `.png`/`.jpg` into `CKC_GOV/references/screenshots/` and confirm `git status` stays clean.

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly “No spec impact” with rationale):
  - No spec impact (repo hygiene / references only).
- [ ] Session dump alignment: no conflicts; if representation differs, document the mapping in the spec (session dump remains verbatim).

## Implementation notes
- Key files to touch:
  - `CKC_GOV/references/screenshots/.gitignore`
  - `CKC_GOV/references/screenshots/README.md`
  - `CKC_GOV/references/screenshots/keep/.gitkeep`

## Risks / mitigations
- Accidentally committing large binaries → ignore-by-default with an explicit `keep/` opt-in.

## Rollback
Delete `CKC_GOV/references/` and remove the WP row from the Task Board.

## Notes
- Do NOT touch `D:`.


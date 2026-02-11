# Work Packet: WP-0002 — Bring spec up to date (v00.019+)

Date: 2026-02-10
Owner: Codex
Status: DONE

## Summary
Create a new “current spec” aligned with the recovered requirements and keep older spec versions archived.

## Why
The old spec (`v00.004`) is a baseline and the latest iteration is captured in the recovered session dump. We need a clean, current spec file that we update with every addition, and we need a durable archive of prior versions.

## Inputs
- Latest requirements (truth): `CKC_GOV/spec/SESSION_DUMP_2026-02-10.md`
- Old baseline spec: `CKC_GOV/spec/archive_spec/CastKit_Codex_Spec_v00.004.md`

## Scope
### In
- Create/maintain current spec: `CKC_GOV/spec/CastKit_Codex_Spec_v00.019.md`
- Ensure older spec versions are stored in: `CKC_GOV/spec/archive_spec/`
- Mirror the current spec into the source repo so it’s versioned on GitHub:
  - `CKC_main/docs/CastKit_Codex_Spec_v00.019.md`

### Out
- Deep spec refactor (we can iterate later; this WP’s goal is “current + archived + mirrored”).

## Acceptance criteria
- [x] `CKC_GOV/spec/CastKit_Codex_Spec_v00.019.md` exists and reflects the recovered requirements.
- [x] `CKC_GOV/spec/archive_spec/` contains the old `v00.004` spec.
- [x] `CKC_main/docs/CastKit_Codex_Spec_v00.019.md` exists and matches the current spec content.

## Test plan
- [x] Verified `CastKit_Codex_Spec_v00.019.md` matches in both locations (hash-equal).

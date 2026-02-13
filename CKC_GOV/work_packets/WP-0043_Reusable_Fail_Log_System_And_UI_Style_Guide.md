# Work Packet: WP-0043 - Reusable Fail Log System + UI Style Guide

Date: 2026-02-13
Owner: Codex
Status: IN_PROGRESS

## Summary
Create a reusable, low-friction way to capture mistakes ("what went wrong" + "how to prevent it") and a visual style guidebook for the GUI so layout/spacing decisions stay consistent across CKC and future spin-offs (e.g. Handshake).

## Why
- We already have a fail log, but it is hard to reuse across projects and hard to browse/search when it grows.
- UI issues (overlap, tiny fields, inconsistent padding) repeat when there is no single "this is how we build screens" reference.

## Scope
### In
- Fail log kit:
  - Incident template (copy/paste).
  - Index file for quick browsing.
  - Per-incident files (one incident per file).
  - Optional helper script to create a new incident entry safely.
- UI style guidebook:
  - Design tokens (colors/typography/spacing) documented from current app CSS.
  - Layout rules + anti-patterns (what caused recent UI messes).
  - Component patterns (buttons, tabs, forms, panes, modals, error states).
  - A short checklist for reviewing new UI screens.

### Out
- Any behavioral changes to the application.
- Large refactors (e.g., moving all CSS into a new design-system package).

## Acceptance criteria
- [ ] A newcomer can add a new incident in <5 minutes using a template (no guessing what to write).
- [ ] Incidents are browsable via a single index (date/title/severity/links).
- [ ] UI style guide exists and is usable as a "house rules" doc (tokens + patterns + checklist).
- [ ] Docs avoid hard-coded drive letters (use `<CKC_ROOT>`).

## Test plan
- [ ] N/A (docs + scripts only)

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (or explicitly "No spec impact" with rationale):
  - No spec impact (docs/process only; app behavior unchanged).
- [ ] Session dump alignment: no conflicts.

## Implementation notes
- Key files to add:
  - `CKC_GOV/fail_log/INDEX.md`
  - `CKC_GOV/fail_log/INCIDENT_TEMPLATE.md`
  - `CKC_GOV/fail_log/incidents/INC-*.md`
  - `CKC_GOV/scripts/new_incident.ps1` (optional helper)
  - `CKC_GOV/references/style_guide/UI_STYLE_GUIDE.md` (canonical)
  - Mirror: `CKC_main/docs/UI_STYLE_GUIDE.md`
- Risks:
  - Too much ceremony -> keep templates short and practical.
  - Duplicate sources -> pick one canonical style guide and mirror it.

## Rollback
Delete the added docs/scripts (no app behavior impact).

## Notes
- Do NOT write build artifacts inside `CKC_main`.
- Do NOT touch `D:`.


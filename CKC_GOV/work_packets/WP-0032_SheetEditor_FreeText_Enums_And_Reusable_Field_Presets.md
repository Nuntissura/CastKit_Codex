# WP-0032 — Character sheet editor: free-text enums + reusable per-field presets

Date: 2026-02-11
Owner: Codex
Status: IN_PROGRESS

## Summary
Improve the character sheet editor so dropdown-like fields remain fast but never restrictive, and add reusable per-field value presets that can be reused across characters.

## Motivation / context
- Many enum fields need custom text not in the dropdown.
- Users want to reuse common snippets per Field ID across characters (field-specific reusable entries).

## Scope
- Enum inputs:
  - Replace strict `<select>` with a free-text input that still offers the enum values as suggestions (datalist/autocomplete).
- Field presets:
  - Provide suggestions for a field based on:
    - values previously used in that Field ID across the library
    - optional user-pinned presets (future-safe)
  - No “magic rewriting”: inserting a preset is explicit user action.

## Non-goals
- Full templating/macros language.
- AI rewrite features.

## Acceptance criteria
- [ ] Enum fields allow arbitrary input while still suggesting known options.
- [ ] A user can reuse a value for Field ID X across characters without copy-paste.
- [ ] Presets are field-specific (do not pollute other field IDs).

## Test plan
- [ ] Manual: type a custom value in an enum field; it saves and reloads.
- [ ] Manual: use a preset from another character for the same field id.
- [ ] Automated: `npm test`.

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [ ] Spec impact: yes (sheet editor UX). Bump spec + mirror into `CKC_main/docs/`.

# UI Style Guidebook (CastKit Codex)

Mirror of:
- `<CKC_ROOT>\\CKC_GOV\\references\\style_guide\\UI_STYLE_GUIDE.md`

Purpose:
- Make the UI consistent.
- Make UI mistakes repeatable to *avoid* (tiny fields, overlap, awkward wrapping).
- Make the design portable to future spin-offs (e.g. Handshake).

## 1) Design tokens (the "palette")
Tokens live in:
- `CKC_main/src/ui/styles/global.css`

Use CSS variables instead of hard-coded colors:
- `--bg-primary`, `--bg-secondary`, `--bg-accent`
- `--text-primary`, `--text-secondary`
- `--accent-color`, `--accent-glow`
- `--danger`, `--success`
- `--glass`, `--glass-border`, `--shadow-lg`

Rules:
- Prefer `var(--text-secondary)` for helper text and metadata.
- Error states use `--danger` and the standard `.error` box style.
- Keep corners sharp (global rule enforces it).

## 2) Typography
Base font stack is set globally (see `global.css`).

Rules:
- Use `font-weight: 800` sparingly for titles/labels only.
- Use `0.82rem - 0.9rem` for secondary/meta text.

## 3) Layout rules (avoid "overlap" and "tiny fields")
These prevent 90% of the messy layouts:

- Do not rely on `grid-template-columns: 1fr auto` for headers that contain a long left area and many right-side buttons. Use flex + wrapping instead.
- Any flex container that contains a scrolling child needs `min-height: 0` (or the child cannot shrink and things look broken).
- Put `overflow: auto` on the correct layer:
  - The scrolling area should be the *content* region, not the overall container that also controls sizing.
- Inputs inside flexible layouts should be `width: 100%` unless you *really* want a tiny intrinsic width.
- When wrapping buttons, allow them to drop to the next line cleanly:
  - Use `flex-wrap: wrap`
  - Use `margin-left: auto` on the actions row if needed

## 4) Components (house patterns)
### Buttons
- Default is "secondary" (outlined) style.
- Keep padding consistent (see `.btnSecondary`).

### Tabs
- Tabs use the `data-active='1'` pattern (see `.tabBtn`).

### Forms
- Forms are label + control stacks (`.docLabel`).
- Use responsive grids (`.docForm`) with a sane minimum width per field.

### Panes
- Headers should wrap cleanly and never overlap.
- Body regions should scroll; headers should not scroll.

### Errors
- Use the standard `.error` box and keep the message short + actionable.

### Modals
- Use `.modalBackdrop` and `.modal` patterns; ensure the modal content scrolls instead of overflowing the window.

## 5) UI review checklist (before calling a screen "done")
- Can I resize the window narrower without text overlapping controls?
- Do all text inputs remain usable (not squeezed into tiny boxes)?
- Is scrolling on the right layer (content scrolls; headers stay visible)?
- Are colors using tokens (no random hex values)?
- Are error messages actionable (what to do next)?

## 6) Visual references (screenshots)
Put reference screenshots here:
- `<CKC_ROOT>\\CKC_GOV\\references\\screenshots\\keep\\style_guide\\`

Name suggestion:
- `YYYY-MM-DD__<area>__<short-note>.png`


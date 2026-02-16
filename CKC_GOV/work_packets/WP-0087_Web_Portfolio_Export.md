# Work Packet: WP-0087 — Web portfolio export

Date: 2026-02-15
Owner: Codex
Status: IN_PROGRESS

## Summary
Export characters and image galleries as a static HTML website that can be opened locally or hosted on any web server (no backend required).

## Why
- Sharing is why people organize in the first place.
- Static HTML export enables:
  - Publishing on GitHub Pages, Netlify, personal websites
  - Offline viewing on tablets/phones
  - Sharing with collaborators without giving them full CKC access
  - Portfolio presentations for artists/writers
- No server/hosting costs (static files).
- Viral growth potential (people see the output and want CKC to create it).
- Spec: `CastKit_Codex_Spec_v00.055.md` §12.5 "Web Portfolio Export".

## Scope
### In
- Export wizard in Export Hub:
  - Select characters to include (or "All")
  - Select images to include per character (all, carousel only, frontpage only)
  - Select fields to include (all, or custom field selection like LLM export)
  - Choose export format: "Portfolio" (image-focused) or "Codex" (text-focused)
- Generated static site:
  - Single-page app (SPA) with no build step (vanilla HTML/CSS/JS)
  - Character grid on homepage (with icons)
  - Character detail page (sheet + image gallery)
  - Responsive design (mobile-friendly)
  - Theme: CKC default theme (dark mode with sharp corners)
  - Navigation: sidebar with character list
- Output structure:
  ```
  <exportRoot>/web-portfolio-<timestamp>/
    index.html
    characters/
      CHAR-000001.html
      CHAR-000002.html
    images/
      <character_id>/
        <image files>
    assets/
      style.css
      app.js
      icons/ (character icons)
  ```
- Export includes:
  - README.txt with usage instructions
  - License notice (CC0 or user-specified)

### Out
- Search functionality in exported site (v1 is static)
- Moodboard export (handled separately in WP-0082)
- Comments/annotations on exported site
- Dynamic content (everything is pre-rendered)

## Dependencies
None (pure HTML/CSS/JS export, no frameworks)

## Acceptance criteria
- [ ] Can export a library as a static HTML site
- [ ] Exported site opens in any browser (Chrome, Firefox, Safari)
- [ ] Exported site works offline (no CDN dependencies)
- [ ] Exported site is mobile-responsive
- [ ] Images are optimized (resized if needed, not raw originals)
- [ ] Field redaction works (can exclude NSFW fields if desired)

## Test plan
- [ ] Manual: export 10 characters, open in browser, verify navigation
- [ ] Manual: test on mobile browser (or Chrome DevTools mobile view)
- [ ] Manual: test offline (disconnect network, verify site still works)
- [ ] Manual: export with field filtering, verify excluded fields don't appear
- [ ] Performance: export 100 characters with 1000 images, verify file size
- [ ] `npm test`
- [ ] `npx tsc --noEmit`

## Governance checklist (MUST)
- [ ] Task Board updated (`CKC_GOV/taskboard/TASK_BOARD.md`) with this WP status.
- [ ] Spec updated + mirrored (`CastKit_Codex_Spec_v00.055.md` §12.5).

## Implementation notes
- Key files to create/modify:
  - `CKC_main/app/lib/export-web-portfolio.js` — Export logic
  - `CKC_main/app/templates/web-portfolio/` — HTML/CSS/JS templates
    - `index.html` — Homepage template
    - `character.html` — Character detail template
    - `style.css` — Shared styles
    - `app.js` — Minimal client-side JS (navigation, image viewer)
  - `CKC_main/src/ui/components/ExportHub.tsx` — Add "Web Portfolio" export type
- Export process:
  1. Create export folder
  2. Copy/optimize images (resize to max 2048px, compress)
  3. Render character pages from template
  4. Render homepage with character grid
  5. Write README.txt
  6. Open export folder in file explorer
- Template engine: simple string replacement (no need for Handlebars/EJS)
  ```javascript
  const characterHtml = characterTemplate
    .replace('{{CHARACTER_NAME}}', character.name)
    .replace('{{CHARACTER_ID}}', character.public_id)
    .replace('{{FIELDS}}', renderFields(character.fields));
  ```
- Image optimization:
  - Use `sharp` (already in dependencies for AI tagging) to resize/compress
  - Target: max 2048px longest edge, 80% JPEG quality
  - Preserve EXIF if user opts in
- Navigation:
  - Use anchor links (`index.html#CHAR-000001`) for SPA feel
  - JavaScript intercepts clicks and loads content dynamically
  - Fallback: each character gets its own `.html` file for no-JS browsers

## Notes
- Starter templates to include:
  1. "Portfolio" — image-focused (large gallery, minimal text)
  2. "Codex" — text-focused (full sheet, thumbnails)
- Consider allowing custom CSS override (user can drop `custom.css` into export)
- Export format is forward-compatible (old exports should work even after CKC updates)
- Do NOT touch `D:`.

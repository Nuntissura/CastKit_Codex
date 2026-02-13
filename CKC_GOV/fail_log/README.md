# Fail / Incident Log - How to use

This folder is a lightweight "lessons learned" system.

Goal: when something goes wrong, we capture it once (with root cause + prevention) so we do not repeat it in CKC or in other projects (e.g. Handshake).

## Files
- `FAIL_LOG.md`
  - Legacy, narrative log.
  - Keep it append-only.
- `INDEX.md`
  - Browse incidents quickly (newest first).
- `incidents/`
  - One incident per file.
- `INCIDENT_TEMPLATE.md`
  - Copy/paste template for a new incident.
- Optional helper:
  - `CKC_GOV/scripts/new_incident.ps1` - scaffolds a new incident file and adds it to `INDEX.md`.

## When to log
Log anything that risks repeating:
- Destructive commands (delete/move/overwrite) gone wrong or almost gone wrong
- Data loss risks, recovery steps
- Build/release mistakes (wrong build, wrong paths, missing assets)
- UX/layout failures that keep reappearing
- Tooling failures (timeouts, wrong base URL, confusing errors) once you understand the root cause

## What to write (minimum useful)
- What happened (include the exact command/setting if applicable)
- Impact
- Root cause
- Fix / recovery
- Prevention / guardrails (the one or two rules that stop it happening again)

## Reuse in other projects
Copy the whole `fail_log/` folder and (optionally) `scripts/new_incident.ps1` into the other repo's governance folder.


# WP-0034 — Security: remediate `npm audit` HIGH (release builds)

Date: 2026-02-12
Owner: Codex
Status: DONE

## Summary
Eliminate HIGH severity `npm audit` findings that appear during packaging/release builds (especially the stage `npm install --omit=dev`) so release builds are not shipping with known HIGH-risk dependency vulnerabilities.

## Motivation / context
- Release packaging currently prints: `5 high severity vulnerabilities`.
- These are from transitive dependencies (not app code) but still represent supply-chain risk and degrade trust in the build pipeline.

## Scope
- Remediate HIGH findings for **production dependency trees**:
  - `npm audit --omit=dev --audit-level=high`
  - Packaging stage (`CKC_GOV/targets/CKC/stage/<buildId>/`) `npm audit --audit-level=high`
- Prefer minimal, deterministic fixes:
  - Use `overrides` to pin vulnerable transitive packages to patched versions when safe.
  - Ensure the packaging stage `package.json` also carries these overrides (since it is generated).
- Validate that:
  - app still runs/tests pass
  - packaging still succeeds

## Non-goals
- Full “upgrade everything” dependency modernization (Electron major updates) unless needed to clear HIGH.
- Fixing Moderate/Low findings unless they are tightly coupled to clearing HIGH.

## Acceptance criteria
- [x] `cd CKC_main; npm audit --omit=dev --audit-level=high` reports **0** HIGH vulnerabilities.
- [x] Packaging stage install no longer reports HIGH vulnerabilities during release build.
- [x] `cd CKC_main; npm test` passes.
- [x] `cd CKC_main; npx tsc --noEmit` passes.

## Test plan
- [x] Automated: `npm install` (updates lockfile as needed).
- [x] Automated: `npm audit --omit=dev --audit-level=high`.
- [x] Automated: `npm test`.
- [x] Automated: `npx tsc --noEmit`.
- [ ] Manual: run `npm run package:win` for a tagged release build.

## Governance checklist (MUST)
- [x] Task Board updated with this WP.
- [x] Spec impact: no (security/dependency remediation only; no UX/behavior change).

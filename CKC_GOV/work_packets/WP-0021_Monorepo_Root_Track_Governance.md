# Work Packet: WP-0021 — Monorepo root (track governance with product)

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Move the GitHub repo root to `<CKC_ROOT>` so `CKC_GOV/` (governance) is committed and pushed alongside `CKC_main/` (code), while keeping `CKC_GOV/targets/` (artifacts/caches/logs) ignored.

## Why
Governance must be versioned together with the product so new developers always get the correct workflow, spec, task board, and work packets when cloning the repo.

## Scope
### In
- Git repo root is `<CKC_ROOT>`.
- Track `CKC_GOV/` in git (excluding `CKC_GOV/targets/` + `CKC_GOV/user_ilja/`).
- Keep app code under `CKC_main/`.
- Ensure GitHub Actions workflow still works (run npm/package from `CKC_main/`).
- Add/update onboarding docs to match the new layout.

### Out
- Committing any build artifacts (`.exe`, `CKC_GOV/targets/**`).
- Rewriting git history (no force-push, no filter-repo).

## Acceptance criteria
- [ ] `CKC_GOV/` is present on GitHub after push (spec, taskboard, work packets, templates, scripts).
- [ ] `CKC_GOV/targets/` is ignored and does not appear in `git status`.
- [ ] `.github/workflows/release-win.yml` runs `npm ci` + `npm run package:win` from `CKC_main/`.
- [ ] Root `README.md` explains repo layout and points to canonical governance docs.

## Test plan
- [ ] `git status` clean after commit.
- [ ] `cd CKC_main; npm test` (sanity).

## Implementation notes
- Key files:
  - `.gitignore` (root ignores `CKC_GOV/targets/`, `CKC_recovery/`, `CKC_GOV/user_ilja/`)
  - `.github/workflows/release-win.yml` (set `working-directory: CKC_main`)
  - `README.md` (root onboarding)
  - `CKC_GOV/PROJECT_CODEX.md` + `CKC_main/docs/PROJECT_CODEX.md` (updated references)

## Risks / mitigations
- Risk: large tree move can confuse paths for existing checkouts.
  - Mitigation: keep `CKC_main/` and `CKC_GOV/` stable going forward; document layout at repo root.

## Rollback
Revert the WP-0021 commit on `main` and restore the previous single-folder repo layout (code-only repo).

## Notes
- Do NOT commit build artifacts; publish official builds as GitHub Release assets.
- Keep `CKC_GOV/targets/` ignored.


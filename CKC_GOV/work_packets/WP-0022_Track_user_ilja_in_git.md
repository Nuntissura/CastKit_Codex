# Work Packet: WP-0022 — Track `CKC_GOV/user_ilja` in git

Date: 2026-02-11
Owner: Codex
Status: DONE

## Summary
Stop ignoring `CKC_GOV/user_ilja/` so it is committed and pushed with the repo.

## Why
You asked for `user_ilja` to be versioned so any developer can pull it from GitHub along with governance and code.

## Scope
### In
- Remove `CKC_GOV/user_ilja/` from root `.gitignore`.
- Commit the `CKC_GOV/user_ilja/` folder contents.

### Out
- Committing artifacts/caches/logs under `CKC_GOV/targets/`.

## Acceptance criteria
- [ ] `CKC_GOV/user_ilja/` appears in the GitHub repo after push.
- [ ] `CKC_GOV/targets/` remains ignored.

## Test plan
- [ ] `git status` clean after commit.

## Notes
- Be careful not to store secrets (API keys, tokens) in `CKC_GOV/user_ilja/`.


# WP-0097 - Image Sourcing Init Portability

Status: DONE
Owner: Codex
Date: 2026-05-05

## Scope
- Harden `CKC_GOV/references/external_app_data/init_task.py` so a moved initializer does not bind to an older same-named spec in a stale shell working directory.
- Keep the image sourcing init spec repo-neutral and self-explanatory for future LLM/operator runs.
- Create the request template in the CastKit `external_app_data` folder.

## Out of Scope
- Changing CKC product behavior.
- Running a full second-phase image sourcing task init with filled task criteria.
- Renaming the operator's current checkout path.

## Implementation Notes
- Relative `--spec` now resolves next to the running `init_task.py` first, then falls back to the process working directory.
- Relative `--request` paths now resolve next to the selected spec.
- The request-template console output includes `SELECTED SPEC` and `TARGET FILE TO EDIT`.
- The neutral init spec documents the same path-resolution rule.

## Acceptance Criteria
- Running the CastKit initializer by absolute script path from the old Image_sourcing working directory selects the CastKit spec.
- The generated `task_request.json` lands under `CKC_GOV/references/external_app_data/`.
- No old absolute Image_sourcing path is required for the moved initializer.

## Verification
- `python -m py_compile CKC_GOV/references/external_app_data/init_task.py`
- Dry run from `D:\Projects\Image_sourcing\lora_avatar_test_0006` selected:
  `D:\Projects\LLM projects\CastKit-Codex\CKC_GOV\references\external_app_data\image_sourcing_init_spec-idol_v00.19.json`
- Actual first-phase run created:
  `D:\Projects\LLM projects\CastKit-Codex\CKC_GOV\references\external_app_data\task_request.json`

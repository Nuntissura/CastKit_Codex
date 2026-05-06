# Work Packet: WP-0103 - Sheet Validator + clickElement React-19 Reliability + SQL Alias Regression Guard

Date: 2026-05-06
Owner: Codex
Status: DRAFT

## Summary
Fix three classes of pre-existing bugs surfaced by the WP-0099/WP-0100 post-merge sheet test campaign and pin them with regression tests. Together they unblock reliable agent-driven testing of every CKC sheet field type, fix noisy validator warnings, and prevent the camelCase-SQL-alias bug class from recurring.

## Why
The sheet test campaign (recorded in `CKC_GOV/test_suites/CKC_TEST_SUITE.md`) found:

- **F1.3 enum-with-`other:<descriptor>`** — `inferFieldType` substring-matches `<descriptor>` and misclassifies fields like `Build: <slim | curvy | other:<descriptor> | unknown>` as `descriptor`. Single-word valid enum values like `curvy`/`graceful` then fail the 2-12 word validator with severity `error`.
- **F1.5 score_10 range check missing** — fields like `<score_10 | optional>` get classified as `enum` (because the parser falls through the `<score_10>` exact-substring check) and never hit the validator's range path. Out-of-range values (`11/10`) save with only a noisy "Non-canonical enum value" warning.
- **`<string | unset>` style fields** — fields like `Real_Name: <string | unset>` are also classified as `enum` with `enumValues: ['string', 'unset']`. Every typed string triggers a "Non-canonical enum value (allowed)" warning. Pure documentation noise on every save.
- **F2.2 clickElement React-19 reliability** — neither `el.click()` nor the WP-0099 wired `clickElement` (single `MouseEvent('click', { bubbles, cancelable })`) reliably triggers React 19's `onClick` for the Save button. Backend `saveCharacter` works fine, but agent-driven UI verification of save flows is blocked.
- **camelCase SQL alias bug class (already fixed in commit `89c0aa7` for the two known instances)** — Postgres lowercases unquoted aliases. SQLite preserves alias case. Queries like `SELECT value_text AS valueText` returned `r.valuetext` on Postgres; JS reads of `r.valueText` were always `undefined`. A regression guard prevents recurrence.

## Scope
### In

#### 1. Template parser type classification (`CKC_main/app/backend/templateParser.js`)
- Replace substring-based `inferFieldType` matching with union-aware parsing.
- Recognize first-token type keywords inside unions: `<string | unset>` → `type: 'string'`, `<integer | adult>` → `type: 'integer'`, `<paragraph | optional>` → `type: 'paragraph'`, `<score_10 | optional>` → `type: 'score_10'`, `<descriptor | optional>` → `type: 'descriptor'`, `<list | optional>` → `type: 'list'`. Non-type tokens in the union become `allowedSpecialValues: [...]` (e.g. `unset`, `adult`).
- Detect `other:<descriptor>` (or `other:<string>`) inside enum unions; set `allowDescriptorFallback: true` (or `allowOtherType: 'descriptor'|'string'`). The `enumValues` array contains only literal enum tokens — `other:<...>` and `unknown` are extracted as flags.
- Fix order so embedded `<descriptor>` substring (inside `<other:<descriptor>>`) does NOT match the descriptor-only branch.

#### 2. Validator (`CKC_main/app/backend/validation.js`)
- `string` fields: no enum-style warning regardless of `allowedSpecialValues`. Any non-empty string is valid.
- `score_10` fields: enforce 0..10 range with severity `error` (existing `normalizeScore10` already does this; ensure it's reached).
- `enum` fields: when `allowDescriptorFallback` or `allowOtherType` is set, accept values that match the fallback type (e.g. 2-12 word descriptors, or any string for `other:<string>`) without the noisy warning. Truly invalid values still warn.
- `descriptor` fields: skip the 2-12 word check when the value matches an `allowedSpecialValues` token (e.g. `unknown`).
- `list` fields: keep current JSON-parse path but tolerate operator-typed comma-separated text (parse leniently when JSON parse fails — split on `,` or newline). Out of immediate scope if it expands the WP; re-evaluate after the rest is in.

#### 3. clickElement React-19 reliability (`CKC_main/src/ui/App.tsx`)
- Update the `clickElement` automation arm to dispatch a richer event sequence: `pointerdown` → `mousedown` → `focus` → `mouseup` → `pointerup` → `click`, with `bubbles: true, cancelable: true, view: window` on each. React 19 listens at the root for delegated events; the additional pointer/mouse events match what React's internal SyntheticEvent system expects on a real user click.
- Verify against the Save button via CDP: type into a sheet input → call `clickElement({ selector: '._headerRight_quddb_66 button:nth-child(1)' })` → confirm button transitions Save → Saving… → Saved AND `automationGetState`/`getCharacter` reflect the new value.
- Document the canonical click flow in the in-app manual and test suite.

#### 4. SQL alias regression guard (`CKC_main/test/sql_alias_regression.test.js`)
- Static grep over `CKC_main/app/backend/*.js` for the pattern `AS\s+[a-z]+[A-Z][a-zA-Z]*` (camelCase alias). The audit during this WP confirmed only two instances existed; both fixed in commit `89c0aa7`. The test fails CI when a future change reintroduces the pattern.
- Same test also flags `AS\s+[A-Z]` (any uppercase-first alias) — these would also break on Postgres unless double-quoted.

#### 5. Tests
- `test/template_parser_unions.test.js` — assertions for `<string | unset>`, `<integer | adult>`, `<paragraph | optional>`, `<score_10 | optional>`, `<descriptor | optional>`, `<list | optional>`, `<list of XYZ_Block | optional>`, `<a | b | other:<descriptor> | unknown>`, `<a | b | c>`, `<rule>`. Each asserts both `type` and the relevant flags / `enumValues`.
- `test/validation_field_types.test.js` — exercises the validator per type. String accepts anything; score_10 rejects out-of-range with `error`; enum-with-fallback accepts both literal values and descriptor-format fallbacks; descriptor enforces 2-12 words.
- `test/automation_click_element.test.js` — unit-level (no Electron) test that the new event sequence is generated correctly. Smoke against the running app is documented in the test suite as a manual run.

#### 6. Documentation (binding rules per codex)
- Update `CKC_main/app/backend/automationManual.js` with a note in the operating contract / safety section about the click-event sequence used by `clickElement`. Bump `MANUAL_VERSION`.
- Update `CKC_GOV/test_suites/CKC_TEST_SUITE.md`: mark F1.3, F1.5, F2.2 as resolved (pinned by the new regression tests). Add a new section noting the SQL alias regression guard. Re-run the F-block end-to-end at the end of the WP and append findings.
- Spec bump `v00.066 -> v00.067`.

#### 7. Ship
- `npm run package:win` produces v0.2.10 installer + portable. Tag pushed → `release-win.yml` attaches assets.

### Out
- **F1.7 block-list inline editor** — the schema-descriptor empty divs and lack of an inline block-list UI are a substantial UI WP. Track as the next sheet-UI WP. Out here.
- **Renderer-side validation indicators** (red/green field borders, inline error messages next to inputs).
- **Tag-rules engine review** (separate concern).
- **Auto-save** — current Save-button-driven flow stays.

## Acceptance criteria
- [ ] `inferFieldType` returns `{ type: 'string' }` for `<string | unset>`, `{ type: 'integer' }` for `<integer | adult>`, `{ type: 'score_10' }` for `<score_10 | optional>`, `{ type: 'descriptor' }` for `<descriptor | optional>`, `{ type: 'paragraph' }` for `<paragraph | optional>`.
- [ ] `inferFieldType` returns `{ type: 'enum', enumValues: ['slim','athletic','curvy','muscular','stocky','mixed'], allowDescriptorFallback: true, allowsUnknown: true }` (or equivalent) for `<slim | athletic | curvy | muscular | stocky | mixed | other:<descriptor> | unknown>`.
- [ ] Saving `Build = "curvy"` produces no errors and no warnings (was: `error: Descriptor must be 2-12 words`).
- [ ] Saving `Real_Name = "Aeri"` produces no warnings (was: `warn: Non-canonical enum value (allowed)`).
- [ ] Saving `Audience_Loyalty = "11/10"` produces severity `error` `Expected score_10 as 0..10 or x/10` and (in strict mode) does not persist.
- [ ] `clickElement({ selector: '<sheet-save-btn-selector>' })` transitions the Save button through Save → Saving… → Saved and the typed input value lands in the DB. Verified via CDP smoke.
- [ ] `test/template_parser_unions.test.js`, `test/validation_field_types.test.js`, `test/sql_alias_regression.test.js`, `test/automation_click_element.test.js` all pass.
- [ ] `automation_manual_consistency.test.js` continues to pass; manual MANUAL_VERSION bumped.
- [ ] Spec bumped to v00.067; v00.066 archived.
- [ ] `npm run package:win` produces a v0.2.10 release; identity-decoupling and stealth invariants still pass against the packaged build.
- [ ] Test suite findings updated: F1.3, F1.5, F2.2 marked resolved with WP-0103 + commit references.

## Test plan
- Unit: parser unions (per type) + parser embedded-descriptor false-positive test.
- Unit: validator per type happy path + boundary path (score_10 out of range, descriptor word count edge cases, enum non-canonical value with and without fallback).
- Unit: SQL alias regression (static grep).
- Unit: clickElement event sequence (assert each dispatched type and order on a stubbed element).
- Smoke (manual, dev mode): drive the Save button via CDP after the clickElement fix; capture before/after screenshots; verify Save button transitions and DB persistence.
- Smoke (manual, packaged): same flow on the v0.2.10 packaged build.

## Governance checklist
- [ ] Task Board updated with WP-0103 row at `IN_PROGRESS`, then `DONE` after validation.
- [ ] Spec bumped (`v00.066` → `v00.067`); old version archived.
- [ ] No generated file or folder names with spaces.
- [ ] Planning-checkpoint commit (WP file + Task Board row) pushed BEFORE any code changes.
- [ ] Shipping-checkpoint commit (code + Task Board + spec) pushed after implementation.
- [ ] Manual updated in the same commit as the click-event-sequence change (per codex hard-requirement rule).
- [ ] Test suite updated with resolved-bug entries + new sections.
- [ ] NAS mirror backup script run after the shipping commit.

## Implementation notes
- Files expected to change / be added:
  - `CKC_main/app/backend/templateParser.js` — new `inferFieldType` with union-aware parsing.
  - `CKC_main/app/backend/validation.js` — string/score_10/enum-with-fallback/descriptor handling.
  - `CKC_main/src/ui/App.tsx` — richer event sequence in `clickElement` arm.
  - `CKC_main/app/backend/automationManual.js` — note the click-event sequence; MANUAL_VERSION bump.
  - `CKC_main/test/template_parser_unions.test.js` (new).
  - `CKC_main/test/validation_field_types.test.js` (new).
  - `CKC_main/test/sql_alias_regression.test.js` (new).
  - `CKC_main/test/automation_click_element.test.js` (new).
  - `CKC_GOV/spec/CastKit_Codex_Spec_v00.067.md` (new); v00.066 archived.
  - `CKC_GOV/test_suites/CKC_TEST_SUITE.md` — findings update.
- The parser refactor is local to `inferFieldType`. Other parser exports (`parseTemplate`, etc.) keep their public shape; only the per-field `type` and the new optional flags (`allowedSpecialValues`, `allowDescriptorFallback`, `allowOtherType`, `allowsUnknown`) change.
- The validator changes are additive — existing callers see the same `issues` array shape, just with different/fewer entries for previously-noisy fields.
- The clickElement event-sequence change is renderer-side only; the WP-0099 stealth invariants (no OS input, no focus steal) are preserved because we still dispatch only against the target element.
- SQL alias regression guard runs as a normal `node --test` file; no special harness.

## Risks / mitigations
- **Risk:** parser refactor breaks fields that worked-by-accident (e.g. operator-supplied template variants outside the v2.00 default). **Mitigation:** the regression suite parses all 745 fields of `CHARACTER_SHEET__v2.00.txt` and snapshots the type distribution; manual diff before/after.
- **Risk:** new validator behavior masks a genuine wrong value. **Mitigation:** stricter score_10 range now produces `error`, balancing the looser string/enum behavior. Also keep the `Non-canonical enum value` warning available for true enums (just not strings).
- **Risk:** clickElement richer event sequence accidentally raises focus/visibility (against stealth contract). **Mitigation:** pointerdown/mousedown/click on the target element only — none of these affect window-level focus or visibility. Pinned by the existing stealth invariants test.
- **Risk:** SQL alias regression guard fails on legitimate cases (e.g. SQLite-only FTS queries). **Mitigation:** scan only `app/backend/*.js`; FTS queries already use snake_case aliases; no false positives expected.
- **Risk:** packaged build smoke fails due to PC load / Electron build flakiness. **Mitigation:** retry once with NSIS cache renamed back if needed (same as v0.2.8 fix); already known-good path.

## Rollback
- Revert the WP commit. Validator becomes noisy again; `clickElement` reverts to the simpler MouseEvent dispatch; SQL alias guard test goes away; spec/manual revert. No schema changes, no DB migrations to undo.

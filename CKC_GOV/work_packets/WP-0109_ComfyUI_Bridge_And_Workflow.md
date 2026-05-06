# Work Packet: WP-0109 - ComfyUI bridge + workflow storage + replay

Date: 2026-05-06
Owner: Codex
Status: DRAFT (depends on WP-0107 + WP-0108)

## Summary
Final slice of the OpenRepose absorption. Moves the ComfyUI custom node into CKC, lands the backend intake endpoint that registers ComfyUI outputs, makes the `Workflow` tab functional, and wires up the "Replay in ComfyUI" button left disabled by WP-0108. Workflow JSON becomes a first-class CKC artifact: queryable, attachable to characters, replayable against any portrait or rig.

## Why
CKC's primary purpose is "image database coupled with character sheets." ComfyUI is how those images get generated. Without a built-in ComfyUI bridge, the operator has to manually shuttle openpose PNGs out of CKC and generated images back in, losing the prompt + workflow + seed lineage every time. OpenRepose had this loop closed (POST from a custom node to localhost); CKC needs the same loop, owned and maintained inside CKC's repo.

Storing the workflow JSON alongside the image is the force multiplier: every generated image becomes replayable, tweakable, and lineage-traceable. It's the equivalent of source-controlling the recipe along with the cake.

## Scope

### In

#### 1. ComfyUI custom node
- New folder: `CKC_main/comfyui_node/` (yes, inside CKC's source tree — operator installs it into ComfyUI by symlinking or copying into ComfyUI's `custom_nodes/` per the README).
- File: `CKC_main/comfyui_node/castkit_codex_bridge.py` — adapted from OpenRepose's `openrepose_bridge.py` but rewritten under CKC's contract (don't import OpenRepose; recreate). Stdlib only — no `pip install` required in ComfyUI's env.
- Behavior:
  - Registered as ComfyUI node "CastKit-Codex Bridge (Save + Register)" with one input (image), several optional inputs (prompts, seeds, model name, sampler, cfg, steps, openpose_ref).
  - On execution: saves the image to ComfyUI's `output/` folder (always — never blocks ComfyUI's pipeline on CKC errors); then POSTs a JSON bundle to `http://127.0.0.1:<CKC_PORT>/intake/comfyui_output` with `{ image_base64, character_id, rig_id?, openpose_ref?, workflow_json, metadata }`.
  - Routes by env var:
    - `CKC_INTAKE_TOKEN` set → bundle includes that token; CKC uses it to scope to a session.
    - `CKC_INTAKE_CHARACTER` set → bundle's `character_id` defaults to that.
    - Neither set → POST is skipped (image still saved by ComfyUI normally); a one-line log explains.
  - Connection failure (CKC not running, port wrong, etc.) is non-fatal — logged, image already saved.
- README at `CKC_main/comfyui_node/README.md` explains: install path, env-var setup, troubleshooting.

#### 2. CKC HTTP intake endpoint
- New endpoint in `app/main.js`: `http://127.0.0.1:<port>/intake/comfyui_output` (port reserved at startup; surfaced in `automationGetState` so the operator + the ComfyUI node know it).
- Accepts the bundle, validates the token if set, decodes the image, computes SHA-256, writes to `characters/<character_id>/images/original/<hashPrefix>.<ext>` (content-hash addressed), generates a 320 px thumbnail, INSERTs `ImageAsset` with `comfyui_workflow_json` + `comfyui_metadata_json` populated and (if present) `rig_id` linking back to the openpose source.
- Idempotent: same hash twice → second call updates metadata only (per the WP-0106 idempotency rule).
- Single-instance lock: only the foreground CKC instance accepts POSTs.

#### 3. Backend command implementations
The stub `registerComfyUIOutput` from WP-0107 is replaced with the real impl described above. Plus:
- `replayWorkflow({ workflowJson, overrides })` — POSTs the workflow JSON to ComfyUI's `/prompt` endpoint with optional override patches (e.g. swap the openpose input image, swap the seed, swap the prompt). Returns the ComfyUI prompt id; CKC polls `/history` to track completion.
- `getWorkflowHistory({ characterId? })` — query existing `comfyui_workflow_json` rows in `ImageAsset`, joined with `Rig` and `Character`. Returns rows for the Workflow tab.
- `extractPromptFromWorkflow({ workflowJson })` — walks the workflow JSON and pulls the positive / negative / lora references for one-click "save as Prompt" into the WP-0107 `Prompt` table.

#### 4. Workflow tab implementation
Replaces the WP-0107 placeholder with:
- **Recent runs** panel — list of every `ImageAsset` row that has `comfyui_workflow_json IS NOT NULL`, newest first, grouped by character. Click a row → preview image + workflow node graph (read-only) + metadata + prompts.
- **Replay** panel — pick a workflow + a target character + an optional rig (overrides the openpose input). Click "Replay" → POSTs to ComfyUI; surfaces progress; new image lands automatically via the intake endpoint.
- **Workflow library** panel — saved workflows the operator has flagged as reusable templates. Workflows can be tagged, searched, and named.

#### 5. Wire the "Replay in ComfyUI" button on the Pose tab
- Click → finds the most recent workflow tagged with the active character → POSTs to ComfyUI with the current rig's openpose PNG as the override input → the resulting image lands in `images/original/` linked to the character.
- If no workflow is on file: prompt the operator to upload one via the Workflow tab first.

#### 6. ComfyUI connection settings
- New section in CKC settings: ComfyUI host (default `http://127.0.0.1:8188`), token if applicable, model + sampler defaults for replays.
- A "Test connection" button that pings ComfyUI's `/system_stats` endpoint and shows a green/red indicator.

#### 7. Tests
- `test/comfyui_intake_endpoint.test.js` — POST a fake bundle to the endpoint, assert the file lands at the right path, the `ImageAsset` row has the right shape, and re-POSTing the same bundle is idempotent.
- `test/comfyui_workflow_extraction.test.js` — feed a small fixture workflow JSON, assert `extractPromptFromWorkflow` returns the expected positive / negative / lora rows.
- `test/comfyui_replay_skeleton.test.js` — mock ComfyUI's `/prompt` endpoint; assert `replayWorkflow` posts the right body and polls correctly.
- `test/backend_workflow_history.test.js` — seed three `ImageAsset` rows with workflow JSON; assert `getWorkflowHistory` returns the expected join shape.
- `test/comfyui_node_contract.test.js` — Python-stdlib syntax-only check on the custom node file (it imports cleanly, the API hooks `INPUT_TYPES` / `RETURN_TYPES` / `FUNCTION` are present, no non-stdlib imports). Runs via `python3` if available; skipped if not.

#### 8. Spec bump (next available). Manual MANUAL_VERSION bumped. Test suite Section M completed.

#### 9. Ship as packaged build. v0.2.13. Smoke against the packaged build verifies intake, workflow tab, replay, and the ComfyUI custom node end-to-end with a real ComfyUI instance.

### Out
- Bundling ComfyUI itself. Operator runs ComfyUI separately; CKC connects to it.
- Auto-installing the custom node into ComfyUI's folder. Manual install via the README.
- LoRA training pipeline (extract pairs from the workflow library + tagged images). Slot for a follow-up that aligns with Handshake's pillar 20.
- Multi-ComfyUI-instance routing (e.g. one ComfyUI on GPU 0, one on GPU 1). Out of scope.
- Workflow visual editor (graph node manipulation inside CKC). Out of scope; CKC reads + replays workflows, doesn't author them.
- Image-to-image / inpainting workflows beyond the standard openpose-controlnet flow. Generic over any workflow JSON; CKC doesn't impose a flow shape.

## Acceptance criteria
- [ ] ComfyUI custom node `castkit_codex_bridge.py` installs cleanly into a vanilla ComfyUI install (symlink or copy); ComfyUI starts; the node appears in the node menu under "CastKit-Codex".
- [ ] Generating an image with the bridge node connected pushes a bundle to CKC's intake endpoint within 500 ms of completion; the image appears in the Library + Workflow tabs without operator action.
- [ ] CKC restarts mid-generation → ComfyUI keeps running → next bundle arrives once CKC is back up; old bundles are not lost (ComfyUI saves to disk regardless).
- [ ] `replayWorkflow` against a stored workflow produces a new image linked to the character + rig with byte-identical metadata round-trip.
- [ ] "Replay in ComfyUI" button on the Pose tab works end-to-end with the most-recent workflow.
- [ ] Idempotent intake: re-POSTing the same bundle does not duplicate the `ImageAsset` row.
- [ ] All new commands listed in the manual; self-consistency test passes.
- [ ] All new tests pass; existing tests still pass.
- [ ] Spec bumped, manual bumped, test suite Section M completed (every check row has either ✅ or a documented OPEN BUG).
- [ ] `npm run package:win` produces v0.2.13; smoke against packaged build with a real ComfyUI instance.

## Test plan
- **Unit (intake)**: synthetic POST to the intake endpoint; verify file + DB.
- **Unit (extraction)**: workflow JSON → prompts.
- **Unit (replay)**: mocked ComfyUI; verify request shape.
- **Smoke (manual, dev, real ComfyUI)**: install the custom node, generate an image with a known workflow, verify it appears in the Workflow tab, click Replay, verify a new image lands.
- **Smoke (manual, packaged)**: same against v0.2.13 NSIS install.

## Governance checklist
- [ ] Task Board: WP-0109 row → IN_PROGRESS / DONE.
- [ ] Spec bump + archive.
- [ ] Codex bullet referencing the OpenRepose absorption rule.
- [ ] Planning-checkpoint commit pushed before code changes.
- [ ] Shipping-checkpoint commit after impl.
- [ ] In-app manual updated in same commit (hard requirement).
- [ ] Test suite Section M completed.
- [ ] Live verification via CDP + a real ComfyUI instance — captures of: workflow tab populated, replay running, intake landing.
- [ ] NAS mirror backup script run after shipping commit.

## Implementation notes
- ComfyUI's HTTP API is documented; we don't need to reverse-engineer it. POST to `/prompt`, poll `/history/<prompt_id>` until status complete.
- The custom node lives in `CKC_main/comfyui_node/`, NOT `CKC_GOV/`, because it's product code that ships with the app — even though the operator has to install it manually into ComfyUI. The README documents the install procedure.
- Identity decoupling: workflow JSON can include character names typed by the operator into prompts; that's operator-controlled text per the codex's existing identity rule. Image filenames remain content-hash addressed.
- The intake endpoint writes the same content-hash filename pattern as `importImages` so the file layout stays uniform.
- Workflow JSON is stored verbatim in `comfyui_workflow_json JSONB`. No CKC-side schema imposed on its shape; CKC reads enough to extract prompts but never rewrites it.
- Rate-limiting: the intake endpoint accepts up to N concurrent uploads (default 4); excess queues. Operator-tunable.

## Risks / mitigations
- **Risk**: ComfyUI's API shape changes between releases. **Mitigation**: pin a known-working version range in the manual; the bridge node version is included in the workflow metadata so old runs remain identifiable.
- **Risk**: huge workflows (many nodes, large model refs) bloat the JSONB column. **Mitigation**: PG handles JSONB up to 1 GB per row; in practice workflows are <100 KB. Add a soft 1 MB warning at insert time.
- **Risk**: malicious / corrupt workflow JSON causes replay to crash ComfyUI. **Mitigation**: CKC doesn't execute workflows; ComfyUI does. CKC is just transport. Operator owns the trust decision.
- **Risk**: localhost intake endpoint is reachable by other apps on the same machine. **Mitigation**: token-based auth via `CKC_INTAKE_TOKEN`; default deny on token mismatch; bind to `127.0.0.1` only.
- **Risk**: a long-running ComfyUI generation orphans its replay tracking when CKC restarts. **Mitigation**: the next CKC startup polls `/history` for any in-flight prompts it knows about and reconciles.

## Rollback
- Revert the WP commit. Workflow tab returns to the WP-0107 placeholder. The "Replay in ComfyUI" button on the Pose tab goes disabled. Existing `comfyui_workflow_json` rows in `ImageAsset` stay valid (column is opaque).

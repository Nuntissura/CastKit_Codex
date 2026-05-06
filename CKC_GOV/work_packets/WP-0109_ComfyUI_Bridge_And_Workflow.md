# Work Packet: WP-0109 - ComfyUI bridge + workflow storage + replay

Date: 2026-05-07
Owner: Codex
Status: DRAFT (depends on WP-0107 + WP-0108)

## Summary
Final OpenRepose absorption slice. Adds CKC's first localhost HTTP intake endpoint, a ComfyUI custom node that POSTs generated images + workflow JSON to it, the Workflow tab implementation (Recent runs / Replay / Workflow library), and wires the previously-disabled "Replay in ComfyUI" button on the Pose tab.

ComfyUI workflow JSON becomes a first-class CKC artifact: every generated image carries the recipe that produced it. Workflows are queryable, attachable to characters, replayable against any portrait or rig.

---

## Why
CKC's primary purpose is "image database coupled with character sheets." ComfyUI is how those images get generated. Without a built-in bridge, the operator has to manually shuttle openpose PNGs out of CKC and generated images back in, losing the prompt + workflow + seed lineage every time. Storing the workflow JSON alongside the image is the force multiplier — every generated image becomes replayable, tweakable, and lineage-traceable. Source-control the recipe alongside the cake.

After this WP ships, the OpenRepose repo is officially obsolete.

---

## Pre-flight read list (mandatory)

| File | Lines | Why |
|---|---|---|
| `CKC_main/app/main.js` | 1–120 (imports + protocol setup) | Existing app shell. New HTTP server lifecycle hooks here. |
| `CKC_main/app/main.js` | 525–615 (`captureAutomationPng`, `runBackendAutomationCommand`) | Existing patterns: secure file write, command dispatch. |
| `CKC_main/app/main.js` | 2503–2570 (`app.on` lifecycle) | `second-instance`, `whenReady`, `will-quit`, `window-all-closed`. The HTTP server hooks into these. |
| `CKC_main/app/backend/library.js` | 5604–5710 (`importImages`) | Content-hash addressing pattern. The intake endpoint reuses this exact dedup logic. |
| `CKC_main/app/backend/automationStealth.js` | full | Single-instance lock + background-mode stealth invariants. The HTTP server must not violate them. |
| `CKC_main/app/backend/automationManual.js` | search "operatingContract" | The hard requirement: every new IPC / surface lands in the manual same-commit. |
| `CKC_GOV/work_packets/WP-0099_LLM_Automation_Surface_Expansion_And_Operator_Manual.md` | full | The single-instance lock + background-mode contract this WP must respect. |
| `CKC_GOV/work_packets/WP-0107_Pose_Workflow_Schema_And_Shell.md` | full | Schema and tab-shell foundation. |
| `CKC_GOV/work_packets/WP-0108_Pose_Pipeline_React.md` | full | The "Replay in ComfyUI" disabled button this WP wires up. |

External docs:
- ComfyUI HTTP API (community-maintained): https://github.com/comfyanonymous/ComfyUI/blob/master/server.py — search for `routes.post('/prompt'` and `routes.get('/history'`.
- ComfyUI custom node format: https://docs.comfy.org/custom-nodes/backend/server_overview

---

## ComfyUI HTTP API reference (from ComfyUI's `server.py`)

CKC will speak to ComfyUI as a client. The endpoints we use:

### `POST /prompt`
Submit a workflow for generation.

Request body:
```json
{
  "prompt": { /* the workflow JSON: nodes keyed by id with class_type, inputs, etc. */ },
  "client_id": "ckc-replay-<sessionId>"
}
```

Response (200):
```json
{
  "prompt_id": "abc-123-...",
  "number": 7,
  "node_errors": {}
}
```

### `GET /history/<prompt_id>`
Poll completion status.

Response (200, partial example):
```json
{
  "abc-123-...": {
    "prompt": [...],
    "outputs": {
      "9": { "images": [{ "filename": "ComfyUI_00012_.png", "subfolder": "", "type": "output" }] }
    },
    "status": { "status_str": "success", "completed": true, "messages": [] }
  }
}
```

### `GET /system_stats`
Health check. Returns `{ system: {...}, devices: [...] }`.

### `GET /view?filename=<f>&type=output&subfolder=<s>`
Fetch a generated image by filename. Used as a fallback when the bridge node didn't push the bytes inline (e.g. the bridge isn't installed but the operator wants to replay).

---

## CKC intake endpoint (NEW HTTP surface)

CKC does not have an HTTP server today. This WP introduces one — used ONLY for ComfyUI bridge intake. Wired via Node's built-in `http` module (no Express; keep deps minimal).

### Constraints (must hold)

- Bind to `127.0.0.1` only — never `0.0.0.0`. Other apps on the same machine must auth before being trusted.
- Optional bearer token via `CKC_INTAKE_TOKEN` env var; when set, requests without `Authorization: Bearer <token>` are 401.
- Single-instance lock (WP-0099): only the foreground CKC instance binds the port. A second instance does NOT start a server.
- Background-mode safe: the HTTP server lives in the main process; no UI work; no `app.show()`. Compatible with `CKC_AUTOMATION_BACKGROUND=1`.
- Port: try `52319` (operator-tunable via `CKC_INTAKE_PORT`); if occupied, log + retry 52320..52399; record final port in `automationGetState` so the bridge can discover it.

### Endpoint contract

`POST http://127.0.0.1:<port>/intake/comfyui_output`

Request body (JSON, max 50 MB):
```json
{
  "schema": "ckc.intake.comfyui_output@1",
  "character_id": "char_...",
  "rig_id": "rig_..." | null,
  "openpose_ref": "img_..." | null,
  "image_b64": "<base64-encoded PNG/JPEG bytes>",
  "filename_hint": "ComfyUI_00012_.png",
  "workflow_json": { /* full ComfyUI workflow */ },
  "metadata": {
    "model": "...",
    "sampler": "...",
    "cfg": 7.0,
    "steps": 30,
    "seed": 12345,
    "positive_prompt": "...",
    "negative_prompt": "..."
  },
  "session_id": "ckc-bridge-<uuid>"
}
```

Response 200:
```json
{ "ok": true, "image_id": "img_...", "deduped": false, "relative_path": "images/original/<hash>.png" }
```

Response 200 with dedup:
```json
{ "ok": true, "image_id": "img_existing", "deduped": true, "relative_path": "..." }
```

Response 4xx:
```json
{ "ok": false, "error": "missing character_id" }
```

### Implementation in `CKC_main/app/main.js`

```js
const http = require('http');

let intakeServer = null;
let intakePort = null;
const INTAKE_PORT_RANGE = [52319, 52399];
const INTAKE_MAX_BODY_BYTES = 50 * 1024 * 1024;

function getIntakeToken() {
  return String(process.env.CKC_INTAKE_TOKEN || '').trim() || null;
}

async function startIntakeServer() {
  if (intakeServer) return intakeServer;

  const handler = async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/intake/comfyui_output') {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, error: 'not found' }));
      return;
    }
    const token = getIntakeToken();
    if (token) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${token}`) {
        res.statusCode = 401;
        res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
        return;
      }
    }

    let received = 0;
    const chunks = [];
    req.on('data', (c) => {
      received += c.length;
      if (received > INTAKE_MAX_BODY_BYTES) {
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const lib = await ensureLibrary();
        const result = await lib.registerComfyUIOutput(body);
        res.statusCode = result.ok ? 200 : 400;
        res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
      }
    });
  };

  const start = Number(process.env.CKC_INTAKE_PORT || INTAKE_PORT_RANGE[0]);
  for (let p = start; p <= INTAKE_PORT_RANGE[1]; p++) {
    try {
      await new Promise((resolve, reject) => {
        const srv = http.createServer(handler);
        srv.once('error', reject);
        srv.listen(p, '127.0.0.1', () => {
          intakeServer = srv;
          intakePort = p;
          resolve();
        });
      });
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
    }
  }
  if (!intakeServer) {
    throw new Error(`Could not bind intake server on ${INTAKE_PORT_RANGE[0]}..${INTAKE_PORT_RANGE[1]}`);
  }
  return intakeServer;
}

function stopIntakeServer() {
  if (intakeServer) {
    intakeServer.close();
    intakeServer = null;
    intakePort = null;
  }
}

// In the existing app.whenReady() handler: after createWindow + assertBackgroundSafe init:
await startIntakeServer();

// In the existing app.on('will-quit'): add stopIntakeServer() before super().

// In automationGetState's response: add { intakePort } to the state object.
```

`automationGetState` extension: include `intakePort` and `intakeTokenRequired` (boolean) so the bridge can discover where to POST.

---

## Scope

### In

#### 1. ComfyUI custom node (`CKC_main/comfyui_node/castkit_codex_bridge.py`)

Stdlib only. Recreate from contract; do not import OpenRepose source.

```python
"""CastKit-Codex Bridge — saves output + POSTs to CKC's intake endpoint.

Install: copy or symlink this folder into ComfyUI's `custom_nodes/`.
Required env vars (set in the shell that launches ComfyUI):
  CKC_INTAKE_URL       (e.g. http://127.0.0.1:52319/intake/comfyui_output)
  CKC_INTAKE_CHARACTER (CKC characterId to attach the image to)

Optional:
  CKC_INTAKE_TOKEN  (bearer token if CKC's intake server requires one)
  CKC_INTAKE_RIG    (rigId — links the output back to a Rig row)
  CKC_INTAKE_OPENPOSE_REF (image_id of the openpose source, if any)
  CKC_INTAKE_SESSION (free-form session id; defaults to a hash of pid + ts)

Behavior:
  1. Save image to ComfyUI's output/ folder via standard ComfyUI mechanics.
     Always succeeds — never blocks the pipeline on CKC errors.
  2. POST the bundle to CKC_INTAKE_URL with image_b64 inline.
  3. Connection / auth failures are logged and skipped; image stays on disk.

stdlib-only: no requests, no aiohttp; uses urllib + json + base64.
"""

import base64
import hashlib
import io
import json
import os
import sys
import time
import urllib.request
import urllib.error
from typing import Optional

class CastKitCodexBridge:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
            },
            "optional": {
                "filename_prefix": ("STRING", {"default": "ckc"}),
                "title": ("STRING", {"default": ""}),
                "yaw_bin": ("STRING", {"default": ""}),
                "tags": ("STRING", {"default": ""}),
                "model": ("STRING", {"default": ""}),
                "sampler": ("STRING", {"default": ""}),
                "cfg": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 100.0}),
                "steps": ("INT", {"default": 0, "min": 0, "max": 1000}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "save_and_register"
    CATEGORY = "CastKit-Codex"

    def save_and_register(self, images, filename_prefix="ckc", title="", yaw_bin="",
                           tags="", model="", sampler="", cfg=0.0, steps=0, seed=0,
                           prompt=None, extra_pnginfo=None):
        # Save via ComfyUI's standard machinery. Import here so the file
        # imports cleanly even when not running inside ComfyUI (test contract).
        try:
            from PIL import Image
            import folder_paths
        except ImportError:
            return ()

        out_dir = folder_paths.get_output_directory()
        os.makedirs(out_dir, exist_ok=True)

        intake_url = os.environ.get("CKC_INTAKE_URL", "").strip()
        character_id = os.environ.get("CKC_INTAKE_CHARACTER", "").strip()
        rig_id = os.environ.get("CKC_INTAKE_RIG", "").strip() or None
        openpose_ref = os.environ.get("CKC_INTAKE_OPENPOSE_REF", "").strip() or None
        token = os.environ.get("CKC_INTAKE_TOKEN", "").strip() or None
        session_id = os.environ.get("CKC_INTAKE_SESSION", "").strip() or f"ckc-bridge-{os.getpid()}-{int(time.time())}"

        for batch_idx in range(images.shape[0]):
            arr = (images[batch_idx].cpu().numpy() * 255.0).clip(0, 255).astype("uint8")
            img = Image.fromarray(arr)
            filename = f"{filename_prefix}_{int(time.time())}_{batch_idx:05d}.png"
            path = os.path.join(out_dir, filename)
            img.save(path)

            # POST to CKC. Failures are logged + swallowed — image is on disk regardless.
            if not intake_url or not character_id:
                print(f"[castkit-codex-bridge] CKC_INTAKE_URL or CKC_INTAKE_CHARACTER missing; skipping POST. saved={path}")
                continue

            buf = io.BytesIO()
            img.save(buf, format="PNG")
            png_bytes = buf.getvalue()
            payload = {
                "schema": "ckc.intake.comfyui_output@1",
                "character_id": character_id,
                "rig_id": rig_id,
                "openpose_ref": openpose_ref,
                "image_b64": base64.b64encode(png_bytes).decode("ascii"),
                "filename_hint": filename,
                "workflow_json": prompt if prompt is not None else {},
                "metadata": {
                    "title": title,
                    "yaw_bin": yaw_bin,
                    "tags": tags,
                    "model": model,
                    "sampler": sampler,
                    "cfg": cfg,
                    "steps": steps,
                    "seed": seed,
                    "extra_pnginfo": extra_pnginfo if extra_pnginfo is not None else {},
                },
                "session_id": session_id,
            }
            data = json.dumps(payload).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            req = urllib.request.Request(intake_url, data=data, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    body = resp.read().decode("utf-8")
                    print(f"[castkit-codex-bridge] POST ok: {body}")
            except urllib.error.HTTPError as e:
                print(f"[castkit-codex-bridge] HTTP {e.code} from CKC: {e.read().decode('utf-8', 'replace')}")
            except Exception as e:
                print(f"[castkit-codex-bridge] POST failed (non-fatal): {e}")

        return ()


NODE_CLASS_MAPPINGS = {"CastKitCodexBridge": CastKitCodexBridge}
NODE_DISPLAY_NAME_MAPPINGS = {"CastKitCodexBridge": "CastKit-Codex Bridge (Save + Register)"}
```

`CKC_main/comfyui_node/__init__.py` exports the mappings:
```python
from .castkit_codex_bridge import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
```

`CKC_main/comfyui_node/README.md` — install procedure, env-var setup, troubleshooting.

#### 2. Backend impl: `registerComfyUIOutput` (in `CKC_main/app/backend/library.js`)

```js
async registerComfyUIOutput(params = {}) {
  // Validate envelope
  if (params?.schema !== 'ckc.intake.comfyui_output@1') {
    return { ok: false, error: `unknown schema: ${params?.schema}` };
  }
  const cid = String(params.character_id ?? '').trim();
  if (!cid) return { ok: false, error: 'missing character_id' };
  const charRow = await get(this.db, 'SELECT character_id FROM Character WHERE character_id = ? AND deleted_at IS NULL', [cid]);
  if (!charRow) return { ok: false, error: `character not found: ${cid}` };

  const rigId = params.rig_id ? String(params.rig_id).trim() : null;
  const openposeRef = params.openpose_ref ? String(params.openpose_ref).trim() : null;

  // Decode image
  if (!params.image_b64 || typeof params.image_b64 !== 'string') {
    return { ok: false, error: 'missing image_b64' };
  }
  const bytes = Buffer.from(params.image_b64, 'base64');
  if (bytes.length === 0) return { ok: false, error: 'image_b64 decoded to zero bytes' };

  const fileHash = sha256Hex(bytes);
  const hashPrefix = fileHash.slice(0, 16);

  // Idempotent: if (character_id, file_hash) exists, return existing row.
  const existing = await get(
    this.db,
    'SELECT image_id, relative_path FROM ImageAsset WHERE character_id = ? AND file_hash = ?',
    [cid, fileHash]
  );
  if (existing) {
    // Update workflow / metadata if not already populated.
    await run(
      this.db,
      `UPDATE ImageAsset SET
         comfyui_workflow_json = COALESCE(comfyui_workflow_json, ?),
         comfyui_metadata_json = COALESCE(comfyui_metadata_json, ?),
         rig_id = COALESCE(rig_id, ?)
       WHERE image_id = ?`,
      [
        JSON.stringify(params.workflow_json || {}),
        JSON.stringify(params.metadata || {}),
        rigId,
        existing.image_id,
      ]
    );
    return { ok: true, image_id: existing.image_id, deduped: true, relative_path: existing.relative_path };
  }

  // Determine extension from filename_hint, default to png
  const hint = String(params.filename_hint || '').toLowerCase();
  const ext = hint.endsWith('.jpg') || hint.endsWith('.jpeg') ? '.jpg'
            : hint.endsWith('.webp') ? '.webp'
            : '.png';

  const paths = this.getCharacterPaths(cid);
  ensureDir(paths.imagesOriginalDir);
  ensureDir(paths.imagesThumbDir);

  const fileName = `${hashPrefix}${ext}`;
  const dest = path.join(paths.imagesOriginalDir, fileName);
  fs.writeFileSync(dest, bytes);

  const rel = path.posix.join('images', 'original', fileName);
  const imageId = randomId('img_');

  // Best-effort thumbnail via electronNativeImage (same as importImages)
  let width = null, height = null, thumbRel = null;
  if (this.electronNativeImage) {
    try {
      const img = this.electronNativeImage.createFromBuffer(bytes);
      const size = img.getSize();
      width = size.width; height = size.height;
      const thumb = img.resize({ width: 320 });
      const thumbName = `${hashPrefix}.png`;
      thumbRel = path.posix.join('images', 'thumb', thumbName);
      fs.writeFileSync(path.join(paths.imagesThumbDir, thumbName), thumb.toPNG());
    } catch { /* ignore — width/height/thumb optional */ }
  }

  await run(
    this.db,
    `INSERT INTO ImageAsset(
       image_id, character_id, relative_path, file_hash, width, height,
       favorite, rating, notes, tags_json, storage_mode, source_note,
       comfyui_workflow_json, comfyui_metadata_json, rig_id
     ) VALUES(?, ?, ?, ?, ?, ?, 0, 0, '', '[]', 'copy', 'comfyui generation', ?, ?, ?)`,
    [
      imageId, cid, rel, fileHash, width, height,
      JSON.stringify(params.workflow_json || {}),
      JSON.stringify(params.metadata || {}),
      rigId,
    ]
  );
  await this._audit('comfyui.intake', cid, { imageId, rigId, fileHash, openposeRef });
  return { ok: true, image_id: imageId, deduped: false, relative_path: rel };
}
```

Idempotency contract: same payload twice → same image_id, second call returns `deduped: true`.

#### 3. ComfyUI client (`CKC_main/app/backend/comfyuiClient.js`)

New file, pure stdlib + Node `fetch`. Used by `replayWorkflow` and `getComfyUIStats`.

```js
async function postPrompt({ host, workflowJson, clientId }) {
  const url = new URL('/prompt', host).href;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflowJson, client_id: clientId }),
  });
  if (!r.ok) throw new Error(`ComfyUI /prompt: ${r.status} ${await r.text()}`);
  return r.json(); // { prompt_id, number, node_errors }
}

async function pollHistory({ host, promptId, timeoutMs = 300000, pollMs = 2000 }) {
  const url = new URL(`/history/${promptId}`, host).href;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(url);
    if (r.ok) {
      const data = await r.json();
      const entry = data?.[promptId];
      if (entry?.status?.completed) return entry;
    }
    await new Promise((res) => setTimeout(res, pollMs));
  }
  throw new Error(`ComfyUI /history poll timeout for prompt_id=${promptId}`);
}

async function getSystemStats({ host }) {
  const url = new URL('/system_stats', host).href;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`ComfyUI /system_stats: ${r.status}`);
  return r.json();
}

module.exports = { postPrompt, pollHistory, getSystemStats };
```

#### 4. Backend methods in `library.js`

```js
async replayWorkflow({ workflowJson, characterId, rigId, openposeRef, overrides } = {}) {
  if (!this.appConfig?.comfyui?.host) throw new Error('replayWorkflow: comfyui.host not configured (Settings → ComfyUI)');
  const host = String(this.appConfig.comfyui.host);
  // Apply overrides (operator-defined patches)
  const flow = applyOverrides(workflowJson, overrides);

  // Set env vars in ComfyUI's process? — no, ComfyUI is external. The bridge node
  // reads its env from the ComfyUI shell. For replay-style runs, override via the
  // workflow's bridge-node inputs directly: walk the workflow JSON, find any
  // CastKitCodexBridge node, set its character_id / rig_id inputs accordingly.
  const patched = injectBridgeNodeInputs(flow, { characterId, rigId, openposeRef });

  const clientId = `ckc-replay-${randomId('ses_')}`;
  const submitted = await comfyClient.postPrompt({ host, workflowJson: patched, clientId });
  return { ok: true, promptId: submitted.prompt_id, number: submitted.number };
}

async getWorkflowHistory({ characterId, limit = 100 } = {}) {
  const cid = characterId === undefined ? null : String(characterId ?? '').trim() || null;
  const params = [];
  let where = "WHERE comfyui_workflow_json IS NOT NULL AND comfyui_workflow_json != ''";
  if (cid) { where += ' AND character_id = ?'; params.push(cid); }
  return all(
    this.db,
    `SELECT image_id, character_id, relative_path, file_hash, comfyui_workflow_json, comfyui_metadata_json, rig_id, added_at
     FROM ImageAsset ${where}
     ORDER BY added_at DESC
     LIMIT ?`,
    [...params, Math.max(1, Math.min(500, limit))]
  );
}

async extractPromptFromWorkflow({ workflowJson } = {}) {
  // Walk the workflow nodes; pull out the most-likely positive / negative
  // prompt strings (CLIPTextEncode nodes, KSampler positive/negative inputs).
  // Returns { positive: [...], negative: [...], loras: [...] }.
}

async getComfyUIStats() {
  if (!this.appConfig?.comfyui?.host) throw new Error('comfyui.host not configured');
  return comfyClient.getSystemStats({ host: this.appConfig.comfyui.host });
}
```

`injectBridgeNodeInputs`: finds nodes whose `class_type === 'CastKitCodexBridge'` and sets their inputs to the target character/rig/openpose values. ~20 LOC.

`applyOverrides`: patches arbitrary node inputs by node id + input name. Operator UI for this comes from a future WP — for v0.2.13 we accept simple `Record<nodeId, Record<inputName, value>>` patches.

#### 5. Wire commands through preload + IPC + automation map + manual

Same pattern as WP-0107 § 3-6. New commands:
- `registerComfyUIOutput` (backend)
- `replayWorkflow` (backend)
- `getWorkflowHistory` (backend)
- `extractPromptFromWorkflow` (backend)
- `getComfyUIStats` (backend)
- `getIntakePort` (control / top-level — exposes `automationGetState.intakePort` directly so the bridge node can probe it without a session)

#### 6. Workflow tab implementation

Replace `src/ui/views/WorkflowView.tsx` body. Three panels:

**Recent runs panel** — list of every `ImageAsset` row with non-null `comfyui_workflow_json`, joined to Character. Shows thumbnail, character name, model, sampler, seed, generated_at. Click → opens detail drawer with full workflow JSON (read-only, syntax-highlighted), metadata, prompts. Buttons: "Save workflow as template", "Replay against this character", "Replay against another character".

**Replay panel** — pick a workflow + a target character (autocomplete) + an optional rig (filtered by character) + an optional override openpose ref. Click "Replay" → POSTs to ComfyUI; surfaces a progress card; new image lands automatically via the intake endpoint and replaces the placeholder.

**Workflow library panel** — workflow templates the operator has flagged. Shows name, description, source (replayed N times), tags. Click → opens in Replay panel pre-filled.

For "saved workflows" we need a new table or repurpose. Lightweight option: a `WorkflowTemplate` table.

```sql
CREATE TABLE IF NOT EXISTS WorkflowTemplate (
  template_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  workflow_json TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  source_image_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_image_id) REFERENCES ImageAsset(image_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_template_name ON WorkflowTemplate(name);
```

Goes into `ensureSchemaUpgrades` as a WP-0109 migration. Plus full CRUD methods + IPC + manual.

#### 7. Wire "Replay in ComfyUI" button on Pose tab

Currently disabled in WP-0108. Replace with:

```tsx
const [latestWorkflow, setLatestWorkflow] = React.useState<unknown | null>(null);

React.useEffect(() => {
  if (!characterId) return;
  (async () => {
    const rows = await window.ckc.getWorkflowHistory({ characterId, limit: 1 });
    if (rows && rows.length > 0) {
      setLatestWorkflow(JSON.parse(rows[0].comfyui_workflow_json));
    }
  })();
}, [characterId]);

<button
  disabled={!latestWorkflow || !rigId}
  onClick={async () => {
    if (!latestWorkflow || !rigId) return;
    const r: any = await window.ckc.replayWorkflow({
      workflowJson: latestWorkflow,
      characterId,
      rigId,
      openposeRef: latestExportedOpenposeImageId,
    });
    // Toast: "Replay submitted. ComfyUI prompt_id: ${r.promptId}"
  }}
>
  Replay in ComfyUI
</button>
```

Tooltip on disabled state: "No prior workflow stored for this character; generate one with the bridge node first" or "Save a rig and export the openpose first".

#### 8. ComfyUI connection settings in CKC

New section in app config (`ckc-config.json`):

```json
{
  "comfyui": {
    "host": "http://127.0.0.1:8188",
    "client_id_prefix": "ckc",
    "intake_token": null,
    "default_replay_overrides": {}
  }
}
```

Add to `normalizeConfig` (in `app/main.js` around line 107) so existing config files get the defaults filled in.

UI: a "ComfyUI" panel in CKC settings (Settings → ComfyUI). Fields: host URL, intake token (optional, masked), "Test connection" button that calls `getComfyUIStats` and shows green/red.

#### 9. Tests (`CKC_main/test/`)

`comfyui_intake_endpoint.test.js`:
```js
const test = require('node:test');
const http = require('http');
// Boot a tiny test instance of the intake server (factor startIntakeServer
// into an exported function so tests can call it with a mock library).
// POST a fake bundle, assert file lands at right path, ImageAsset row exists.
// POST same bundle again, assert deduped: true and no new file written.
```

`comfyui_workflow_extraction.test.js` — feed fixtures (small workflow JSONs at `test/fixtures/comfyui/sd15_basic.json` and `sdxl_with_openpose.json`); assert `extractPromptFromWorkflow` returns expected positive/negative.

`comfyui_replay_skeleton.test.js` — mock ComfyUI's `/prompt` endpoint with `http.createServer`; assert `replayWorkflow` posts the right body shape.

`backend_workflow_history.test.js` — seed three rows; assert `getWorkflowHistory` join + ordering.

`comfyui_node_contract.test.js` — Python syntax + import smoke. Runs `python3 -c "import comfyui_node.castkit_codex_bridge as m; assert hasattr(m, 'CastKitCodexBridge'); assert m.CastKitCodexBridge.RETURN_TYPES == ()"`. Skipped if no Python on PATH.

`workflow_template_crud.test.js` — `WorkflowTemplate` CRUD round-trip on PG + SQLite.

#### 10. Spec bump (next available). Manual `MANUAL_VERSION` → `'2026-05-07.wp-0109'`. Test suite Section M.5 filled in.

#### 11. Ship as packaged build. v0.2.13. Smoke against the packaged build with a real ComfyUI instance — install the custom node, generate one image with the bridge connected, confirm it appears in CKC's Workflow tab and Library tab, click "Replay in ComfyUI" with a different rig override, confirm the replay produces a new image that also lands in CKC.

### Out

- Bundling ComfyUI itself.
- Auto-installing the custom node into ComfyUI's folder.
- LoRA training pipeline.
- Multi-ComfyUI-instance routing (one ComfyUI per GPU).
- Workflow visual editor inside CKC (CKC reads + replays; doesn't author).
- Image-to-image / inpainting workflows beyond standard openpose-controlnet flow.
- The `default_replay_overrides` config UI — JSON-edit only in this WP; structured editor is a follow-up.

---

## Acceptance criteria

- [ ] Intake server binds to `127.0.0.1:<port>` in [52319..52399]; refuses non-localhost requests; refuses unauthenticated requests when token is set; respects single-instance lock; survives `app.quit` cleanly.
- [ ] `automationGetState` returns `{ intakePort, intakeTokenRequired }`.
- [ ] ComfyUI custom node `castkit_codex_bridge.py` imports cleanly into a vanilla ComfyUI install (symlink or copy); node appears under "CastKit-Codex" category.
- [ ] Generating an image with the bridge node connected pushes a bundle to CKC's intake endpoint within 500 ms of completion; image lands in `images/original/` under the right character; `ImageAsset` row carries `comfyui_workflow_json`, `comfyui_metadata_json`, `rig_id` (when env var set), and content-hash filename.
- [ ] Idempotent intake: re-POSTing the same bundle returns `deduped: true` and creates no new file or row.
- [ ] CKC restart mid-generation → ComfyUI keeps running → the next bundle arrives once CKC is back up; older bundles aren't lost (ComfyUI saves to disk regardless).
- [ ] `replayWorkflow` against a stored workflow produces a new image linked to the target character + rig with byte-identical metadata round-trip after one round through ComfyUI.
- [ ] "Replay in ComfyUI" button on the Pose tab works end-to-end with the most-recent workflow and the current rig as the openpose override.
- [ ] All new commands listed in the manual; self-consistency test passes.
- [ ] All new tests pass; existing tests still pass.
- [ ] Spec bumped, manual bumped, test suite Section M.5 filled (every check row has either ✅ or a documented OPEN BUG).
- [ ] `npm run package:win` produces v0.2.13; smoke against packaged build with a real ComfyUI instance generates + replays end-to-end.

---

## Test plan

- **Unit (intake)**: synthetic POST to the intake endpoint via in-process http client; verify file + DB; re-POST verifies dedup.
- **Unit (extraction)**: workflow JSON → prompts on three fixtures (basic SD15, SDXL with openpose, SD3 with multiple LoRAs).
- **Unit (replay)**: mocked ComfyUI; verify request shape + that bridge-node inputs are correctly injected.
- **Smoke (manual, dev, real ComfyUI)**: install node, generate, verify Workflow tab populated, click Replay, verify new image lands.
- **Smoke (manual, packaged)**: same against v0.2.13 NSIS install.
- **Network safety**: launch CKC, attempt to POST from a non-localhost address (e.g. via `nc` from another machine on the LAN) — verify connection refused.

---

## Governance checklist

- [ ] Task Board: WP-0109 → IN_PROGRESS / DONE.
- [ ] Spec bump + archive.
- [ ] Codex bullet referencing the OpenRepose absorption rule (and now: OpenRepose officially obsolete after this WP ships).
- [ ] Planning-checkpoint commit pushed before code changes.
- [ ] Shipping-checkpoint commit after impl.
- [ ] In-app manual updated in same commit.
- [ ] Test suite Section M.5 completed.
- [ ] Live verification via CDP + a real ComfyUI instance.
- [ ] NAS mirror backup script run after shipping commit.

---

## Implementation notes

- HTTP server lives in main.js. Node's `http` module is sufficient — no Express. Body-size cap enforced manually (Node's http does not stream-cap by default).
- The ComfyUI custom node is product code that ships with CKC even though the operator installs it manually into ComfyUI's folder. Its location at `CKC_main/comfyui_node/` makes the install path unambiguous.
- The bridge node is stdlib-only Python; the `comfyui_node_contract.test.js` enforces this by syntax-importing the file under a clean Python.
- Identity decoupling: ComfyUI-generated images land under `images/original/<hash>.<ext>`. Operator-typed prompt text stays raw and uncensored per the codex's free-text-fields rule.
- `applyOverrides` and `injectBridgeNodeInputs`: keep them tiny (~20 LOC each). Build a structured override editor in a follow-up if needed.
- Workflow templates: name is operator-supplied, not derived from the image. Operator can have many templates; CKC doesn't impose a count limit but the UI lists 100 at a time.

---

## Risks / mitigations

- **Risk**: ComfyUI's API shape changes between releases. **Mitigation**: pin a known-working ComfyUI commit range in the manual; the bridge node's `schema: ckc.intake.comfyui_output@1` envelope decouples CKC from ComfyUI version drift. CKC reads `prompt` payload as opaque JSON; never schema-validates ComfyUI's internal node shapes.
- **Risk**: huge workflows bloat the JSONB column. **Mitigation**: PG handles JSONB up to 1 GB per row; in practice workflows are <100 KB. Add a soft 1 MB warning at insert time.
- **Risk**: malicious / corrupt workflow JSON crashes ComfyUI on replay. **Mitigation**: CKC doesn't execute workflows; ComfyUI does. CKC is transport. Operator owns the trust decision.
- **Risk**: localhost intake endpoint reachable by other apps on the same machine. **Mitigation**: token-based auth via `CKC_INTAKE_TOKEN`; default deny on token mismatch; bind to `127.0.0.1` only.
- **Risk**: a long-running ComfyUI generation orphans its replay tracking when CKC restarts. **Mitigation**: the next CKC startup polls `/history` for any in-flight prompt_ids it knows about; reconciles or marks abandoned.
- **Risk**: the bridge node fails silently if env vars unset and the operator doesn't notice. **Mitigation**: bridge logs `[castkit-codex-bridge]` lines on every skipped POST; CKC's own intake-server logs include "received from <session_id>" so the operator can verify the loop is closed.
- **Risk**: port collision with another local service in the [52319..52399] range. **Mitigation**: try-and-bind loop; record final port; expose via `automationGetState` and `getIntakePort` so the bridge can probe.

---

## Rollback

Revert the WP commit. Workflow tab returns to the WP-0107 placeholder. The "Replay in ComfyUI" button on the Pose tab goes disabled. Existing `comfyui_workflow_json` rows in `ImageAsset` stay valid (column is opaque). The ComfyUI custom node, once installed into ComfyUI's folder, will keep trying to POST to a CKC that no longer accepts; failures are non-fatal logs only.

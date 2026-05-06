# Work Packet: WP-0107 - Pose / Workflow schema + Tab shells

Date: 2026-05-06
Owner: Codex
Status: DRAFT

## Summary
First slice of folding the (now-defunct) OpenRepose project into CKC. Adds the database columns, tables, and tab shells the pose pipeline (WP-0108) and ComfyUI bridge (WP-0109) will fill. No pose math, no 3D viewport, no ComfyUI integration in this WP — only the storage layer + empty React tabs. CRUD for `Prompt` + `StoryBeat` is small enough to wire now and ship functional.

OpenRepose at `D:\Projects\LLM projects\OpenRepose` is preserved read-only as a historical reference; its Qt UI and Python core are not ported. Only the keypoint taxonomy, color palette, and design intent are reused (embedded directly in WP-0108) — no source files copied.

---

## Why
The operator has consolidated to one app: CKC. OpenRepose's primary capabilities — projecting a frontal portrait onto a 3D pose vector, rotating through yaw bins, exporting openpose JSON+PNG, registering ComfyUI outputs — must live in CKC because CKC is now the single image-database + character-sheet + workflow surface. OpenRepose was never in production.

This WP lands the empty rooms before the furniture: the schema CKC needs, the tab shells the operator needs to navigate, and the codex updates that document the absorption. WP-0108 and WP-0109 fill them.

---

## Pre-flight read list (mandatory before any edit)

A no-context model must read these BEFORE writing any code. All paths relative to repo root unless absolute.

| File | Lines | Why |
|---|---|---|
| `CKC_main/app/backend/db.js` | 1–110 | DB primitives: `run`, `exec`, `get`, `all`, `ensureColumn`, `isPostgresDb`. The migration helpers you'll use. |
| `CKC_main/app/backend/db.js` | 388–700 | `ensureSchemaUpgrades` — the function this WP extends. Read existing migrations end-to-end so new ones follow the same shape. |
| `CKC_main/app/backend/db.js` | 1156–1300 | `initSchema` — how schema bootstrap interacts with `ensureSchemaUpgrades`. WP-0103 fix is here. |
| `CKC_main/app/main.js` | 1–60 | Module imports + `app.commandLine` switches. |
| `CKC_main/app/main.js` | 566–615 | `runBackendAutomationCommand` dispatcher. Every new automation backend command goes here. |
| `CKC_main/app/main.js` | 1923–2050 | Sample `ipcMain.handle('ckc:listX', ...)` blocks. Existing pattern to mimic. |
| `CKC_main/app/preload.js` | full | The contextBridge surface. Every new IPC method needs a one-line entry. |
| `CKC_main/app/backend/library.js` | 1–250 | `CKCLibrary` class skeleton: `getCharacterPaths`, `getPaths`, common helpers. New methods land in this file. |
| `CKC_main/app/backend/library.js` | 5604–5710 | `importImages` — exemplary backend method with content-hash addressing. Reference for any new image-write path. |
| `CKC_main/app/backend/automationCommandMap.js` | full | Wired-command catalog. Three lists: `control`, `renderer`, `backend`. Add new commands to `backend`. |
| `CKC_main/app/backend/automationManual.js` | full | The in-app manual. Must list every wired command in `commandReference` + at least one feature group. Self-consistency test will fail otherwise. |
| `CKC_main/src/vite-env.d.ts` | 655–880 | The `interface Window { ckc: { ... } }` block. Every new IPC method needs a typed declaration. |
| `CKC_main/src/ui/App.tsx` | 14–40, 380–490 | The `Page` type union + the page-routing switch. New tabs are added here. |
| `CKC_main/src/ui/views/CharacterView.tsx` | 184, 2935–3120 | The `rightTab` pattern. Existing tab buttons + conditional render. |
| `CKC_main/src/ui/views/LibraryView.tsx` | 1–60, 270–320 | LibraryView shell — view structure and template AST loading pattern (CharacterView/LibraryView both pull `templateAst` the same way). |
| `CKC_main/test/automation_manual_consistency.test.js` | full | The self-consistency test. New commands MUST resolve cleanly here. |
| `CKC_GOV/PROJECT_CODEX.md` | search "Updating the in-app manual" | Hard requirement: every change touching commands updates the manual in the SAME commit. |

---

## Scope

### In

#### 1. Schema additions (additive only — see WP-0106 invariants)

All migrations added to `ensureSchemaUpgrades` in `CKC_main/app/backend/db.js`. Pattern (match the existing in-file style):

```js
// WP-0107: Pose / Workflow / Prompts / StoryBeats — OpenRepose absorption.
// All ImageAsset additions are NULL so existing rows stay valid.
await ensureColumn(db, 'ImageAsset', 'pose_json', 'TEXT');
await ensureColumn(db, 'ImageAsset', 'openpose_png_path', 'TEXT');
await ensureColumn(db, 'ImageAsset', 'comfyui_workflow_json', 'TEXT'); // JSONB on PG; TEXT on SQLite — store as JSON string both ways
await ensureColumn(db, 'ImageAsset', 'comfyui_metadata_json', 'TEXT');
await ensureColumn(db, 'ImageAsset', 'prompts_json', 'TEXT');
await ensureColumn(db, 'ImageAsset', 'rig_id', 'TEXT');
await run(db, 'CREATE INDEX IF NOT EXISTS idx_image_rig_id ON ImageAsset(rig_id)');

await exec(
  db,
  `
  CREATE TABLE IF NOT EXISTS Rig (
    rig_id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    portrait_image_id TEXT NOT NULL,
    pose_json TEXT NOT NULL,
    calibration_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE CASCADE,
    FOREIGN KEY(portrait_image_id) REFERENCES ImageAsset(image_id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_rig_character ON Rig(character_id);
  CREATE INDEX IF NOT EXISTS idx_rig_portrait ON Rig(portrait_image_id);

  CREATE TABLE IF NOT EXISTS Prompt (
    prompt_id TEXT PRIMARY KEY,
    character_id TEXT,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_prompt_character ON Prompt(character_id);
  CREATE INDEX IF NOT EXISTS idx_prompt_kind ON Prompt(character_id, kind);

  CREATE TABLE IF NOT EXISTS StoryBeat (
    beat_id TEXT PRIMARY KEY,
    character_id TEXT,
    title TEXT NOT NULL,
    body TEXT,
    prompt_ids_json TEXT NOT NULL DEFAULT '[]',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(character_id) REFERENCES Character(character_id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_storybeat_character ON StoryBeat(character_id, order_index);

  CREATE TABLE IF NOT EXISTS RigTag (
    rig_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (rig_id, tag_id),
    FOREIGN KEY(rig_id) REFERENCES Rig(rig_id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES Tag(tag_id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_rigtag_rig ON RigTag(rig_id);
  CREATE INDEX IF NOT EXISTS idx_rigtag_tag ON RigTag(tag_id);
  `
);
```

Notes:
- Use `TEXT` for JSON columns on both providers — `library.js` reads/writes JSON as strings everywhere (see `tags_json`, `palette_json`, etc. in the existing schema). PG's JSONB optimization isn't needed for these write-once / read-mostly columns.
- `DATETIME` works as `TIMESTAMPTZ` on PG via the existing translator; do not switch dialects.
- `Tag` table already exists; do not redefine it. Confirm by searching `db.js` for `CREATE TABLE IF NOT EXISTS Tag`.
- All `CREATE INDEX IF NOT EXISTS` so re-running is a no-op.

#### 2. Backend method implementations in `CKC_main/app/backend/library.js`

Add a section to the `CKCLibrary` class near the existing tag/relation methods. Each method follows the exact patterns of `listCharacterScripts` / `addCharacterScript` from WP-0100:

```js
// ===== WP-0107: Rigs (skeleton — full impl in WP-0108) =====

async listRigs({ characterId } = {}) {
  const cid = String(characterId ?? '').trim();
  if (cid) {
    return all(
      this.db,
      `SELECT rig_id, character_id, portrait_image_id, pose_json, calibration_json, created_at, updated_at
       FROM Rig WHERE character_id = ? ORDER BY created_at DESC`,
      [cid]
    );
  }
  return all(
    this.db,
    `SELECT rig_id, character_id, portrait_image_id, pose_json, calibration_json, created_at, updated_at
     FROM Rig ORDER BY created_at DESC LIMIT 200`,
    []
  );
}

async getRig({ rigId } = {}) {
  const rid = String(rigId ?? '').trim();
  if (!rid) return null;
  return get(
    this.db,
    `SELECT rig_id, character_id, portrait_image_id, pose_json, calibration_json, created_at, updated_at
     FROM Rig WHERE rig_id = ?`,
    [rid]
  );
}

async createRig({ /* characterId, portraitImageId, poseJson */ } = {}) {
  // WP-0108 implements; WP-0107 lands the schema + skeleton.
  throw new Error('createRig is not yet implemented; see WP-0108.');
}

async updateRigCalibration({ /* rigId, calibrationJson */ } = {}) {
  throw new Error('updateRigCalibration is not yet implemented; see WP-0108.');
}

// ===== WP-0107: Prompts (full CRUD) =====

async listPrompts({ characterId, kind } = {}) {
  const cid = characterId === undefined ? null : String(characterId ?? '').trim() || null;
  const k = kind === undefined ? null : String(kind ?? '').trim() || null;
  const where = [];
  const params = [];
  if (cid !== null) { where.push('character_id = ?'); params.push(cid); }
  if (k !== null) { where.push('kind = ?'); params.push(k); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return all(
    this.db,
    `SELECT prompt_id, character_id, kind, text, tags_json, created_at, updated_at
     FROM Prompt ${whereSql} ORDER BY updated_at DESC`,
    params
  );
}

async upsertPrompt({ promptId, characterId, kind, text, tags } = {}) {
  const k = String(kind ?? '').trim();
  const t = String(text ?? '');
  if (!k) throw new Error('upsertPrompt: kind is required');
  if (!t.trim()) throw new Error('upsertPrompt: text is required');
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags.map(String) : []);
  const cid = characterId == null ? null : String(characterId).trim() || null;

  if (promptId) {
    const pid = String(promptId).trim();
    await run(
      this.db,
      `UPDATE Prompt SET character_id = ?, kind = ?, text = ?, tags_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE prompt_id = ?`,
      [cid, k, t, tagsJson, pid]
    );
    return { ok: true, promptId: pid };
  }
  const newId = randomId('prompt_');
  await run(
    this.db,
    `INSERT INTO Prompt(prompt_id, character_id, kind, text, tags_json) VALUES(?, ?, ?, ?, ?)`,
    [newId, cid, k, t, tagsJson]
  );
  return { ok: true, promptId: newId };
}

async deletePrompt({ promptId } = {}) {
  const pid = String(promptId ?? '').trim();
  if (!pid) throw new Error('deletePrompt: promptId is required');
  await run(this.db, 'DELETE FROM Prompt WHERE prompt_id = ?', [pid]);
  return { ok: true };
}

// ===== WP-0107: Story beats (full CRUD) =====

async listStoryBeats({ characterId } = {}) {
  const cid = characterId === undefined ? null : String(characterId ?? '').trim() || null;
  if (cid) {
    return all(
      this.db,
      `SELECT beat_id, character_id, title, body, prompt_ids_json, order_index, created_at, updated_at
       FROM StoryBeat WHERE character_id = ? ORDER BY order_index ASC, created_at ASC`,
      [cid]
    );
  }
  return all(
    this.db,
    `SELECT beat_id, character_id, title, body, prompt_ids_json, order_index, created_at, updated_at
     FROM StoryBeat ORDER BY order_index ASC, created_at ASC LIMIT 500`
  );
}

async upsertStoryBeat({ beatId, characterId, title, body, promptIds, orderIndex } = {}) {
  const ttl = String(title ?? '').trim();
  if (!ttl) throw new Error('upsertStoryBeat: title is required');
  const cid = characterId == null ? null : String(characterId).trim() || null;
  const idsJson = JSON.stringify(Array.isArray(promptIds) ? promptIds.map(String) : []);
  const ord = Number.isFinite(orderIndex) ? Number(orderIndex) | 0 : 0;
  const bdy = body == null ? null : String(body);

  if (beatId) {
    const bid = String(beatId).trim();
    await run(
      this.db,
      `UPDATE StoryBeat SET character_id = ?, title = ?, body = ?, prompt_ids_json = ?, order_index = ?, updated_at = CURRENT_TIMESTAMP
       WHERE beat_id = ?`,
      [cid, ttl, bdy, idsJson, ord, bid]
    );
    return { ok: true, beatId: bid };
  }
  const newId = randomId('beat_');
  await run(
    this.db,
    `INSERT INTO StoryBeat(beat_id, character_id, title, body, prompt_ids_json, order_index) VALUES(?, ?, ?, ?, ?, ?)`,
    [newId, cid, ttl, bdy, idsJson, ord]
  );
  return { ok: true, beatId: newId };
}

async deleteStoryBeat({ beatId } = {}) {
  const bid = String(beatId ?? '').trim();
  if (!bid) throw new Error('deleteStoryBeat: beatId is required');
  await run(this.db, 'DELETE FROM StoryBeat WHERE beat_id = ?', [bid]);
  return { ok: true };
}
```

`randomId` is the existing helper used throughout `library.js`; do not redefine.

#### 3. IPC handlers in `CKC_main/app/main.js`

Add to the `ipcMain.handle(...)` block (cluster near `listCharacterScripts` block from WP-0100). Pattern matches existing handlers exactly:

```js
ipcMain.handle('ckc:listRigs', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.listRigs(params || {});
});
ipcMain.handle('ckc:getRig', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.getRig(params || {});
});
ipcMain.handle('ckc:createRig', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.createRig(params || {});
});
ipcMain.handle('ckc:updateRigCalibration', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.updateRigCalibration(params || {});
});
ipcMain.handle('ckc:listPrompts', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.listPrompts(params || {});
});
ipcMain.handle('ckc:upsertPrompt', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.upsertPrompt(params || {});
});
ipcMain.handle('ckc:deletePrompt', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.deletePrompt(params || {});
});
ipcMain.handle('ckc:listStoryBeats', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.listStoryBeats(params || {});
});
ipcMain.handle('ckc:upsertStoryBeat', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.upsertStoryBeat(params || {});
});
ipcMain.handle('ckc:deleteStoryBeat', async (_evt, params) => {
    const lib = await ensureLibrary();
    return lib.deleteStoryBeat(params || {});
});
```

Then extend `runBackendAutomationCommand` (currently at `main.js:566`) by adding new dispatch entries before the trailing `throw`:

```js
// WP-0107: Pose / Prompts / StoryBeats
if (name === 'listRigs') return lib.listRigs(p);
if (name === 'getRig') return lib.getRig(p);
if (name === 'createRig') return lib.createRig(p);
if (name === 'updateRigCalibration') return lib.updateRigCalibration(p);
if (name === 'listPrompts') return lib.listPrompts(p);
if (name === 'upsertPrompt') return lib.upsertPrompt(p);
if (name === 'deletePrompt') return lib.deletePrompt(p);
if (name === 'listStoryBeats') return lib.listStoryBeats(p);
if (name === 'upsertStoryBeat') return lib.upsertStoryBeat(p);
if (name === 'deleteStoryBeat') return lib.deleteStoryBeat(p);
```

#### 4. Preload bridge in `CKC_main/app/preload.js`

Add to the contextBridge object (alphabetical / grouped near related entries works fine):

```js
listRigs: (params) => ipcRenderer.invoke('ckc:listRigs', params),
getRig: (params) => ipcRenderer.invoke('ckc:getRig', params),
createRig: (params) => ipcRenderer.invoke('ckc:createRig', params),
updateRigCalibration: (params) => ipcRenderer.invoke('ckc:updateRigCalibration', params),
listPrompts: (params) => ipcRenderer.invoke('ckc:listPrompts', params),
upsertPrompt: (params) => ipcRenderer.invoke('ckc:upsertPrompt', params),
deletePrompt: (params) => ipcRenderer.invoke('ckc:deletePrompt', params),
listStoryBeats: (params) => ipcRenderer.invoke('ckc:listStoryBeats', params),
upsertStoryBeat: (params) => ipcRenderer.invoke('ckc:upsertStoryBeat', params),
deleteStoryBeat: (params) => ipcRenderer.invoke('ckc:deleteStoryBeat', params),
```

#### 5. Type declarations in `CKC_main/src/vite-env.d.ts`

Add to the `interface Window { ckc: { ... } }` block:

```ts
listRigs: (params?: { characterId?: string } | null) => Promise<CKCRigRow[]>;
getRig: (params: { rigId: string }) => Promise<CKCRigRow | null>;
createRig: (params: { characterId: string; portraitImageId: string; poseJson: string }) => Promise<{ ok: true; rigId: string }>;
updateRigCalibration: (params: { rigId: string; calibrationJson: string }) => Promise<{ ok: true; rigId: string }>;

listPrompts: (params?: { characterId?: string | null; kind?: string } | null) => Promise<CKCPromptRow[]>;
upsertPrompt: (params: { promptId?: string; characterId?: string | null; kind: string; text: string; tags?: string[] }) => Promise<{ ok: true; promptId: string }>;
deletePrompt: (params: { promptId: string }) => Promise<{ ok: true }>;

listStoryBeats: (params?: { characterId?: string | null } | null) => Promise<CKCStoryBeatRow[]>;
upsertStoryBeat: (params: { beatId?: string; characterId?: string | null; title: string; body?: string | null; promptIds?: string[]; orderIndex?: number }) => Promise<{ ok: true; beatId: string }>;
deleteStoryBeat: (params: { beatId: string }) => Promise<{ ok: true }>;
```

Plus the row types (place near the existing `CKCCharacterTemplateImage` etc. block):

```ts
type CKCRigRow = {
  rig_id: string;
  character_id: string;
  portrait_image_id: string;
  pose_json: string;
  calibration_json: string | null;
  created_at: string;
  updated_at: string;
};

type CKCPromptRow = {
  prompt_id: string;
  character_id: string | null;
  kind: string;
  text: string;
  tags_json: string;
  created_at: string;
  updated_at: string;
};

type CKCStoryBeatRow = {
  beat_id: string;
  character_id: string | null;
  title: string;
  body: string | null;
  prompt_ids_json: string;
  order_index: number;
  created_at: string;
  updated_at: string;
};
```

#### 6. Automation command map + manual

In `CKC_main/app/backend/automationCommandMap.js`, append to the `backend` array (preserve the existing WP-0100 grouping comments):

```js
// WP-0107: Pose / Prompts / StoryBeats — OpenRepose absorption
'listRigs',
'getRig',
'createRig',
'updateRigCalibration',
'listPrompts',
'upsertPrompt',
'deletePrompt',
'listStoryBeats',
'upsertStoryBeat',
'deleteStoryBeat',
```

In `CKC_main/app/backend/automationManual.js`:

1. Bump `MANUAL_VERSION` to `'2026-05-06.wp-0107'`.
2. Add a new feature group entry `pose-and-workflow` near the existing groups. Wired commands in `commands`; unwired (createRig, updateRigCalibration) go in `roadmap` per the code-truth rule. Example shape:

```js
{
  id: 'pose-and-workflow',
  title: 'Pose, ComfyUI workflow, prompts, story beats',
  wp: ['WP-0107', 'WP-0108', 'WP-0109'],
  summary: 'CKC absorbed the (now-defunct) OpenRepose project. WP-0107 lands the schema and tab shells; WP-0108 will land the pose pipeline (mediapipe-WASM + Three.js + canvas); WP-0109 will land the ComfyUI bridge + workflow replay. Image bytes content-hash addressed per the identity-decoupling rule.',
  commands: [
    'listRigs', 'getRig',
    'listPrompts', 'upsertPrompt', 'deletePrompt',
    'listStoryBeats', 'upsertStoryBeat', 'deleteStoryBeat',
  ],
  roadmap: [
    'createRig (lands in WP-0108)',
    'updateRigCalibration (lands in WP-0108)',
    'exportOpenposePng (lands in WP-0108)',
    'registerComfyUIOutput (lands in WP-0109)',
    'replayWorkflow (lands in WP-0109)',
    'getWorkflowHistory (lands in WP-0109)',
    'extractPromptFromWorkflow (lands in WP-0109)',
  ],
  notes: [
    'Pose / Workflow tabs render placeholder banners until WP-0108 / WP-0109 ship; do not certify pose features absent live verification on those WPs.',
  ],
}
```

3. Add `commandReference` entries for every wired command. Example for `listRigs`:

```js
{
  id: 'listRigs',
  target: 'backend',
  description: 'List Rig rows (portrait → openpose triplet); optionally scoped to a character. Returns up to 200 rows when no scope is provided.',
  example: { characterId: 'char_001' },
},
```

Fill out the rest the same way. The self-consistency test reads this list and rejects unknowns / silent omissions.

#### 7. React tab shells

Edit `CKC_main/src/ui/App.tsx`:

```ts
// Line 14:
type Page = 'library' | 'character' | 'exports' | 'intake' | 'pose' | 'workflow';
type NonExportPage = 'library' | 'character' | 'pose' | 'workflow';
```

Add page routes after the existing `IntakeSorterView` block (around line 475):

```tsx
) : page === 'pose' ? (
  <PoseView onBack={() => setPage('library')} />
) : page === 'workflow' ? (
  <WorkflowView onBack={() => setPage('library')} />
) : null}
```

Create new view files:
- `CKC_main/src/ui/views/PoseView.tsx` — placeholder body. Renders a banner + the reserved panel layout. See template below.
- `CKC_main/src/ui/views/WorkflowView.tsx` — same placeholder pattern.

`PoseView.tsx` template (~80 lines):

```tsx
import React from 'react';
import styles from './poseView.module.css';

export function PoseView({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Library</button>
        <div className={styles.title}>Pose</div>
      </header>

      <div className={styles.banner}>
        <strong>Coming in WP-0108.</strong> This tab will hold the pose pipeline: mediapipe pose + face_mesh
        in a Web Worker, Three.js orbital 3D viewport, canvas 2D openpose viewport, and Calibration / Markers /
        Reframer panels. See <code>CKC_GOV/work_packets/WP-0108_Pose_Pipeline_React.md</code>.
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.panelStub}>Calibration</div>
          <div className={styles.panelStub}>Markers</div>
          <div className={styles.panelStub}>Reframer</div>
        </aside>
        <main className={styles.center}>
          <div className={styles.viewportStub}>3D viewport (WP-0108)</div>
          <div className={styles.viewportStub}>2D openpose viewport (WP-0108)</div>
        </main>
        <aside className={styles.right}>
          <div className={styles.panelStub}>Yaw / export controls (WP-0108)</div>
          <div className={styles.panelStub}>Replay in ComfyUI (WP-0109)</div>
        </aside>
      </div>
    </div>
  );
}
```

Same shape for `WorkflowView.tsx` with three panels: Recent runs / Replay / Workflow library.

CSS modules (`poseView.module.css`, `workflowView.module.css`) match the visual style of `characterView.module.css` (read 1–60 of that file; copy the variables and color palette).

For navigation: add buttons to the existing tab strip in `LibraryView.tsx` or to the menu drawer (search for `setPage` calls in `LibraryView.tsx` to find the existing pattern). Plus add the `Page` value to the menu drawer's links.

#### 8. Prompts + Story-beats UI

Two simple panels — these are CRUD lists, not novel UI. Place them inside CharacterView's `rightTab` switcher as new tabs (`'prompts'`, `'beats'`), and also on the LibraryView as global lists.

CharacterView edit (around line 184):

```ts
const [rightTab, setRightTab] = React.useState<'sheet' | 'photos' | 'tools' | 'prompts' | 'beats'>('sheet');
```

Add tab buttons (~line 2982 for `'tools'`):

```tsx
<button className={styles.tabBtn} data-active={rightTab === 'prompts' ? '1' : '0'} onClick={() => setRightTab('prompts')}>
  Prompts
</button>
<button className={styles.tabBtn} data-active={rightTab === 'beats' ? '1' : '0'} onClick={() => setRightTab('beats')}>
  Story beats
</button>
```

Add render branches (~line 3111):

```tsx
) : rightTab === 'prompts' ? (
  <PromptsPanel characterId={characterId} />
) : rightTab === 'beats' ? (
  <StoryBeatsPanel characterId={characterId} />
) : null}
```

Components in `CKC_main/src/ui/components/PromptsPanel.tsx` + `StoryBeatsPanel.tsx`. Keep them dead-simple: a list of rows, an "Add" button that opens an inline form, a delete button per row, and an edit-in-place input. Use CKC's existing `useState` + `window.ckc.listPrompts` etc. patterns. ~100 LOC each.

#### 9. Codex updates in `CKC_GOV/PROJECT_CODEX.md`

Add a new section between "Updating the in-app manual is a hard requirement" and "Versioning + release policy":

```markdown
### OpenRepose absorption (binding)
The OpenRepose project at `D:\Projects\LLM projects\OpenRepose` is **defunct** as of 2026-05-06. CKC is now the canonical home for pose / openpose / ComfyUI workflow features.

- The OpenRepose repo is **preserved read-only** for historical reference. Do not modify it, do not push to it, do not import it as a dependency from CKC.
- Pose / openpose / ComfyUI features that reference OpenRepose for design intent must include the file path + line citation in the WP. The implementation must be a clean recreation in CKC's stack (TS / React / Electron / PG), not a code copy.
- WP-0107 lands the schema + tab shells; WP-0108 lands the pose pipeline; WP-0109 lands the ComfyUI bridge. After WP-0109 ships, the OpenRepose repo is officially obsolete.

This rule binds in addition to the code-truth, in-app-manual, and live-verification rules above.
```

#### 10. Test suite section in `CKC_GOV/test_suites/CKC_TEST_SUITE.md`

Add a new section M after the existing sections:

```markdown
## Section M — Pose / Workflow / Prompts / Story-beats (OpenRepose absorption)

### M1. Schema (WP-0107)
- M1.1. `ImageAsset` has the 6 new NULL columns (`pose_json`, `openpose_png_path`, `comfyui_workflow_json`, `comfyui_metadata_json`, `prompts_json`, `rig_id`); existing rows have NULL values; `rig_id` index exists.
- M1.2. `Rig`, `Prompt`, `StoryBeat`, `RigTag` tables exist with the declared columns + indexes.
- M1.3. `ensureSchemaUpgrades` is idempotent: re-running on a current DB makes zero writes (verify via `ckcdbmigration` row count).
- M1.4. Migration runs on both SQLite and Postgres.

### M2. Backend CRUD (WP-0107)
- M2.1. `upsertPrompt` insert + update round-trip; `tags_json` byte-exact.
- M2.2. `upsertStoryBeat` insert + update + reorder via `orderIndex` round-trip.
- M2.3. `listRigs` returns `[]` on empty DB; `createRig` throws stub error pointing at WP-0108.
- M2.4. Listed in the in-app manual; self-consistency test passes.

### M3. UI shells (WP-0107)
- M3.1. Page navigation includes Pose + Workflow buttons (in LibraryView's tab strip or menu drawer).
- M3.2. Pose tab renders banner + 3 stub panels (left) + 2 stub viewports (center) + 2 stub controls (right); no console errors.
- M3.3. Workflow tab renders banner + 3 stub panels.
- M3.4. CharacterView right pane has Prompts + Story-beats tabs; CRUD works end-to-end via the UI; reload preserves values.

### M4. Pose pipeline (WP-0108) — pending
- (filled in by WP-0108)

### M5. ComfyUI bridge (WP-0109) — pending
- (filled in by WP-0109)
```

#### 11. Tests

Files to create under `CKC_main/test/`:

`schema_pose_workflow_additions.test.js` — uses the existing test helpers (see `test/backend_postgres_provider.test.js` for the PG opener pattern, `test/backend_sheet.test.js` for the SQLite opener). Asserts every new column + table + index exists.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CKCLibrary } = require('../app/backend/library');

const builtInTemplatePath = path.join(__dirname, '..', '..', 'CKC_GOV', 'templates', 'character_sheet_templates', 'CHARACTER_SHEET__v2.00.txt');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ckc-test-'));
}

test('WP-0107: ImageAsset gains the 6 new NULL columns', async () => {
  const libraryRoot = makeTempDir();
  const lib = new CKCLibrary({ libraryRoot, builtInTemplatePath, defaultTemplateId: 'v2.00', electronNativeImage: null });
  await lib.init();
  const colsRows = await new Promise((resolve, reject) => {
    lib.db.all("PRAGMA table_info(ImageAsset)", (err, rows) => err ? reject(err) : resolve(rows));
  });
  const colNames = colsRows.map((r) => r.name);
  for (const c of ['pose_json', 'openpose_png_path', 'comfyui_workflow_json', 'comfyui_metadata_json', 'prompts_json', 'rig_id']) {
    assert.ok(colNames.includes(c), `missing column ${c}`);
  }
});

// + similar tests for Rig / Prompt / StoryBeat / RigTag tables
```

`backend_prompts_crud.test.js` — Prompt full lifecycle.
`backend_story_beats_crud.test.js` — StoryBeat full lifecycle.
`backend_rigs_skeleton.test.js` — listRigs empty + createRig throws stub error.

Match the test patterns in `backend_character_scripts.test.js` (read it first) for setup/teardown.

#### 12. Spec bump v00.068 → v00.069 (or next available after WP-0105 ships)

Follow the spec versioning rules in `CKC_GOV/PROJECT_CODEX.md` and the existing changelog format. Section text:

```markdown
## v00.069 — WP-0107 Pose / Workflow schema + tab shells (2026-05-06)

This version of the spec records the OpenRepose absorption foundation: schema additions, tab shells, Prompts + Story-beats CRUD, and the codex rule that pins OpenRepose as defunct.

### Schema additions (additive only)
- `ImageAsset` gains 6 NULL columns: pose_json, openpose_png_path, comfyui_workflow_json, comfyui_metadata_json, prompts_json, rig_id.
- New tables: Rig (portrait → openpose triplet), Prompt (reusable prompt fragments), StoryBeat (prompt sequencing), RigTag (many-to-many).
- Indexes pinned per the WP-0106 forward-compat law.

### Backend surface
- 10 new wired backend automation commands.
- listRigs / getRig wired; createRig / updateRigCalibration land in WP-0108.
- Full CRUD for Prompts and Story-beats.

### UI
- Pose + Workflow top-level pages added to App.tsx's Page union, both rendering placeholder banners pointing at WP-0108 / WP-0109.
- Prompts + Story-beats panels added to CharacterView's right pane.

### Governance
- New codex section "OpenRepose absorption (binding)" pins the source repo as read-only.
```

Archive the previous spec to `CKC_GOV/spec/archive_spec/`.

#### 13. Ship as packaged build per the ship-as-packaged memory. v0.2.11.

### Out

- Pose detection (mediapipe-WASM, Three.js, canvas-based 2D viewport) — WP-0108.
- ComfyUI bridge + actual `registerComfyUIOutput` + workflow replay — WP-0109.
- Migrating any data from OpenRepose (none exists; explicitly skipped).
- Touching the OpenRepose repo. Read-only henceforth.
- Multi-yaw rendering pipeline / batch export — slot for a future WP.
- LoRA training pair extraction.

---

## Acceptance criteria

- [ ] `ensureSchemaUpgrades` adds the 6 new columns + 4 new tables + 8 new indexes on both providers; idempotent.
- [ ] All 10 new IPC handlers wired through preload + automation command map + manual + vite-env.d.ts.
- [ ] Self-consistency test (`automation_manual_consistency.test.js`) passes — no orphan commands, no silent omissions.
- [ ] Prompt CRUD works end-to-end through the UI on Aeri (`CHAR-000003`); 3 prompts saved, reload, all 3 still there byte-exact.
- [ ] StoryBeat CRUD works end-to-end with reorder.
- [ ] `listRigs` returns `[]` on empty DB; `createRig` returns the stub error pointing at WP-0108.
- [ ] Pose + Workflow tabs render with their banners; tab-switch latency < 50 ms; no console errors.
- [ ] PROJECT_CODEX.md has the OpenRepose absorption section.
- [ ] Test suite Section M added with M1–M3 check rows; M4–M5 marked pending.
- [ ] All new tests pass; existing tests still pass.
- [ ] Spec bumped, old archived, manual `MANUAL_VERSION` bumped.
- [ ] `npm run package:win` produces v0.2.11; smoke against the packaged build verifies the schema + Prompts UI.

---

## Test plan

- **Unit (DB)**: schema migration on a fresh and a stale DB; verify additive-only and idempotent.
- **Unit (CRUD)**: Prompt + StoryBeat lifecycles on both SQLite + PG.
- **Smoke (manual, dev)**: open CKC, navigate to Pose tab → verify banner, navigate to Workflow tab → verify banner, open Aeri → switch right pane to Prompts, add 2 prompts, switch to Story-beats, add a beat referencing those prompts, reload character, verify all preserved.
- **Smoke (manual, packaged)**: same against v0.2.11 NSIS install.
- **Live verification (CDP)**: capture screenshots of each new surface; save under `CKC_GOV/targets/CKC/automation_captures/`.

---

## Governance checklist

- [ ] Task Board: WP-0107 row → IN_PROGRESS, then DONE.
- [ ] Spec bump + archive.
- [ ] No file/folder/artifact names with spaces.
- [ ] Planning-checkpoint commit (if not already) pushed before code changes.
- [ ] Shipping-checkpoint commit after impl.
- [ ] In-app manual updated in same commit (hard requirement).
- [ ] Self-consistency test passes.
- [ ] Test suite Section M added.
- [ ] Live verification via CDP — captures of Pose tab placeholder, Workflow tab placeholder, Prompts CRUD, Story-beats CRUD.
- [ ] NAS mirror backup script run after shipping commit.

---

## Risks / mitigations

- **Risk**: OpenRepose repo stays accessible to other assistants and they keep working in it. **Mitigation**: codex rule + a `_OPENREPOSE_DEFUNCT_README.md` top-level marker added to OpenRepose (single manual commit by the operator) saying "absorbed into CKC; see CKC repo for active development".
- **Risk**: Prompt + StoryBeat tables drift from WP-0108 / WP-0109 needs. **Mitigation**: WP-0108 reviews these tables as part of its design; both WPs are queued so the cross-validation happens within days.
- **Risk**: empty tab placeholders shipping to a release create the impression of vaporware. **Mitigation**: explicit "Coming in WP-XXXX" banner with the WP id linked to the work_packet file.
- **Risk**: PG path produces a slightly different `PRAGMA table_info` shape than SQLite. **Mitigation**: schema test queries `information_schema.columns` on PG and `PRAGMA table_info` on SQLite; helper at `test/_helpers/schemaIntrospection.js` (create as part of this WP).

---

## Rollback

Revert the WP commit. The 4 new tables and 6 new columns stay in any DB they were added to (no destructive rollback path; they're benign NULL columns / empty tables). Re-deploy of an older CKC version reads the new schema fine because `ensureSchemaUpgrades` is idempotent and forward-tolerant.

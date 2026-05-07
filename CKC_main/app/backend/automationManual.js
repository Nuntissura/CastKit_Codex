// In-app LLM/operator manual.
//
// CODE-TRUTH RULE (per CKC_GOV/PROJECT_CODEX.md "Code-truth and
// documentation consistency"): every entry in featureGroups[].commands
// and commandReference[].id MUST resolve to a wired automation command
// (TOP_LEVEL_AUTOMATION_IPC or getAutomationCommandMap), or be prefixed
// `script:` to point at a governance script under CKC_GOV/scripts/.
// Aspirational items belong in featureGroups[].roadmap, never in
// commands. The self-consistency test at
// `test/automation_manual_consistency.test.js` enforces this rule.

const {
  getAutomationCommandMap,
  TOP_LEVEL_AUTOMATION_IPC,
  getAllWiredAutomationCommands,
  classifyAutomationCommand,
} = require('./automationCommandMap');

const MANUAL_VERSION = '2026-05-07.wp-0115-rig-workspaces';

const featureGroups = [
  {
    id: 'storage-and-governance',
    title: 'Storage, governance, and operating model',
    wp: ['WP-0001', 'WP-0008', 'WP-0009', 'WP-0020', 'WP-0021', 'WP-0091', 'WP-0092', 'WP-0106'],
    summary:
      'CKC is governed from CKC_GOV and product code lives in CKC_main. PostgreSQL is the current/default database provider; libraryRoot still holds images, exports, templates, and per-character files.',
    commands: [
      'automationGetState',
      'automationGetManual',
      'resetPreferences',
      'requestFullReset',
      'listOrphanManifests',
      'adoptOrphanImages',
      'script:postgres_up.ps1',
      'script:postgres_dump.ps1',
      'script:postgres_restore.ps1',
    ],
    notes: [
      'Do not mirror governance into CKC_main/docs.',
      'Do not introduce spaces in generated file or folder names.',
      'Use PostgreSQL dumps for database backup; filesystem mirror alone is not a database backup.',
      'Reset modes are explicit: Update/Reinstall preserve data, Light reset wipes preferences, Full reset writes an orphan manifest and keeps image bytes under images/original and images/thumb.',
      'Schema and ingestion compatibility is executable: legacy fixtures, additive migration linting, handler routing pins, template field-ID immutability, idempotent task re-import, backup version traceability, spec/adapter consistency, and ImageAsset index pins are covered by WP-0106 tests.',
    ],
  },
  {
    id: 'library-and-character-navigation',
    title: 'Library, portfolio viewer, character sheets',
    wp: ['WP-0003', 'WP-0012', 'WP-0029', 'WP-0030', 'WP-0031', 'WP-0032', 'WP-0033', 'WP-0037', 'WP-0046'],
    summary:
      'The main UI is a 2-panel portfolio viewer with images and sheet side-by-side. Character IDs are system-managed public IDs while internal IDs remain stable folder/DB keys.',
    commands: [
      'openLibrary',
      'openCharacter',
      'getCharacter',
      'listCharacters',
      'selectImage',
      'getRendererState',
      'getRendererUIState',
      'createCharacter',
      'saveCharacter',
      'softDeleteCharacters',
      'restoreCharacters',
      'listTemplates',
      'listAllTags',
      'globalSearch',
    ],
    roadmap: [
      'Live sheet field values inside getRendererUIState (requires lifting sheet editor state out of CharacterView; current implementation returns App-level state only)',
    ],
    notes: [
      'The sheet editor preserves template field order and user-entered text.',
      'Use explicit characterId values for automation; never drive navigation through mouse clicks.',
      'Resizable layouts are persisted in app config.',
      'Block-list and single-block fields (e.g. Side_Hustles: <list of Hustle_Block | optional>) render as structured sub-form editors with per-sub-field input types, + Add / Remove / Move up/down controls. Storage format is a JSON string (array of objects for block_list, single object for block); empty list serializes to "" not "[]". Sub-field validation surfaces issues with paths like CHAR-WRK-007[0].HUS-BLK-003. Malformed pre-existing JSON falls back to an empty list with a one-time warning.',
    ],
  },
  {
    id: 'media-gallery-and-metadata',
    title: 'Images, gallery, ratings, tags, metadata',
    wp: [
      'WP-0004',
      'WP-0007',
      'WP-0014',
      'WP-0016',
      'WP-0025',
      'WP-0026',
      'WP-0030',
      'WP-0045',
      'WP-0055',
      'WP-0056',
      'WP-0057',
      'WP-0058',
      'WP-0059',
      'WP-0064',
      'WP-0066',
      'WP-0067',
      'WP-0084',
      'WP-0088',
      'WP-0089',
    ],
    summary:
      'Image assets support ratings, favorite, notes, tags, source provenance, palettes, dHash similarity, duplicate review, batch metadata edits, AI tag suggestions, and inbox/clipboard/URL import.',
    commands: [
      'importImages',
      'setImageMeta',
      'setImagesMetaBatch',
      'listGlobalCarouselImages',
      'listPendingImages',
    ],
    roadmap: [
      'findSimilarImages (preload-only today; not exposed to automation)',
      'scanInbox (preload-only today; not exposed to automation)',
      'importFromUrl (preload-only today; not exposed to automation)',
      'importClipboardImage (preload-only today; not exposed to automation)',
    ],
    notes: [
      'Rating hotkeys are UI-only; automation should call metadata commands.',
      'Carousel/frontpage are represented as image tags.',
      'Linked intake mode copies source files; folder-only intake moves source files into status folders.',
    ],
  },
  {
    id: 'pose-rig-workflow',
    title: 'Pose, rigs, workflow prompts, and story beats',
    wp: ['WP-0107', 'WP-0108', 'WP-0109', 'WP-0110', 'WP-0111', 'WP-0113', 'WP-0115'],
    summary:
      'The Pose and Workflow tabs share CKC characters, images, tags, notes, prompts, story beats, rigs, identity profiles, and ComfyUI workflow lineage through the same database and automation pipeline.',
    commands: [
      'openPose',
      'openWorkflow',
      'listRigs',
      'getRig',
      'createRig',
      'updateRigCalibration',
      'setRigHeadPose',
      'setRigPortrait',
      'updateRigPose',
      'exportOpenposePng',
      'listOpenRigs',
      'openRigWorkspace',
      'setActiveRig',
      'closeRigWorkspace',
      'reorderOpenRigWorkspaces',
      'listIdentityProfiles',
      'getIdentityProfile',
      'createIdentityProfile',
      'updateIdentityProfile',
      'deleteIdentityProfile',
      'registerComfyUIOutput',
      'getWorkflowHistory',
      'extractPromptFromWorkflow',
      'replayWorkflow',
      'getComfyUIStats',
      'listPrompts',
      'upsertPrompt',
      'deletePrompt',
      'listStoryBeats',
      'upsertStoryBeat',
      'deleteStoryBeat',
    ],
    roadmap: [
      'WorkflowTemplate CRUD (future WP-0109 hardening)',
    ],
    notes: [
      'Use openPose/openWorkflow for renderer navigation; use backend rig/prompt/beat commands for deterministic data setup.',
      'PoseKit detection, yaw/pitch/roll head-pose transforms, openpose JSON, and content-hash openpose PNG export are wired through the backend. Head pose uses intrinsic YXZ order and persists as a quaternion in rig calibration JSON. Local MediaPipe pose + face + hand model assets are bundled for body-18, face-70, and hand-21 detection; the worker falls back to a deterministic body-18 rig when assets or image bitmap creation fail.',
      'Hand detection fills hand_left_keypoints_2d and hand_right_keypoints_2d with canonical OpenPose 21-point arrays when MediaPipe HandLandmarker passes confidence gating. The Pose tab shows hands 0/2, renders hand bones in 2D/3D, and exposes left/right hand visibility toggles in Tools / Markers.',
      'Multi-rig workspaces are session-scoped. Use openRigWorkspace/setActiveRig/closeRigWorkspace/reorderOpenRigWorkspaces to manage Pose tab rig tabs; closing a workspace never deletes the Rig row or image assets.',
      'Identity profiles store a 512x512 content-hash face reference under images/identity plus deterministic face-70 measurements and replay bridge metadata. Workflow replay can inject a selected profile into CastKitCodexBridge identity inputs when the workflow exposes them.',
      'CKC starts a localhost-only intake endpoint for ComfyUI bridge payloads. automationGetState reports the bound intakePort and whether a token is required.',
      'Prompt and story-beat CRUD is live now and scoped by character when characterId is provided.',
    ],
  },
  {
    id: 'docs-stories-moodboards',
    title: 'Notes, stories, moodboards, links, and creative planning',
    wp: [
      'WP-0005',
      'WP-0015',
      'WP-0048',
      'WP-0049',
      'WP-0050',
      'WP-0051',
      'WP-0052',
      'WP-0053',
      'WP-0054',
      'WP-0062',
      'WP-0071',
      'WP-0074',
      'WP-0075',
      'WP-0076',
      'WP-0077',
      'WP-0078',
      'WP-0079',
      'WP-0080',
      'WP-0081',
      'WP-0082',
      'WP-0083',
    ],
    summary:
      'Docs mode provides DB-first notes/stories/moodboards, backlinks, corkboard/outliner, vector moodboard tools, layers/folders, export options, and global search. globalSearch is wired through the automation channel; the per-doc CRUD commands remain preload-only today.',
    commands: ['globalSearch'],
    roadmap: [
      'listDocs (preload-only today)',
      'getDoc (preload-only today)',
      'upsertDoc (preload-only today)',
      'deleteDoc (preload-only today)',
      'resolveLinkToken (preload-only today)',
      'listBacklinks (preload-only today)',
    ],
    notes: [
      'Docs mode is intentionally part of the character workflow and should not force the user out of image viewing.',
      'Moodboard content is structured JSON; preserve user text inside layers.',
      'PostgreSQL global search uses fallback ILIKE search unless a richer PG search index is added later.',
    ],
  },
  {
    id: 'exports-backup-release',
    title: 'Exports, packs, release builds, and backup/restore',
    wp: ['WP-0006', 'WP-0017', 'WP-0027', 'WP-0034', 'WP-0036', 'WP-0063', 'WP-0073', 'WP-0086', 'WP-0087'],
    summary:
      'CKC exports field packs, templates, image sets, moodboards, share packs, backup snapshots, static web portfolios, and release artifacts outside the source tree. Automation can navigate to the Export hub but cannot trigger exports through automationRunCommand today.',
    commands: ['openExports'],
    roadmap: [
      'exportEmptyTemplate (preload-only today)',
      'exportTemplateFieldPack (preload-only today)',
      'exportImageSet (preload-only today)',
      'exportSharePack (preload-only today)',
      'exportWebPortfolio (preload-only today)',
      'startLibraryBackup (preload-only today)',
    ],
    notes: [
      'Build artifacts belong under CKC_GOV/targets and must not be committed.',
      'Release builds are tagged SemVer assets.',
      'PostgreSQL dump/restore must be paired with filesystem backup for full recovery.',
    ],
  },
  {
    id: 'relationships-collections-reference',
    title: 'Collections, relationships, reference windows, command palette',
    wp: ['WP-0060', 'WP-0068', 'WP-0069', 'WP-0070', 'WP-0072', 'WP-0090'],
    summary:
      'CKC supports pop-out reference windows, opacity/click-through modes, collections/playlists, character relations, command palette actions, and batch character operations. None of these are wired into the automation channel today.',
    commands: [],
    roadmap: [
      'openReferenceWindow (preload-only today)',
      'setReferenceWindowOptions (preload-only today)',
      'listCollections (preload-only today)',
      'createCollection (preload-only today)',
      'listCharacterRelations (preload-only today)',
      'createCharacterRelation (preload-only today)',
      'batchUpdateCharacterField (preload-only today)',
      'batchUpdateCharacterTags (preload-only today)',
    ],
    notes: [
      'Reference windows are separate renderer windows; automation capture should still use explicit capture APIs.',
      'Batch operations route through backend validation.',
    ],
  },
  {
    id: 'automation-synthetic-input',
    title: 'Window-scoped synthetic input (debugging)',
    wp: ['WP-0099'],
    summary:
      'Synthetic keyboard, mouse, click, and text input targeted only at the CKC main BrowserWindow. Routed exclusively through Electron mainWindow.webContents.sendInputEvent and renderer-side DOM dispatchEvent — never through OS-level input APIs. Use this for UI-only flows that have no backend path, reproducing UI bugs, visual debugging of renderer interactions, and end-to-end smokes. For routine character data work prefer the deterministic backend commands (saveCharacter, setImagesMetaBatch).',
    commands: ['injectKey', 'injectMouse', 'clickElement', 'typeText'],
    notes: [
      'Acquire the renderer-input lease before issuing synthetic input.',
      'No OS keyboard/mouse libraries (robotjs, nut.js, node-key-sender, AutoHotkey, Windows SendInput) are used or allowed; a CI test pins this.',
      'In background mode (CKC_AUTOMATION_BACKGROUND=1) injection succeeds against the hidden offscreen renderer without un-hiding or focusing the window.',
      'typeText uses the native value setter on input/textarea so React onChange handlers run; for contenteditable it sets innerText and dispatches input.',
    ],
  },
  {
    id: 'automation-control-plane',
    title: 'LLM session, lease, and capture control plane',
    wp: ['WP-0093', 'WP-0095', 'WP-0099'],
    summary:
      'Multi-agent LLM sessions, leases, command logs, and non-focus-stealing screenshot captures. These are the primitives every automation flow depends on.',
    commands: [
      'automationCreateSession',
      'automationHeartbeat',
      'automationEndSession',
      'automationListSessions',
      'automationAcquireLease',
      'automationReleaseLease',
      'automationListLog',
      'automationRunCommand',
      'automationCapture',
      'automationCaptureToFile',
      'automationSetRendererState',
    ],
    notes: [
      'Acquire renderer-navigation before navigation commands; renderer-input before synthetic-input commands.',
      'automationCaptureToFile writes a PNG + JSON sidecar without foregrounding the window.',
      'Always end the session when finished so leases and logs close out cleanly.',
    ],
  },
  {
    id: 'local-models-and-ai',
    title: 'Local model and AI-assisted workflows',
    wp: ['WP-0039', 'WP-0041', 'WP-0084'],
    summary:
      'CKC remains provider-agnostic while supporting OpenAI-compatible local model calls and AI-assisted image tagging. The chat and tagging primitives are not wired into the automation channel today; LLMs route through automationRunCommand for app behavior and rely on their own provider for inference.',
    commands: ['automationRunCommand', 'automationCaptureToFile'],
    roadmap: [
      'llmChat (preload-only today)',
      'suggestImageTags (preload-only today)',
      'startAiTaggingJob (preload-only today)',
    ],
    notes: [
      'Core repo operation must not require a specific LLM provider.',
      'LLM agents must use explicit automation commands, not OS-level input injection.',
      'Automation must not foreground windows, steal focus, or move the operator cursor.',
    ],
  },
  {
    id: 'image-sourcing-ingestion',
    title: 'Image sourcing workflow registry, ingestion adapter, per-character scripts',
    wp: ['WP-0094', 'WP-0100'],
    summary:
      'CKC holds the canonical store of image-sourcing workflow specs (v00.19 today, future versions later) and bridges operator-managed task folders into the library. The adapter ingests accepted/pending/rejected lanes per the v00.19 contract, links each image to a character sheet AND a sheet version, dedupes across re-imports of the same character, and copies the task task_tools/scripts/ helpers into a per-character script store. Identity decoupling is enforced: imported image filenames inside libraryRoot are content-hash addressed; the character name never appears in any path or sync-event payload.',
    commands: [
      'listWorkflowSpecs',
      'getWorkflowSpec',
      'getLatestWorkflowSpec',
      'listCharacterScripts',
      'getCharacterScript',
      'addCharacterScript',
      'removeCharacterScript',
      'listIngestionBatches',
      'getIngestionBatch',
      'listIngestionRejections',
      'ingestImageSourcingTask',
    ],
    roadmap: [
      'v00.20+ handler — registers as a new module under app/backend/imageSourcingHandlers/; the adapter dispatches by spec_version from task_state.yaml.',
    ],
    notes: [
      'Workflow specs live under CKC_GOV/references/external_app_data/specs/. Operator drops new spec versions there; CKC reads on demand.',
      'Per-character scripts dedupe by (character_id, script_bytes_hash); identical bytes from multiple tasks collapse to one row.',
      'Ingestion batches preserve a verbatim snapshot of task_requirements.yaml so done-criteria are audit-recoverable.',
    ],
  },
  {
    id: 'image-intake-sorter',
    title: 'Image intake sorter',
    wp: ['WP-0094'],
    summary:
      'The sorter scans folders, classifies images as pass/reject/pending, supports folder-only moves, and linked CKC profile imports with pending metadata.',
    commands: ['openIntake', 'scanIntakeFolder', 'classifyIntakeImage', 'listPendingImages'],
    notes: [
      'Folder-only mode has no CKC notes or tags and moves originals.',
      'Linked mode preserves source files and imports accepted/pending images through existing CKC import logic.',
      'Pending linked images set review_status=pending and receive the pending tag.',
    ],
  },
];

// One entry per wired automation command. Target labels match
// classifyAutomationCommand() output. Every name here must resolve via
// classifyAutomationCommand(); the consistency test enforces this both
// directions (no missing wired commands, no aspirational ids).
const commandReference = [
  // top-level + control overlap (LLMs typically call these directly via window.ckc.*)
  {
    id: 'automationGetManual',
    target: 'top-level/control',
    description: 'Return this manual as JSON, markdown, or index.',
    example: { format: 'json' },
  },
  {
    id: 'automationCreateSession',
    target: 'top-level/control',
    description: 'Create a named background LLM session.',
    example: { agentName: 'agent-a', purpose: 'visual smoke test' },
  },
  {
    id: 'automationHeartbeat',
    target: 'top-level/control',
    description: 'Refresh session liveness and attach optional agent state.',
    example: { sessionId: 'llm_...', state: { phase: 'inspecting' } },
  },
  {
    id: 'automationEndSession',
    target: 'top-level/control',
    description: 'End an active session and release any held leases.',
    example: { sessionId: 'llm_...', reason: 'done' },
  },
  {
    id: 'automationListSessions',
    target: 'top-level/control',
    description: 'List active sessions and their leases.',
    example: {},
  },
  {
    id: 'automationAcquireLease',
    target: 'top-level/control',
    description: 'Acquire a named lease before running conflicting commands (e.g. renderer-navigation, renderer-input).',
    example: { sessionId: 'llm_...', leaseName: 'renderer-navigation', ttlMs: 30000 },
  },
  {
    id: 'automationReleaseLease',
    target: 'top-level/control',
    description: 'Release a previously acquired lease.',
    example: { sessionId: 'llm_...', leaseName: 'renderer-navigation' },
  },
  {
    id: 'automationListLog',
    target: 'top-level/control',
    description: 'Return recent control-plane log entries (sessions, leases, commands, captures).',
    example: { limit: 50 },
  },
  {
    id: 'automationCaptureToFile',
    target: 'top-level/control',
    description: 'Capture the renderer to a PNG + JSON sidecar under CKC_GOV/targets/CKC/automation_captures (dev) or libraryRoot/automation_captures (packaged) without foregrounding.',
    example: { sessionId: 'llm_...', label: 'library-start' },
  },
  // top-level only (meta-helpers; not in commandMap.control)
  {
    id: 'automationGetState',
    target: 'top-level',
    description: 'Inspect app state: config path, libraryRoot, DB provider, renderer route, diagnostics, and the full commandMap of dispatchable commands.',
    example: {},
  },
  {
    id: 'automationRunCommand',
    target: 'top-level',
    description: 'Dispatcher for renderer and backend commands. Provide target ("renderer" | "backend") and the command name.',
    example: { sessionId: 'llm_...', target: 'renderer', command: 'openLibrary', params: {} },
  },
  {
    id: 'automationCapture',
    target: 'top-level',
    description: 'Capture the renderer to in-memory PNG bytes or a data URL (no file write). Use automationCaptureToFile for persisted captures.',
    example: { format: 'dataUrl' },
  },
  {
    id: 'automationSetRendererState',
    target: 'top-level',
    description: 'Renderer-side helper to push current navigation/state into the control plane. Usually called by the renderer, but exposed for symmetry.',
    example: { route: 'character', selectedCharacterId: 'char_001' },
  },
  // renderer commands (dispatched via automationRunCommand({ target: "renderer" }))
  {
    id: 'openLibrary',
    target: 'renderer',
    description: 'Navigate to the library page.',
    example: {},
  },
  {
    id: 'openCharacter',
    target: 'renderer',
    description: 'Open a character sheet by id.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'openExports',
    target: 'renderer',
    description: 'Open the Export hub. Returns the LLM to the prior page on close.',
    example: {},
  },
  {
    id: 'openIntake',
    target: 'renderer',
    description: 'Open the image intake sorter page.',
    example: {},
  },
  {
    id: 'openPose',
    target: 'renderer',
    description: 'Open the Pose tab for character image and rig work. Optional characterId/imageId selects the working context.',
    example: { characterId: 'char_001', imageId: 'img_001' },
  },
  {
    id: 'openWorkflow',
    target: 'renderer',
    description: 'Open the Workflow tab for prompt, story-beat, rig, and replay context. Optional characterId selects the working context.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'selectImage',
    target: 'renderer',
    description: 'Select an image inside the active character page.',
    example: { imageId: 'img_001', characterId: 'char_001' },
  },
  {
    id: 'openGlobalSearch',
    target: 'renderer',
    description: 'Open the global search overlay (Ctrl+Shift+F equivalent).',
    example: {},
  },
  {
    id: 'toggleMenu',
    target: 'renderer',
    description: 'Toggle the menu drawer.',
    example: {},
  },
  {
    id: 'closeOverlays',
    target: 'renderer',
    description: 'Close any open drawers, command palette, or global search overlay.',
    example: {},
  },
  {
    id: 'getRendererState',
    target: 'renderer',
    description: 'Return a small read-only snapshot: route, selected character/image ids, drawer mode, overlay flags.',
    example: {},
  },
  {
    id: 'getRendererUIState',
    target: 'renderer',
    description: 'Return a richer read-only snapshot of App-level renderer state: route, init status, selection ids, drawer/overlay flags, exports context, pending doc/focus/tag-filter intents. Sheet field values are not yet included; for stored character data call backend getCharacter.',
    example: {},
  },
  {
    id: 'injectKey',
    target: 'renderer',
    description: 'Synthetic keyboard event into the CKC main BrowserWindow only, routed through webContents.sendInputEvent. type is keyDown | keyUp | char. modifiers is a subset of shift/control/alt/meta. No OS-level input API is used.',
    example: { type: 'char', keyCode: 'a', modifiers: [] },
  },
  {
    id: 'injectMouse',
    target: 'renderer',
    description: 'Synthetic mouse event into the CKC main BrowserWindow only, routed through webContents.sendInputEvent. type is one of mouseDown/mouseUp/mouseMove/mouseEnter/mouseLeave/contextMenu. button is left/right/middle.',
    example: { type: 'mouseMove', x: 200, y: 150, button: 'left' },
  },
  {
    id: 'clickElement',
    target: 'renderer',
    description: 'Click the first DOM element matching selector. Renderer-side; does not move the OS cursor. WP-0103: dispatches the full click sequence (pointerdown → mousedown → focus → pointerup → mouseup → click) so React 19 controlled buttons fire their onClick handlers reliably (a single MouseEvent often did not). Strictly window-scoped; no OS input.',
    example: { selector: 'button[data-action="save"]' },
  },
  {
    id: 'typeText',
    target: 'renderer',
    description: 'Set text on an input/textarea/contenteditable using the native value setter so React onChange handlers fire. Pass selector or omit to target document.activeElement.',
    example: { selector: 'input[name="display_name"]', text: 'Aria' },
  },
  // backend commands (dispatched via automationRunCommand({ target: "backend" }))
  {
    id: 'listCharacters',
    target: 'backend',
    description: 'List characters with optional filtering and pagination.',
    example: { limit: 50 },
  },
  {
    id: 'getCharacter',
    target: 'backend',
    description: 'Return a single character (sheet + image refs) by id. Returns { id, publicId, displayName, templateId, valuesById: { [fieldId]: string }, tags: [...], images: [{ id, ...meta }], ... }. Note: image objects expose `id` (not `imageId`) — pass that field as `imageId` to setImageMeta / setImagesMetaBatch / setCharacterIcon. Block-list and single-block field values inside `valuesById` are JSON-serialized (array of objects for `block_list`, single object for `block`); empty list is `\'\'` not `\'[]\'`.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'listGlobalCarouselImages',
    target: 'backend',
    description: 'List images flagged as carousel/frontpage across the library.',
    example: {},
  },
  {
    id: 'listPendingImages',
    target: 'backend',
    description: 'List images in pending review (review_status=pending).',
    example: {},
  },
  {
    id: 'importImages',
    target: 'backend',
    description: 'Import image files into the library (assign to a character or to the inbox).',
    example: { paths: ['C:/in/a.png'], characterId: 'char_001' },
  },
  {
    id: 'setImageMeta',
    target: 'backend',
    description: 'Patch image metadata (rating, favorite, notes, tags, etc.).',
    example: { imageId: 'img_001', field: 'rating', value: 4 },
  },
  {
    id: 'scanIntakeFolder',
    target: 'backend',
    description: 'Scan a folder for intake images and return planned status paths.',
    example: { sourceDir: 'C:/intake_batch' },
  },
  {
    id: 'classifyIntakeImage',
    target: 'backend',
    description: 'Classify an intake image in folder-only or linked CKC profile mode.',
    example: { sourcePath: 'C:/intake_batch/a.png', status: 'pending', mode: 'linked', characterId: 'char_001' },
  },
  {
    id: 'resetPreferences',
    target: 'backend',
    description: 'Queue a Light reset from inside CKC: delete ckc-config.json plus Electron preference/storage files. Content rows, library files, and image bytes are preserved. Restart is required.',
    example: {},
  },
  {
    id: 'requestFullReset',
    target: 'backend',
    description: 'Queue a Full reset from inside CKC by writing .ckc-pending-full-reset, clearing preferences, and preserving the active library root for next launch. Startup writes an orphan manifest, truncates content tables, and keeps image bytes.',
    example: {},
  },
  {
    id: 'listOrphanManifests',
    target: 'backend',
    description: 'List orphan image manifests under libraryRoot/orphans, newest first. Use before adoptOrphanImages after a Full reset.',
    example: { limit: 10 },
  },
  {
    id: 'adoptOrphanImages',
    target: 'backend',
    description: 'Recover images from an orphan manifest into an existing character, or pass targetCharacterId="__new__" to create placeholder characters by prior display name. Re-hashes bytes and skips duplicates.',
    example: { manifestPath: 'C:/CastKit-Codex-Library/orphans/2026-05-07_120000/manifest.json', targetCharacterId: '__new__' },
  },
  // WP-0100: workflow spec registry (read-only, fs-backed)
  {
    id: 'listWorkflowSpecs',
    target: 'backend',
    description: 'List every workflow spec under CKC_GOV/references/external_app_data/specs/. Returns specId, specVersion, specStatus, fileName, filePath per spec, sorted by specId then version.',
    example: {},
  },
  {
    id: 'getWorkflowSpec',
    target: 'backend',
    description: 'Return the parsed JSON content of a specific workflow spec by id and version.',
    example: { specId: 'idol_image_sourcing_init_spec', version: 'v00.19' },
  },
  {
    id: 'getLatestWorkflowSpec',
    target: 'backend',
    description: 'Return the highest-version workflow spec for a given specId (parses version tokens like v00.19 numerically).',
    example: { specId: 'idol_image_sourcing_init_spec' },
  },
  // WP-0100: per-character image-sourcing scripts
  {
    id: 'listCharacterScripts',
    target: 'backend',
    description: 'List image-sourcing helper scripts attached to a character (collectors, selectors, validators).',
    example: { characterId: 'char_001' },
  },
  {
    id: 'getCharacterScript',
    target: 'backend',
    description: 'Return one character script row with decoded file content (UTF-8) when the file exists on disk.',
    example: { scriptId: 'script_abc' },
  },
  {
    id: 'addCharacterScript',
    target: 'backend',
    description: 'Attach a script to a character. Files copied to libraryRoot/characters/<id>/scripts/. Dedup by (characterId, sha256(scriptContent)) — identical bytes from multiple tasks collapse to one row.',
    example: { characterId: 'char_001', scriptName: 'collector.py', scriptContent: '...', role: 'collector', sourceTaskId: 'task_cwb_isrc_0006_01KQVAP2YN4KKNT5AABWEFQF3J' },
  },
  {
    id: 'removeCharacterScript',
    target: 'backend',
    description: 'Delete a character script row and its on-disk file.',
    example: { scriptId: 'script_abc' },
  },
  // WP-0100: ingestion audit (read-only here; writes happen inside the slice-2 adapter)
  {
    id: 'listIngestionBatches',
    target: 'backend',
    description: 'List ingestion batches (one per ingestImageSourcingTask invocation), optionally filtered by character.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'getIngestionBatch',
    target: 'backend',
    description: 'Return one ingestion batch row including the verbatim task_requirements.yaml snapshot captured at ingest time.',
    example: { batchId: 'batch_abc' },
  },
  {
    id: 'listIngestionRejections',
    target: 'backend',
    description: 'List rejected items ingested as audit-only rows from a v00.19 task rejected lane.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'ingestImageSourcingTask',
    target: 'backend',
    description: 'Ingest one v00.19 image-sourcing task into CKC. Reads task_state.yaml + task_topology.yaml + task_requirements.yaml, walks intake/<lane>/, imports each image with full provenance (dataset_id, task_id, run_id, contact_sheet_ref, source_url, sheet_version_id), enforces identity-decoupling (content-hash filenames), dedupes across batches (content-hash, selection, url), copies task_tools/scripts/ into the per-character script store, writes one v00.19-shaped JSONL line per image to app/<task_id>.app_sync_events.jsonl, and records an IngestionBatch row. Pending lane sets review_status=pending and the pending tag (WP-0094 intake sorter convention). Rejected lane writes IngestionRejection audit rows only. Honors run_state_lock.json. sheetVersionId is required; spec_version must match a registered handler.',
    example: {
      taskRootPath: 'D:/Projects/Image_sourcing/lora_avatar_test_0006/task_cwb_isrc_0006_01KQVAP2YN4KKNT5AABWEFQF3J',
      characterId: 'char_abc',
      sheetVersionId: 'ver_001',
      lane: 'accepted',
      dryRun: false,
      copyScripts: true,
      dedupReasons: ['content-hash', 'selection', 'url'],
    },
  },
  {
    id: 'createCharacter',
    target: 'backend',
    description: 'Create a new character (optionally from a template). Returns the new character id.',
    example: { templateId: 'tpl_default', publicId: null, displayName: 'New Character' },
  },
  {
    id: 'saveCharacter',
    target: 'backend',
    description: 'Persist character sheet field values. Template integrity is enforced (no Field ID drops, no reordering, no silent rewrites). Optional validationMode and allowSaveWithErrors override the app config defaults.',
    example: { characterId: 'char_001', valuesById: { name: 'Aria', height_cm: '170' } },
  },
  {
    id: 'softDeleteCharacters',
    target: 'backend',
    description: 'Move characters to Trash (recoverable). Pass an array of character ids.',
    example: { characterIds: ['char_001'] },
  },
  {
    id: 'restoreCharacters',
    target: 'backend',
    description: 'Restore previously soft-deleted characters from Trash.',
    example: { characterIds: ['char_001'] },
  },
  {
    id: 'listTemplates',
    target: 'backend',
    description: 'List installed character templates (id, name, version).',
    example: {},
  },
  {
    id: 'setImagesMetaBatch',
    target: 'backend',
    description: 'Apply metadata patches to many images in one call (rating, favorite, notes, tag add/remove).',
    example: { imageIds: ['img_001', 'img_002'], patch: { addTags: ['hero'], rating: 4 } },
  },
  {
    id: 'listAllTags',
    target: 'backend',
    description: 'List every tag known to the library with counts.',
    example: {},
  },
  {
    id: 'globalSearch',
    target: 'backend',
    description: 'Search across characters, docs, moodboards, and image metadata. Returns hits with snippets.',
    example: { query: 'red dress', limit: 50 },
  },
  {
    id: 'listRigs',
    target: 'backend',
    description: 'List rig rows, optionally scoped to one character. Returns parsed pose/calibration objects and their raw JSON strings.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'getRig',
    target: 'backend',
    description: 'Return one rig by rigId, including character id, portrait image id, status, pose JSON, and calibration JSON.',
    example: { rigId: 'rig_abc' },
  },
  {
    id: 'createRig',
    target: 'backend',
    description: 'Create a rig attached to a character image. The image must belong to the character. Empty pose/calibration JSON is created when omitted.',
    example: { characterId: 'char_001', portraitImageId: 'img_001', label: 'front rig' },
  },
  {
    id: 'updateRigCalibration',
    target: 'backend',
    description: 'Replace a rig calibration JSON object/string and bump updated_at.',
    example: { rigId: 'rig_abc', calibrationJson: { schemaVersion: 1, headPose: { order: 'YXZ', yaw: 0, pitch: 0, roll: 0, quaternion: [0, 0, 0, 1] } } },
  },
  {
    id: 'setRigHeadPose',
    target: 'backend',
    description: 'Persist yaw/pitch/roll head pose on a rig calibration record. CKC normalizes to intrinsic YXZ order and stores a quaternion plus the UI-degree angles.',
    example: { rigId: 'rig_abc', headPose: { order: 'YXZ', yaw: 15, pitch: -10, roll: 8, quaternion: [0.085832, 0.136671, 0.057006, 0.98522] } },
  },
  {
    id: 'setRigPortrait',
    target: 'backend',
    description: 'Point a rig at a different portrait image owned by the same character.',
    example: { rigId: 'rig_abc', portraitImageId: 'img_002' },
  },
  {
    id: 'updateRigPose',
    target: 'backend',
    description: 'Replace a rig pose JSON object/string after detector or calibration work and mirror it onto the portrait image row.',
    example: { rigId: 'rig_abc', poseJson: { schemaVersion: 1, subsystem: 'posekit', body: [] }, status: 'ready' },
  },
  {
    id: 'exportOpenposePng',
    target: 'backend',
    description: 'Persist a renderer-produced openpose PNG data URL/base64 payload under the character folder using a content-hash filename and link it to the rig.',
    example: { rigId: 'rig_abc', pngBase64: 'data:image/png;base64,...', width: 1024, height: 1024 },
  },
  {
    id: 'listOpenRigs',
    target: 'backend',
    description: 'List session-scoped open Pose rig workspaces, optionally filtered to one character. Returns activeRigId plus ordered tab rows; no database rows are created.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'openRigWorkspace',
    target: 'backend',
    description: 'Open a rig in the session workspace tab list and activate it by default. Durable rig data stays in the Rig table; this command only updates running-session workspace state.',
    example: { rigId: 'rig_abc' },
  },
  {
    id: 'setActiveRig',
    target: 'backend',
    description: 'Activate a rig workspace. If the rig exists but is not already open, CKC opens it first.',
    example: { rigId: 'rig_abc' },
  },
  {
    id: 'closeRigWorkspace',
    target: 'backend',
    description: 'Close a rig workspace tab without deleting the Rig row, portrait image, openpose export, or workflow history.',
    example: { rigId: 'rig_abc' },
  },
  {
    id: 'reorderOpenRigWorkspaces',
    target: 'backend',
    description: 'Reorder currently-open rig workspace tabs. The provided rigIds must already be open; omitted open tabs are appended after the requested order.',
    example: { rigIds: ['rig_b', 'rig_a'] },
  },
  {
    id: 'listIdentityProfiles',
    target: 'backend',
    description: 'List non-deleted identity profiles, optionally scoped to one character. Profiles include the cropped face ImageAsset id, manifest path, feature measurements, and replay bridge payload.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'getIdentityProfile',
    target: 'backend',
    description: 'Return one identity profile by profileId. Pass includeDeleted=true only for audit/recovery reads.',
    example: { profileId: 'idp_abc' },
  },
  {
    id: 'createIdentityProfile',
    target: 'backend',
    description: 'Create an identity profile from a rigged portrait. CKC reads the source rig face landmarks, writes a deterministic 512x512 PNG under images/identity, stores measurements, and creates a manifest sidecar under identity_profiles/.',
    example: { characterId: 'char_001', sourceImageId: 'img_001', sourceRigId: 'rig_abc', name: 'identity_1' },
  },
  {
    id: 'updateIdentityProfile',
    target: 'backend',
    description: 'Update identity profile metadata only. The locked crop, landmarks, and measurements are not rewritten.',
    example: { profileId: 'idp_abc', name: 'front_identity_v2', description: 'front lit reference' },
  },
  {
    id: 'deleteIdentityProfile',
    target: 'backend',
    description: 'Soft-delete an identity profile. The cropped face image remains on disk and the ImageAsset row is not deleted.',
    example: { profileId: 'idp_abc' },
  },
  {
    id: 'registerComfyUIOutput',
    target: 'backend',
    description: 'Register one ComfyUI bridge payload: decode image bytes, store the image under the target character, and attach workflow/metadata/prompt lineage.',
    example: { schema: 'ckc.intake.comfyui_output@1', character_id: 'char_001', image_b64: '...', workflow_json: {}, metadata: {} },
  },
  {
    id: 'getWorkflowHistory',
    target: 'backend',
    description: 'List images with stored ComfyUI workflow JSON, optionally scoped to one character.',
    example: { characterId: 'char_001', limit: 25 },
  },
  {
    id: 'extractPromptFromWorkflow',
    target: 'backend',
    description: 'Walk a ComfyUI workflow JSON object/string and return likely positive prompts, negative prompts, and LoRA names.',
    example: { workflowJson: { 1: { class_type: 'CLIPTextEncode', inputs: { text: 'portrait' } } } },
  },
  {
    id: 'replayWorkflow',
    target: 'backend',
    description: 'Submit workflow JSON to ComfyUI /prompt. When identityProfileId is supplied, CKC injects identity_profile_id/ref/image fields into CastKitCodexBridge nodes that expose those inputs. When waitForCompletion is true, CKC polls /history, fetches /view image outputs, and registers them under the target character as a fallback for workflows that use SaveImage instead of the CKC bridge node.',
    example: { host: 'http://127.0.0.1:8188', workflowJson: {}, characterId: 'char_001', rigId: 'rig_abc', identityProfileId: 'idp_abc', waitForCompletion: true },
  },
  {
    id: 'getComfyUIStats',
    target: 'backend',
    description: 'Call ComfyUI /system_stats on the configured or supplied host.',
    example: { host: 'http://127.0.0.1:8188' },
  },
  {
    id: 'listPrompts',
    target: 'backend',
    description: 'List prompt rows, optionally scoped by characterId and kind. Character-scoped lists include global prompts.',
    example: { characterId: 'char_001', kind: 'positive' },
  },
  {
    id: 'upsertPrompt',
    target: 'backend',
    description: 'Create or update a prompt with optional character scope, kind, title, text, and tags.',
    example: { characterId: 'char_001', kind: 'positive', title: 'portrait', text: 'clean studio portrait', tags: ['studio'] },
  },
  {
    id: 'deletePrompt',
    target: 'backend',
    description: 'Delete a prompt by promptId.',
    example: { promptId: 'prompt_abc' },
  },
  {
    id: 'listStoryBeats',
    target: 'backend',
    description: 'List story-beat rows, optionally scoped to one character. Character-scoped lists include global beats.',
    example: { characterId: 'char_001' },
  },
  {
    id: 'upsertStoryBeat',
    target: 'backend',
    description: 'Create or update a story beat with title, body, linked prompt ids, and order index.',
    example: { characterId: 'char_001', title: 'Arrival', body: 'Opening image beat', promptIds: ['prompt_abc'], orderIndex: 0 },
  },
  {
    id: 'deleteStoryBeat',
    target: 'backend',
    description: 'Delete a story beat by beatId.',
    example: { beatId: 'beat_abc' },
  },
];

function getManualIndex() {
  return featureGroups.map((group) => ({
    id: group.id,
    title: group.title,
    wp: group.wp,
    commands: group.commands,
    roadmap: group.roadmap || [],
  }));
}

function getManualJson() {
  return {
    ok: true,
    manualVersion: MANUAL_VERSION,
    title: 'CastKit Codex internal LLM/operator manual',
    safety: {
      noOsInputInjection: true,
      noFocusStealing: true,
      noCursorHijack: true,
      backgroundCaptureOnly: true,
      providerAgnostic: true,
      liveVerificationRequired: true,
    },
    operatingContract: {
      liveVerification:
        'When testing, verifying, or demonstrating any CKC feature/fix/change/workflow, drive the running app through this automation surface. Never certify behavior from code-reading or test runs alone. Use automationRunCommand for renderer/backend actions, getRendererUIState for state inspection, and automationCaptureToFile for visual evidence. This binds every CKC surface — sheet editor, library, character creation, image import, tagging, exports, moodboards, intake sorter, docs mode, reference window, command palette, and every future addition. If a surface lacks an automation hook for what you need, file the gap in roadmap rather than skipping verification.',
      gapPolicy:
        'If you cannot drive a surface through the wired commands today, name it as a roadmap entry on the relevant feature group and surface the constraint to the operator. Do not silently certify.',
    },
    quickStart: [
      'Create a session with automationCreateSession.',
      'Fetch automationGetState and automationGetManual before acting.',
      'Acquire a lease such as renderer-navigation before navigation-heavy work.',
      'Use automationRunCommand for renderer/backend actions.',
      'Use automationCaptureToFile for visual debugging screenshots.',
      'When testing or verifying behavior: drive the running app through this surface. Code-reading and unit-test passes are NOT a substitute for live verification (binding).',
      'Heartbeat during long tasks and end the session when finished.',
    ],
    index: getManualIndex(),
    featureGroups,
    commandReference,
    wiredAutomationCommands: getAllWiredAutomationCommands(),
    commandMap: getAutomationCommandMap(),
    topLevelIpc: TOP_LEVEL_AUTOMATION_IPC.slice(),
  };
}

function manualToMarkdown(manual = getManualJson()) {
  const lines = [];
  lines.push(`# ${manual.title}`);
  lines.push('');
  lines.push(`Manual version: ${manual.manualVersion}`);
  lines.push('');
  lines.push('## Safety contract');
  lines.push('- Use explicit CKC automation commands only.');
  lines.push('- Do not inject OS keyboard input.');
  lines.push('- Do not move or hijack the cursor.');
  lines.push('- Do not foreground windows for capture; use background capture APIs.');
  lines.push('- Keep provider-specific LLM behavior outside core app assumptions.');
  lines.push('');
  lines.push('## Live verification (binding)');
  lines.push('Drive the running app through this automation surface whenever testing, verifying, or demonstrating any CKC feature, fix, change, or workflow. Code-reading and test-suite passes are not a substitute for live verification.');
  lines.push('');
  lines.push('- Use `automationRunCommand` for renderer/backend actions and `getRendererUIState` for state inspection.');
  lines.push('- Use `automationCaptureToFile` for visual evidence; inspect the resulting PNG before claiming a UI is correct.');
  lines.push('- This rule binds every CKC surface: sheet editor, library, character creation, image import, tagging, exports, moodboards, intake sorter, docs mode, reference window, command palette, and every future addition.');
  lines.push('- If a surface lacks an automation hook for what you need to verify, file the gap as a roadmap entry on the relevant feature group rather than skipping verification.');
  lines.push('');
  lines.push('## Quick start');
  for (const item of manual.quickStart) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## Feature index');
  for (const group of manual.featureGroups) {
    lines.push(`### ${group.title}`);
    lines.push('');
    lines.push(`Feature ID: \`${group.id}\``);
    lines.push(`Work packets: ${group.wp.map((x) => `\`${x}\``).join(', ')}`);
    lines.push('');
    lines.push(group.summary);
    lines.push('');
    if (group.commands.length) {
      lines.push(`Wired commands: ${group.commands.map((x) => `\`${x}\``).join(', ')}`);
    } else {
      lines.push('Wired commands: (none in the automation channel today)');
    }
    if (group.roadmap && group.roadmap.length) {
      lines.push('');
      lines.push('Roadmap (not yet wired):');
      for (const item of group.roadmap) lines.push(`- ${item}`);
    }
    lines.push('');
    for (const note of group.notes) lines.push(`- ${note}`);
    lines.push('');
  }
  lines.push('## Command reference');
  for (const cmd of manual.commandReference) {
    lines.push(`### ${cmd.id}`);
    lines.push('');
    lines.push(`Target: \`${cmd.target}\``);
    lines.push('');
    lines.push(cmd.description);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(cmd.example, null, 2));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

function getAutomationManual({ format = 'json' } = {}) {
  const f = String(format || 'json').trim().toLowerCase();
  const manual = getManualJson();
  if (f === 'index') return { ok: true, manualVersion: MANUAL_VERSION, index: manual.index };
  if (f === 'markdown' || f === 'md') return { ok: true, manualVersion: MANUAL_VERSION, markdown: manualToMarkdown(manual) };
  return manual;
}

module.exports = {
  MANUAL_VERSION,
  getAutomationManual,
  getManualJson,
  manualToMarkdown,
  // exposed for the consistency test
  featureGroups,
  commandReference,
};

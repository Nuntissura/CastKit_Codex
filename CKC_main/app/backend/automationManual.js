const MANUAL_VERSION = '2026-05-04.wp-0095';

const featureGroups = [
  {
    id: 'storage-and-governance',
    title: 'Storage, governance, and operating model',
    wp: ['WP-0001', 'WP-0008', 'WP-0009', 'WP-0020', 'WP-0021', 'WP-0091', 'WP-0092'],
    summary:
      'CKC is governed from CKC_GOV and product code lives in CKC_main. PostgreSQL is the current/default database provider; libraryRoot still holds images, exports, templates, and per-character files.',
    commands: ['automationGetState', 'automationGetManual', 'postgres_up.ps1', 'postgres_dump.ps1', 'postgres_restore.ps1'],
    notes: [
      'Do not mirror governance into CKC_main/docs.',
      'Do not introduce spaces in generated file or folder names.',
      'Use PostgreSQL dumps for database backup; filesystem mirror alone is not a database backup.',
    ],
  },
  {
    id: 'library-and-character-navigation',
    title: 'Library, portfolio viewer, character sheets',
    wp: ['WP-0003', 'WP-0012', 'WP-0029', 'WP-0030', 'WP-0031', 'WP-0032', 'WP-0033', 'WP-0037', 'WP-0046'],
    summary:
      'The main UI is a 2-panel portfolio viewer with images and sheet side-by-side. Character IDs are system-managed public IDs while internal IDs remain stable folder/DB keys.',
    commands: ['openLibrary', 'openCharacter', 'getCharacter', 'listCharacters', 'selectImage'],
    notes: [
      'The sheet editor preserves template field order and user-entered text.',
      'Use explicit characterId values for automation; never drive navigation through mouse clicks.',
      'Resizable layouts are persisted in app config.',
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
      'findSimilarImages',
      'scanInbox',
      'importFromUrl',
      'importClipboardImage',
    ],
    notes: [
      'Rating hotkeys are UI-only; automation should call metadata commands.',
      'Carousel/frontpage are represented as image tags.',
      'Linked intake mode copies source files; folder-only intake moves source files into status folders.',
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
      'Docs mode provides DB-first notes/stories/moodboards, backlinks, corkboard/outliner, vector moodboard tools, layers/folders, export options, and global search.',
    commands: ['listDocs', 'getDoc', 'upsertDoc', 'deleteDoc', 'globalSearch', 'resolveLinkToken', 'listBacklinks'],
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
      'CKC exports field packs, templates, image sets, moodboards, share packs, backup snapshots, static web portfolios, and release artifacts outside the source tree.',
    commands: ['exportEmptyTemplate', 'exportTemplateFieldPack', 'exportImageSet', 'exportSharePack', 'exportWebPortfolio', 'startLibraryBackup'],
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
      'CKC supports pop-out reference windows, opacity/click-through modes, collections/playlists, character relations, command palette actions, and batch character operations.',
    commands: [
      'openReferenceWindow',
      'setReferenceWindowOptions',
      'listCollections',
      'createCollection',
      'listCharacterRelations',
      'createCharacterRelation',
      'batchUpdateCharacterField',
      'batchUpdateCharacterTags',
    ],
    notes: [
      'Reference windows are separate renderer windows; automation capture should still use explicit capture APIs.',
      'Batch operations route through backend validation.',
    ],
  },
  {
    id: 'local-models-and-ai',
    title: 'Local model and AI-assisted workflows',
    wp: ['WP-0039', 'WP-0041', 'WP-0084', 'WP-0093', 'WP-0095'],
    summary:
      'CKC remains provider-agnostic while supporting OpenAI-compatible local model calls, AI-assisted image tagging, and background-safe LLM app automation.',
    commands: ['llmChat', 'suggestImageTags', 'startAiTaggingJob', 'automationRunCommand', 'automationCaptureToFile'],
    notes: [
      'Core repo operation must not require a specific LLM provider.',
      'LLM agents must use explicit automation commands, not OS-level input injection.',
      'Automation must not foreground windows, steal focus, or move the operator cursor.',
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

const commandReference = [
  {
    id: 'automationGetManual',
    target: 'main',
    description: 'Return this manual as JSON, markdown, or index.',
    example: { format: 'json' },
  },
  {
    id: 'automationCreateSession',
    target: 'main',
    description: 'Create a named background LLM session.',
    example: { agentName: 'agent-a', purpose: 'visual smoke test' },
  },
  {
    id: 'automationHeartbeat',
    target: 'main',
    description: 'Refresh session liveness and attach optional agent state.',
    example: { sessionId: 'llm_...', state: { phase: 'inspecting' } },
  },
  {
    id: 'automationAcquireLease',
    target: 'main',
    description: 'Acquire a named lease before running conflicting commands.',
    example: { sessionId: 'llm_...', leaseName: 'renderer-navigation', ttlMs: 30000 },
  },
  {
    id: 'automationRunCommand',
    target: 'main',
    description: 'Run a renderer or backend command without OS input.',
    example: { sessionId: 'llm_...', target: 'renderer', command: 'openLibrary', params: {} },
  },
  {
    id: 'automationCaptureToFile',
    target: 'main',
    description: 'Capture the current app renderer to a PNG under CKC_GOV/targets without foregrounding the window.',
    example: { sessionId: 'llm_...', label: 'library-start' },
  },
  {
    id: 'scanIntakeFolder',
    target: 'backend',
    description: 'Scan a folder for intake images and planned status paths.',
    example: { sourceDir: 'C:\\intake_batch' },
  },
  {
    id: 'classifyIntakeImage',
    target: 'backend',
    description: 'Classify an intake image in folder-only or linked CKC profile mode.',
    example: { sourcePath: 'C:\\intake_batch\\a.png', status: 'pending', mode: 'linked', characterId: 'char_...' },
  },
];

function getManualIndex() {
  return featureGroups.map((group) => ({
    id: group.id,
    title: group.title,
    wp: group.wp,
    commands: group.commands,
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
    },
    quickStart: [
      'Create a session with automationCreateSession.',
      'Fetch automationGetState and automationGetManual before acting.',
      'Acquire a lease such as renderer-navigation before navigation-heavy work.',
      'Use automationRunCommand for renderer/backend actions.',
      'Use automationCaptureToFile for visual debugging screenshots.',
      'Heartbeat during long tasks and end the session when finished.',
    ],
    index: getManualIndex(),
    featureGroups,
    commandReference,
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
    lines.push(`Commands: ${group.commands.map((x) => `\`${x}\``).join(', ')}`);
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
};

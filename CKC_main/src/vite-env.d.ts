/// <reference types="vite/client" />

type CKCCharacterListItem = {
  id: string;
  publicId: string | null;
  displayName: string;
  templateId: string;
  templateVersion: string;
  iconImageId: string | null;
  iconFocusX: number;
  iconFocusY: number;
  updatedAt: string;
  createdAt: string;
};

type CKCGlobalImage = {
  id: string;
  characterId: string;
  favorite: boolean;
  rating: number;
  notes: string;
  sourceUrl: string | null;
  sourceNote: string;
  tags: string[];
  addedAt: string;
};

type CKCInboxImage = {
  id: string;
  favorite: boolean;
  rating: number;
  notes: string;
  sourceUrl: string | null;
  sourceNote: string;
  tags: string[];
  addedAt: string;
};

type CKCLinkCandidate = {
  targetType: string;
  targetId: string;
  label: string;
  docType?: CKCDocType;
  characterId?: string;
};

type CKCBacklinkEntry = {
  sourceType: string;
  sourceId: string;
  label: string;
  rawText: string;
  createdAt: string;
};

type CKCDocType = 'notes' | 'stories' | 'moodboard';

type CKCDocListItem = {
  id: string;
  docType: CKCDocType;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type CKCDocDetail = CKCDocListItem & {
  content: string;
};

type CKCCharacter = {
  id: string;
  publicId: string | null;
  displayName: string;
  templateId: string;
  templateVersion: string;
  templateHash: string;
  iconImageId: string | null;
  iconFocusX: number;
  iconFocusY: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  valuesById: Record<string, string>;
  tags: Array<{ text: string; type: 'manual' | 'derived' }>;
  images: Array<{
    id: string;
    relativePath: string;
    fileHash: string;
    favorite: boolean;
    rating: number;
    notes: string;
    tags: string[];
    storageMode: 'copy' | 'reference';
    sourcePath: string | null;
    sourceUrl: string | null;
    sourceNote: string;
    addedAt: string;
  }>;
};

type CKCTemplateAstFieldType =
  | 'rule'
  | 'integer'
  | 'number'
  | 'paragraph'
  | 'descriptor'
  | 'score_10'
  | 'block'
  | 'block_list'
  | 'enum'
  | 'list'
  | 'string';

type CKCTemplateAstField = {
  id: string;
  label: string;
  type: CKCTemplateAstFieldType;
  optional: boolean;
  enumValues?: string[];
  blockSchemaName?: string;
  section: string;
  templateDescriptor: string;
};

type CKCTemplateAst = {
  id: string;
  version: string;
  hash: string;
  sourcePath: string | null;
  sections: Array<{
    title: string;
    fields: CKCTemplateAstField[];
  }>;
  blockSchemas: unknown[];
  unmappedLines: string[];
};

type CKCTemplateDetail = {
  id: string;
  version: string;
  hash: string;
  sourcePath: string | null;
  updatedAt: string;
  ast: CKCTemplateAst | null;
  rawText: string;
};

type CKCSpinOffFormat = 'llm_pack_strict' | 'fieldpack_with_values';

type CKCSpinOffListItem = {
  id: string;
  templateId: string;
  templateHashAtCreate: string;
  outOfDate: boolean;
  name: string;
  description: string;
  format: CKCSpinOffFormat;
  fieldCount: number;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
};

type CKCSpinOffDetail = CKCSpinOffListItem & {
  fieldIds: string[];
};

type CKCSearchScopeFlags = {
  ids?: boolean;
  labels?: boolean;
  values?: boolean;
  tags?: boolean;
  name?: boolean;
  all?: boolean;
};

type CKCSavedSearch = {
  id: string;
  name: string;
  queryText: string;
  scopeFlags: CKCSearchScopeFlags;
  tagFilters: string[];
  tagExcludeFilters: string[];
  tagMode: 'all' | 'any';
  galleryFilters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isBuiltin: boolean;
};

type CKCTagStats = {
  tag: string;
  imageCount: number;
  docCount: number;
  docNotesCount: number;
  docStoriesCount: number;
  docMoodboardCount: number;
  characterCount: number;
};

type CKCImageAnnotations = {
  version: number;
  pins: Array<{
    id: string;
    x: number;
    y: number;
    text: string;
  }>;
};

type CKCStoryBoard = {
  version: number;
  cards: Array<{
    id: string;
    text: string;
  }>;
};

type CKCConfigInfo = {
  configPath: string;
  config: unknown;
};

type CKCLibraryDiagnostics = {
  configPath: string;
  generatedAt: string;
  libraryRoot: string;
  characterCount: number;
  imageCount: number;
  originals: { present: number; missing: number };
  thumbs: { present: number; missing: number };
  missingCharacterFolders: string[];
  topMissingByCharacter: Array<{
    characterId: string;
    totalImages: number;
    missingOriginal: number;
    missingThumb: number;
    hasCharacterFolder: boolean;
  }>;
};

type CKCDuplicateImage = {
  imageId: string;
  characterId: string;
  characterName: string;
  relativePath: string;
  storageMode: 'copy' | 'reference';
  sourcePath: string | null;
  favorite: boolean;
  rating: number;
  tags: string[];
  addedAt: string;
  absPath: string;
  sizeBytes: number | null;
  isMissing: boolean;
};

type CKCDuplicateGroup = {
  fileHash: string;
  count: number;
  sizeBytes: number;
  totalCopyBytes: number;
  potentialSavingsBytes: number;
  images: CKCDuplicateImage[];
  truncated: boolean;
};

type CKCNearDuplicateImage = {
  imageId: string;
  characterId: string;
  characterName: string;
  favorite: boolean;
  rating: number;
  tags: string[];
  dhash: string;
  distance: number;
};

type CKCNearDuplicateGroup = {
  groupId: string;
  count: number;
  repHash: string;
  maxDistance: number;
  truncated: boolean;
  images: CKCNearDuplicateImage[];
};

type CKCNearDuplicateScanProgress = { phase: string; done: number; total: number };

type CKCNearDuplicateScanResult = {
  ok: true;
  cancelled?: boolean;
  threshold: number;
  totalImages?: number;
  hashedImages?: number;
  groups: CKCNearDuplicateGroup[];
};

type CKCNearDuplicateScanJobStatus = {
  ok: true;
  jobId: string;
  status: 'running' | 'done' | 'cancelled' | 'error';
  startedAt: string;
  finishedAt: string | null;
  progress: CKCNearDuplicateScanProgress | null;
  error: string | null;
  result: CKCNearDuplicateScanResult | null;
};

type CKCLibraryBackupProgress = { phase: string; done: number; total: number };

type CKCLibraryBackupResult = {
  ok: true;
  snapshotDir: string;
  manifestPath: string;
  checksumsPath: string;
  fileCount: number;
};

type CKCLibraryBackupJobStatus = {
  ok: true;
  jobId: string;
  status: 'running' | 'done' | 'cancelled' | 'error';
  startedAt: string;
  finishedAt: string | null;
  progress: CKCLibraryBackupProgress | null;
  error: string | null;
  result: CKCLibraryBackupResult | null;
};

type CKCLibraryRestoreProgress = { phase: string; done: number; total: number };

type CKCLibraryRestoreResult = {
  ok: true;
  destLibraryRoot: string;
  fileCount: number;
};

type CKCLibraryRestoreJobStatus = {
  ok: true;
  jobId: string;
  status: 'running' | 'done' | 'cancelled' | 'error';
  startedAt: string;
  finishedAt: string | null;
  progress: CKCLibraryRestoreProgress | null;
  error: string | null;
  result: CKCLibraryRestoreResult | null;
};

type CKCCollectionListItem = {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

type CKCCollectionImage = {
  id: string;
  characterId: string;
  characterName: string;
  favorite: boolean;
  rating: number;
  notes: string;
  sourceUrl?: string | null;
  sourceNote?: string;
  tags: string[];
  addedAt: string;
  sortOrder: number;
  addedToCollectionAt: string;
};

type CKCCharacterRelation = {
  id: string;
  sourceCharacterId: string;
  sourceCharacterName: string;
  targetCharacterId: string;
  targetCharacterName: string;
  relType: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type CKCRepairMissingImagesByHashResult = {
  ok: true;
  reportPath: string;
  startedAt: string;
  finishedAt: string;
  libraryRoot: string;
  scanDir: string;
  includeSubdirs: boolean;
  dryRun: boolean;
  scannedFiles: number;
  hashedFiles: number;
  hashErrors: number;
  dbImages: number;
  missingImages: number;
  plannedActions: number;
  copied: number;
  skippedExisting: number;
  copyErrors: number;
  thumbsCreated: number;
  thumbErrors: number;
  sampleActions: Array<{
    imageId: string;
    characterId: string;
    fileHash: string;
    srcPath: string;
    destPath: string;
    relativePath: string;
  }>;
};

type CKCInboxScanResult = {
  ok: true;
  scanned: number;
  imported: Array<{
    id: string;
    relativePath: string;
    fileHash: string;
    thumbRelativePath: string | null;
  }>;
  duplicates: Array<{
    srcPath: string;
    fileHash: string;
    existingCount: number;
    alreadyImportedInBatch: number;
  }>;
};

type CKCClipboardImageImportResult =
  | { ok: true; imported: CKCInboxScanResult['imported']; duplicates: CKCInboxScanResult['duplicates'] }
  | { ok: false; reason: 'no_image' };

type CKCMoveImagesResult = {
  ok: true;
  moved: Array<{ imageId: string; fromCharacterId: string; toCharacterId: string; relativePath: string }>;
  errors: Array<{ imageId: string; message: string }>;
};

type CKCDeleteImagesResult = {
  ok: true;
  deleted: string[];
  errors: Array<{ imageId: string; message: string }>;
};

type CKCValidationIssue = {
  fieldId: string;
  severity: 'error' | 'warn';
  message: string;
};

type CKCSheetChangeType = 'same' | 'blank' | 'add' | 'modify' | 'invalid';

type CKCSheetFieldChange = {
  fieldId: string;
  label: string;
  section: string;
  currentValue: string;
  proposedValue: string;
  changeType: CKCSheetChangeType;
  isProtected: boolean;
  defaultSelected: boolean;
  issues: CKCValidationIssue[];
};

type CKCSheetIngestPreviewResult = {
  targetCharacterId: string | null;
  changes: CKCSheetFieldChange[];
  unmapped: Array<{ fieldId: string; rawLine: string }>;
};

type CKCOpenTextFileResult = {
  path: string;
  text: string;
};

type CKCSheetVersionSource = 'ui_edit' | 'ingest' | 'paste_patch' | 'import';

type CKCSheetVersionListItem = {
  id: string;
  createdAt: string;
  source: CKCSheetVersionSource;
  relativePath: string;
  hash: string;
  notes: string;
};

type CKCSheetVersionDiffChange = {
  fieldId: string;
  label: string;
  section: string;
  fromValue: string;
  toValue: string;
};

type CKCSheetVersionDiffResult = {
  characterId: string;
  fromVersionId: string;
  toVersionId: string;
  changeCount: number;
  changes: CKCSheetVersionDiffChange[];
};

interface Window {
  ckc: {
    initialize: () => Promise<{ ok: true }>;
    getConfig: () => Promise<unknown>;
    getConfigInfo: () => Promise<CKCConfigInfo>;
    setConfig: (cfg: unknown) => Promise<unknown>;
    openReferenceWindow: () => Promise<{ ok: true }>;
    closeReferenceWindow: () => Promise<{ ok: true }>;
    getReferenceWindowState: () => Promise<{
      isOpen: boolean;
      imageId: string | null;
      alwaysOnTop: boolean;
      clickThrough: boolean;
      opacity: number;
    }>;
    setReferenceWindowOptions: (params: { alwaysOnTop?: boolean; clickThrough?: boolean; opacity?: number }) => Promise<{
      ok: true;
      state: { alwaysOnTop: boolean; clickThrough: boolean; opacity: number };
    }>;
    setReferenceSelection: (params: { imageId: string | null }) => Promise<{ ok: true }>;
    onReferenceSelection: (cb: (payload: { imageId: string | null }) => void) => () => void;
    onReferenceWindowState: (cb: (payload: { isOpen?: boolean; imageId?: string | null; alwaysOnTop?: boolean; clickThrough?: boolean; opacity?: number }) => void) => () => void;
    llmChat: (params: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      temperature?: number;
      maxTokens?: number;
      }) => Promise<{ ok: true; text: string }>;
      selectLibraryRoot: () => Promise<string | null>;
      getDefaultLibraryRootInfo: () => Promise<{ isPortable: boolean; portableDir: string | null; defaultLibraryRoot: string }>;
      resetLibraryRootToDefault: () => Promise<string>;
      getLibraryDiagnostics: (params?: { topN?: number } | null) => Promise<CKCLibraryDiagnostics>;
      listDuplicateGroups: (params?: { minCount?: number; limitGroups?: number; maxPerGroup?: number } | null) => Promise<CKCDuplicateGroup[]>;
      startNearDuplicateScan: (params?: { threshold?: number; maxImages?: number; maxPerGroup?: number } | null) => Promise<{ ok: true; jobId: string }>;
      getNearDuplicateScanStatus: (jobId: string) => Promise<CKCNearDuplicateScanJobStatus>;
      cancelNearDuplicateScan: (jobId: string) => Promise<{ ok: true }>;
      startLibraryBackup: (params?: { outDirBase?: string | null; backupName?: string | null } | null) => Promise<{ ok: true; jobId: string }>;
      getLibraryBackupStatus: (jobId: string) => Promise<CKCLibraryBackupJobStatus>;
      cancelLibraryBackup: (jobId: string) => Promise<{ ok: true }>;
      startLibraryRestore: (params: { backupDir: string; destLibraryRoot: string; allowOverwrite?: boolean; confirmToken?: string | null }) => Promise<{ ok: true; jobId: string }>;
      getLibraryRestoreStatus: (jobId: string) => Promise<CKCLibraryRestoreJobStatus>;
      cancelLibraryRestore: (jobId: string) => Promise<{ ok: true }>;
      listCollections: () => Promise<CKCCollectionListItem[]>;
      createCollection: (params: { name: string }) => Promise<{ ok: true; id: string; name: string }>;
      renameCollection: (params: { collectionId: string; name: string }) => Promise<{ ok: true }>;
      deleteCollection: (params: { collectionId: string }) => Promise<{ ok: true }>;
      listCollectionImages: (params: { collectionId: string }) => Promise<CKCCollectionImage[]>;
      addImagesToCollection: (params: { collectionId: string; imageIds: string[] }) => Promise<{ ok: true; inserted: number; skipped: number }>;
      removeImagesFromCollection: (params: { collectionId: string; imageIds: string[] }) => Promise<{ ok: true; removed: number }>;
      listCharacterRelations: (params: { characterId?: string | null } | null) => Promise<CKCCharacterRelation[]>;
      createCharacterRelation: (params: {
        sourceCharacterId: string;
        targetCharacterId: string;
        relType?: string;
        notes?: string;
      }) => Promise<{ ok: true; id: string }>;
      updateCharacterRelation: (params: { relationId: string; relType?: string; notes?: string }) => Promise<{ ok: true }>;
      deleteCharacterRelation: (params: { relationId: string }) => Promise<{ ok: true }>;
      listTagStats: () => Promise<CKCTagStats[]>;
      mergeTags: (params: { fromTags: string[] | string; toTag: string }) => Promise<unknown>;
      renameTag: (params: { fromTag: string; toTag: string }) => Promise<unknown>;
      listCharacters: (params?: unknown) => Promise<CKCCharacterListItem[]>;
    listAllTags: () => Promise<string[]>;
    listFieldValueSuggestions: (params?: unknown) => Promise<string[]>;
    createCharacter: (params?: unknown) => Promise<string>;
    assignPublicCharacterIds: (params?: { dryRun?: boolean } | null) => Promise<{
      ok: boolean;
      assigned: Array<{ characterId: string; publicId: string }>;
      updated?: number;
      errors?: Array<{ characterId: string; message: string }>;
    }>;
    importCharacterFromSheetDialog: () => Promise<{ characterId: string } | null>;
    getCharacter: (characterId: string) => Promise<CKCCharacter | null>;
    listGlobalCarouselImages: (params?: unknown) => Promise<CKCGlobalImage[]>;
    listInboxImages: () => Promise<CKCInboxImage[]>;
    listDocs: (params?: unknown) => Promise<CKCDocListItem[]>;
    getDoc: (params?: unknown) => Promise<CKCDocDetail | null>;
    upsertDoc: (params?: unknown) => Promise<{ ok: true; docId: string; docType: CKCDocType }>;
    deleteDoc: (params?: unknown) => Promise<{ ok: true }>;
    getStoryBoard: (params: { docId: string }) => Promise<{ ok: true; docId: string; board: CKCStoryBoard }>;
    setStoryBoard: (params: { docId: string; board: CKCStoryBoard }) => Promise<{ ok: true }>;
    resolveLinkToken: (token: string) => Promise<CKCLinkCandidate[]>;
    listBacklinks: (params: { targetType: string; targetId: string; limit?: number }) => Promise<CKCBacklinkEntry[]>;
    listSavedSearches: () => Promise<CKCSavedSearch[]>;
    createSavedSearch: (params?: unknown) => Promise<string>;
    updateSavedSearch: (params?: unknown) => Promise<{ ok: true }>;
    deleteSavedSearch: (searchId: string) => Promise<{ ok: true }>;
    getTemplate: () => Promise<CKCTemplateAst>;
    getTemplateDetail: (templateId?: string | null) => Promise<CKCTemplateDetail | null>;
    listSpinOffs: (params?: unknown) => Promise<CKCSpinOffListItem[]>;
    getSpinOff: (spinoffId: string) => Promise<CKCSpinOffDetail>;
    createSpinOff: (params?: unknown) => Promise<string>;
    updateSpinOff: (params?: unknown) => Promise<{ ok: true }>;
    deleteSpinOff: (spinoffId: string) => Promise<{ ok: true }>;
    selectFolderDialog: (opts?: unknown) => Promise<string | null>;
    openTextFileDialog: (opts?: unknown) => Promise<CKCOpenTextFileResult | null>;
    ingestPreview: (params: { characterId?: string | null; inputText: string }) => Promise<CKCSheetIngestPreviewResult>;
    ingestApply: (params: {
      characterId: string;
      selectedFieldIds: string[];
      inputText: string;
      validationMode?: string;
      allowSaveWithErrors?: boolean;
    }) => Promise<{ ok: boolean; issues?: CKCValidationIssue[] }>;
    patchPreview: (params: { characterId: string; patchText: string }) => Promise<CKCSheetIngestPreviewResult>;
    patchApply: (params: {
      characterId: string;
      selectedFieldIds: string[];
      patchText: string;
      validationMode?: string;
      allowSaveWithErrors?: boolean;
    }) => Promise<{ ok: boolean; issues?: CKCValidationIssue[] }>;
    exportEmptyTemplate: (params?: unknown) => Promise<{ ok: true; path: string; templateId: string }>;
    exportTemplateFieldPack: (params?: unknown) => Promise<{
      ok: true;
      path: string;
      lineCount: number;
      templateId: string;
      spinoffId: string | null;
      name: string;
    }>;
    exportBundle: (params?: unknown) => Promise<{ txtPath: string; mdPath: string; pdfPath: string }>;
    exportImageSet: (params: {
      characterId?: string | null;
      imageIds: string[];
      outDir?: string | null;
      setName?: string | null;
    }) => Promise<{ ok: true; outDir: string; written: Array<{ imageId: string; path: string }>; skipped: Array<{ imageId: string; reason: string }> }>;
    exportSharePack: (params: {
      characterId: string;
      outDir?: string | null;
      includeSheet?: boolean;
      imageIds?: string[];
      docIdsByType?: { notes?: string[]; stories?: string[]; moodboard?: string[] };
    }) => Promise<{ ok: true; outDir: string; manifestPath: string }>;
    exportMoodboardPng: (params: {
      docId?: string | null;
      title?: string;
      pngBase64: string;
      outDir?: string | null;
    }) => Promise<{ ok: true; path: string }>;
    exportMoodboardPdf: (params: {
      docId?: string | null;
      title?: string;
      pngBase64: string;
      outDir?: string | null;
      widthPx?: number;
      heightPx?: number;
    }) => Promise<{ ok: true; path: string }>;
    exportFieldPack: (params?: unknown) => Promise<{ path: string; lineCount: number; spinoffId: string | null; name: string }>;
    openPath: (filePath: string) => Promise<{ ok: true }>;
    copyText: (text: string) => void;
    setCharacterIcon: (params?: unknown) => Promise<{ ok: true }>;
    saveCharacter: (params: unknown) => Promise<unknown>;
    importImages: (params: unknown) => Promise<unknown>;
    importFromUrl: (params: unknown) => Promise<unknown>;
    importClipboardImage: (params: { target?: 'inbox'; characterId?: string } | unknown) => Promise<CKCClipboardImageImportResult>;
    scanInbox: (params?: { inboxDir?: string; includeSubdirs?: boolean } | null) => Promise<CKCInboxScanResult>;
    moveImagesToCharacter: (params: { imageIds: string[]; targetCharacterId: string }) => Promise<CKCMoveImagesResult>;
    deleteImages: (params: { imageIds: string[]; deleteFiles?: boolean }) => Promise<CKCDeleteImagesResult>;
    repairMissingImagesByHash: (params: { scanDir: string; includeSubdirs?: boolean; dryRun?: boolean }) => Promise<CKCRepairMissingImagesByHashResult>;
    setImageMeta: (params: unknown) => Promise<unknown>;
    getImagePalette: (params: { imageId: string; colorCount?: number } | unknown) => Promise<{ ok: true; imageId: string; palette: string[] }>;
    ensureImagePalettes: (params: { imageIds: string[]; colorCount?: number; maxImages?: number } | unknown) => Promise<{
      ok: true;
      palettes: Record<string, string[]>;
    }>;
    getImageAnnotations: (params: { imageId: string }) => Promise<{ ok: true; imageId: string; annotations: CKCImageAnnotations }>;
    setImageAnnotations: (params: { imageId: string; annotations: CKCImageAnnotations }) => Promise<{ ok: true }>;
    setImagesMetaBatch: (params: unknown) => Promise<unknown>;
    addManualTag: (params: { characterId: string; tagText: string }) => Promise<unknown>;
    removeManualTag: (params: { characterId: string; tagText: string }) => Promise<unknown>;
    listVersions: (characterId: string) => Promise<CKCSheetVersionListItem[]>;
    diffVersions: (params: { characterId: string; fromVersionId: string; toVersionId: string }) => Promise<CKCSheetVersionDiffResult>;
    revertPreviewFromVersion: (params: { characterId: string; versionId: string }) => Promise<CKCSheetIngestPreviewResult>;
    revertApplyFromVersion: (params: {
      characterId: string;
      versionId: string;
      selectedFieldIds: string[];
      validationMode?: string;
      allowSaveWithErrors?: boolean;
    }) => Promise<{ ok: boolean; issues?: CKCValidationIssue[] }>;
  };
}

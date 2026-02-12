/// <reference types="vite/client" />

type CKCCharacterListItem = {
  id: string;
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
  tags: string[];
  addedAt: string;
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
  displayName: string;
  templateId: string;
  templateVersion: string;
  templateHash: string;
  iconImageId: string | null;
  iconFocusX: number;
  iconFocusY: number;
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
  galleryFilters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isBuiltin: boolean;
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
    llmChat: (params: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      temperature?: number;
      maxTokens?: number;
    }) => Promise<{ ok: true; text: string }>;
    selectLibraryRoot: () => Promise<string | null>;
    getLibraryDiagnostics: (params?: { topN?: number } | null) => Promise<CKCLibraryDiagnostics>;
    listCharacters: (params?: unknown) => Promise<CKCCharacterListItem[]>;
    listAllTags: () => Promise<string[]>;
    listFieldValueSuggestions: (params?: unknown) => Promise<string[]>;
    createCharacter: (params?: unknown) => Promise<string>;
    importCharacterFromSheetDialog: () => Promise<{ characterId: string } | null>;
    getCharacter: (characterId: string) => Promise<CKCCharacter | null>;
    listGlobalCarouselImages: (params?: unknown) => Promise<CKCGlobalImage[]>;
    listDocs: (params?: unknown) => Promise<CKCDocListItem[]>;
    getDoc: (params?: unknown) => Promise<CKCDocDetail | null>;
    upsertDoc: (params?: unknown) => Promise<{ ok: true; docId: string; docType: CKCDocType }>;
    deleteDoc: (params?: unknown) => Promise<{ ok: true }>;
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
    exportFieldPack: (params?: unknown) => Promise<{ path: string; lineCount: number; spinoffId: string | null; name: string }>;
    openPath: (filePath: string) => Promise<{ ok: true }>;
    setCharacterIcon: (params?: unknown) => Promise<{ ok: true }>;
    saveCharacter: (params: unknown) => Promise<unknown>;
    importImages: (params: unknown) => Promise<unknown>;
    repairMissingImagesByHash: (params: { scanDir: string; includeSubdirs?: boolean; dryRun?: boolean }) => Promise<CKCRepairMissingImagesByHashResult>;
    setImageMeta: (params: unknown) => Promise<unknown>;
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

/// <reference types="vite/client" />

type CKCCharacterListItem = {
  id: string;
  displayName: string;
  templateId: string;
  templateVersion: string;
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

interface Window {
  ckc: {
    initialize: () => Promise<{ ok: true }>;
    getConfig: () => Promise<unknown>;
    setConfig: (cfg: unknown) => Promise<unknown>;
    selectLibraryRoot: () => Promise<string | null>;
    listCharacters: (params?: unknown) => Promise<CKCCharacterListItem[]>;
    createCharacter: (params?: unknown) => Promise<string>;
    importCharacterFromSheetDialog: () => Promise<{ characterId: string } | null>;
    getCharacter: (characterId: string) => Promise<CKCCharacter | null>;
    listGlobalCarouselImages: (params?: unknown) => Promise<CKCGlobalImage[]>;
    listDocs: (params?: unknown) => Promise<CKCDocListItem[]>;
    getDoc: (params?: unknown) => Promise<CKCDocDetail | null>;
    upsertDoc: (params?: unknown) => Promise<{ ok: true; docId: string; docType: CKCDocType }>;
    deleteDoc: (params?: unknown) => Promise<{ ok: true }>;
    getTemplate: () => Promise<CKCTemplateAst>;
    getTemplateDetail: (templateId?: string | null) => Promise<CKCTemplateDetail | null>;
    listSpinOffs: (params?: unknown) => Promise<CKCSpinOffListItem[]>;
    getSpinOff: (spinoffId: string) => Promise<CKCSpinOffDetail>;
    createSpinOff: (params?: unknown) => Promise<string>;
    updateSpinOff: (params?: unknown) => Promise<{ ok: true }>;
    deleteSpinOff: (spinoffId: string) => Promise<{ ok: true }>;
    selectFolderDialog: (opts?: unknown) => Promise<string | null>;
    exportEmptyTemplate: (params?: unknown) => Promise<{ ok: true; path: string; templateId: string }>;
    exportTemplateFieldPack: (params?: unknown) => Promise<{
      ok: true;
      path: string;
      lineCount: number;
      templateId: string;
      spinoffId: string | null;
      name: string;
    }>;
    openPath: (filePath: string) => Promise<{ ok: true }>;
    saveCharacter: (params: unknown) => Promise<unknown>;
    importImages: (params: unknown) => Promise<unknown>;
    setImageMeta: (params: unknown) => Promise<unknown>;
  };
}

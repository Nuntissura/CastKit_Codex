/// <reference types="vite/client" />

type CKCCharacterListItem = {
  id: string;
  displayName: string;
  templateId: string;
  templateVersion: string;
  updatedAt: string;
  createdAt: string;
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

type CKCTemplate = {
  templateId: string;
  versionLabel: string;
  updatedAt: string;
  sections: Array<{
    title: string;
    fields: Array<{
      id: string;
      label: string;
      type: 'text' | 'textarea' | 'select' | 'rule' | 'list';
      required?: boolean;
      options?: string[];
      templateDescriptor?: string;
    }>;
  }>;
};

interface Window {
  ckc: {
    initialize: () => Promise<{ ok: true }>;
    getConfig: () => Promise<unknown>;
    listCharacters: (params?: unknown) => Promise<CKCCharacterListItem[]>;
    getCharacter: (characterId: string) => Promise<CKCCharacter | null>;
    getTemplate: () => Promise<CKCTemplate>;
    saveCharacter: (params: unknown) => Promise<unknown>;
    importImages: (params: unknown) => Promise<unknown>;
    setImageMeta: (params: unknown) => Promise<unknown>;
  };
}


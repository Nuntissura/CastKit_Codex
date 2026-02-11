import React from 'react';
import { LibraryDrawer } from '../components/LibraryDrawer';
import { MediaPane } from '../components/MediaPane';
import { MoodboardCanvas, type MoodboardState } from '../components/MoodboardCanvas';
import { SheetEditor } from '../components/SheetEditor';
import styles from './characterView.module.css';

function tagsTextToArray(text: string): string[] {
  const parts = String(text || '')
    .split(/[,\n\r\t]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function tagsArrayToText(tags: string[]): string {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function emptyMoodboard(): MoodboardState {
  return { version: 1, strokes: [], images: [] };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function fileNameFromRelativePath(rel: string): string {
  const raw = String(rel || '');
  const parts = raw.split(/[\\/]/);
  return parts[parts.length - 1] || raw;
}

function joinPath(a: string, b: string): string {
  const left = String(a || '').replace(/[\\/]+$/, '');
  if (!left) return String(b || '');
  return `${left}\\${String(b || '').replace(/^[\\/]+/, '')}`;
}

function dirName(p: string): string {
  const s = String(p || '');
  const idx = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
  return idx >= 0 ? s.slice(0, idx) : s;
}

export function CharacterView({
  characterId,
  onBack,
  onOpenLibraryDrawer,
  isLibraryDrawerOpen,
  onCloseLibraryDrawer,
}: {
  characterId: string | null;
  onBack: () => void;
  onOpenLibraryDrawer: () => void;
  isLibraryDrawerOpen: boolean;
  onCloseLibraryDrawer: () => void;
}) {
  const [character, setCharacter] = React.useState<CKCCharacter | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'sheet' | 'photos' | 'notes' | 'tools'>('sheet');
  const [mediaMode, setMediaMode] = React.useState<'carousel' | 'photos'>('carousel');

  const [templateAst, setTemplateAst] = React.useState<CKCTemplateAst | null>(null);
  const [draftValuesById, setDraftValuesById] = React.useState<Record<string, string>>({});
  const [saveIssues, setSaveIssues] = React.useState<Array<{ fieldId: string; severity: string; message: string }> | null>(null);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  const [iconDraftImageId, setIconDraftImageId] = React.useState<string | null>(null);
  const [iconDraftFocusX, setIconDraftFocusX] = React.useState<number>(0.5);
  const [iconDraftFocusY, setIconDraftFocusY] = React.useState<number>(0.5);
  const [iconError, setIconError] = React.useState<string | null>(null);
  const [isIconSaving, setIsIconSaving] = React.useState<boolean>(false);

  const [manualTagDraftText, setManualTagDraftText] = React.useState<string>('');
  const [isTagSaving, setIsTagSaving] = React.useState<boolean>(false);
  const [allTags, setAllTags] = React.useState<string[]>([]);
  const tagsDatalistId = React.useId();
  const docsTagsDatalistId = React.useId();

  const [docType, setDocType] = React.useState<CKCDocType>('notes');
  const [docQueryText, setDocQueryText] = React.useState<string>('');
  const [docTagDraftText, setDocTagDraftText] = React.useState<string>('');
  const [docTagFilters, setDocTagFilters] = React.useState<string[]>([]);
  const [docs, setDocs] = React.useState<CKCDocListItem[] | null>(null);
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null);
  const [loadedDoc, setLoadedDoc] = React.useState<CKCDocDetail | null>(null);
  const [draftDocTitle, setDraftDocTitle] = React.useState<string>('');
  const [draftDocContent, setDraftDocContent] = React.useState<string>('');
  const [draftDocTagsText, setDraftDocTagsText] = React.useState<string>('');
  const [docError, setDocError] = React.useState<string | null>(null);
  const [isDocSaving, setIsDocSaving] = React.useState<boolean>(false);
  const [moodboard, setMoodboard] = React.useState<MoodboardState>(() => emptyMoodboard());

  const [isImagePickerOpen, setIsImagePickerOpen] = React.useState<boolean>(false);
  const [imagePickerSource, setImagePickerSource] = React.useState<'character' | 'global'>('character');
  const [globalPickerImages, setGlobalPickerImages] = React.useState<CKCGlobalImage[]>([]);

  const [libraryRoot, setLibraryRoot] = React.useState<string | null>(null);
  const [exportDir, setExportDir] = React.useState<string | null>(null);
  const [spinOffs, setSpinOffs] = React.useState<CKCSpinOffListItem[] | null>(null);
  const [selectedSpinOffId, setSelectedSpinOffId] = React.useState<string | null>(null);
  const [packIncludeValues, setPackIncludeValues] = React.useState<boolean>(true);
  const [packEmptyOnly, setPackEmptyOnly] = React.useState<boolean>(false);
  const [packSections, setPackSections] = React.useState<string[] | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);

  const [isImportingImages, setIsImportingImages] = React.useState<boolean>(false);

  const defaultExportsDir = React.useMemo(() => {
    return libraryRoot ? joinPath(libraryRoot, 'exports') : null;
  }, [libraryRoot]);

  React.useEffect(() => {
    if (!characterId) return;
    setCharacter(null);
    setError(null);
    setTemplateAst(null);
    setDraftValuesById({});
    setSaveIssues(null);
    setIconDraftImageId(null);
    setIconDraftFocusX(0.5);
    setIconDraftFocusY(0.5);
    setIconError(null);

    window.ckc
      .getCharacter(characterId)
      .then((c) => setCharacter(c))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [characterId]);

  React.useEffect(() => {
    if (!character) return;
    setDraftValuesById(character.valuesById || {});
    void window.ckc.getTemplateDetail(character.templateId).then((detail) => setTemplateAst(detail?.ast ?? null));
  }, [character?.id, character?.templateId]);

  React.useEffect(() => {
    setPackSections(null);
  }, [characterId, templateAst]);

  React.useEffect(() => {
    window.ckc
      .getConfig()
      .then((cfg: any) => {
        if (typeof cfg?.libraryRoot === 'string') setLibraryRoot(cfg.libraryRoot);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    window.ckc
      .listSpinOffs({})
      .then((rows) => {
        setSpinOffs(rows);
        const safe = (rows || []).find((r: any) => String(r.name || '').toLowerCase().includes('safe subset'));
        setSelectedSpinOffId((safe?.id ?? rows?.[0]?.id ?? null) as any);
      })
      .catch((err: unknown) => setExportError(err instanceof Error ? err.message : String(err)));
  }, []);

  React.useEffect(() => {
    window.ckc
      .listAllTags()
      .then((rows) => setAllTags(Array.isArray(rows) ? rows.map((t) => String(t)) : []))
      .catch(() => setAllTags([]));
  }, []);

  React.useEffect(() => {
    if (!characterId) return;
    if (!character) return;
    setIconDraftImageId(character.iconImageId ?? null);
    setIconDraftFocusX(clamp01(character.iconFocusX));
    setIconDraftFocusY(clamp01(character.iconFocusY));
    setIconError(null);
  }, [characterId, character?.iconImageId, character?.iconFocusX, character?.iconFocusY]);

  const reloadDocs = React.useCallback(() => {
    window.ckc
      .listDocs({ docType, queryText: docQueryText, tagFilters: docTagFilters })
      .then((rows) => setDocs(rows))
      .catch((err: unknown) => setDocError(err instanceof Error ? err.message : String(err)));
  }, [docType, docQueryText, docTagFilters]);

  React.useEffect(() => {
    if (tab !== 'notes' && !isLibraryDrawerOpen) return;
    reloadDocs();
  }, [tab, isLibraryDrawerOpen, reloadDocs]);

  React.useEffect(() => {
    // Reset selection when switching doc type.
    setSelectedDocId(null);
    setLoadedDoc(null);
    setDraftDocTitle('');
    setDraftDocContent('');
    setDraftDocTagsText('');
    setMoodboard(emptyMoodboard());
  }, [docType]);

  React.useEffect(() => {
    if (!selectedDocId) return;
    setDocError(null);
    window.ckc
      .getDoc({ docType, docId: selectedDocId })
      .then((doc) => {
        setLoadedDoc(doc);
        setDraftDocTitle(doc?.title ?? '');
        setDraftDocTagsText(tagsArrayToText(doc?.tags ?? []));

        if (docType === 'moodboard') {
          try {
            const parsed = JSON.parse(doc?.content ?? '{}');
            if (
              parsed &&
              typeof parsed === 'object' &&
              parsed.version === 1 &&
              Array.isArray(parsed.strokes) &&
              Array.isArray(parsed.images)
            ) {
              setMoodboard(parsed);
            } else {
              setMoodboard(emptyMoodboard());
            }
          } catch {
            setMoodboard(emptyMoodboard());
          }
          setDraftDocContent('');
        } else {
          setDraftDocContent(doc?.content ?? '');
          setMoodboard(emptyMoodboard());
        }
      })
      .catch((err: unknown) => setDocError(err instanceof Error ? err.message : String(err)));
  }, [selectedDocId, docType]);

  React.useEffect(() => {
    if (!isImagePickerOpen) return;
    if (imagePickerSource !== 'global') return;
    window.ckc
      .listGlobalCarouselImages({ preferFrontpage: true })
      .then((rows) => setGlobalPickerImages(rows || []))
      .catch(() => setGlobalPickerImages([]));
  }, [isImagePickerOpen, imagePickerSource]);

  const images = React.useMemo(() => {
    const all = character?.images ?? [];
    if (mediaMode === 'photos') return all;
    const carousel = all.filter((i) => (i.tags || []).includes('carousel'));
    return carousel.length > 0 ? carousel : all;
  }, [character, mediaMode]);

  const docSmartTags = React.useMemo(() => {
    if (!docs) return [];
    const seen = new Set<string>();
    for (const d of docs) {
      for (const t of d.tags || []) seen.add(String(t));
    }
    return Array.from(seen)
      .map((t) => t.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [docs]);

  const addDocTagFiltersFromText = (text: string) => {
    const toAdd = tagsTextToArray(text);
    if (toAdd.length === 0) return;
    setDocTagFilters((prev) => Array.from(new Set([...(prev || []), ...toAdd])));
    setDocTagDraftText('');
  };

  const isDirty = React.useMemo(() => {
    if (!character) return false;
    const a = character.valuesById || {};
    const b = draftValuesById || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (String(a[k] ?? '') !== String(b[k] ?? '')) return true;
    }
    return false;
  }, [character, draftValuesById]);

  const iconIsDirty = React.useMemo(() => {
    if (!character) return false;
    const aId = character.iconImageId ?? null;
    const bId = iconDraftImageId ?? null;
    if (aId !== bId) return true;
    if (Math.abs(clamp01(character.iconFocusX) - clamp01(iconDraftFocusX)) > 1e-6) return true;
    if (Math.abs(clamp01(character.iconFocusY) - clamp01(iconDraftFocusY)) > 1e-6) return true;
    return false;
  }, [character, iconDraftImageId, iconDraftFocusX, iconDraftFocusY]);

  const saveIcon = async () => {
    if (!characterId) return;
    setIsIconSaving(true);
    setIconError(null);
    try {
      await window.ckc.setCharacterIcon({
        characterId,
        imageId: iconDraftImageId,
        focusX: clamp01(iconDraftFocusX),
        focusY: clamp01(iconDraftFocusY),
      });

      setCharacter((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          iconImageId: iconDraftImageId ?? null,
          iconFocusX: clamp01(iconDraftFocusX),
          iconFocusY: clamp01(iconDraftFocusY),
        };
      });
    } catch (err: unknown) {
      setIconError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsIconSaving(false);
    }
  };

  const saveSheet = async () => {
    if (!characterId) return;
    setIsSaving(true);
    setSaveIssues(null);
    setError(null);
    try {
      const res: any = await window.ckc.saveCharacter({ characterId, valuesById: draftValuesById });
      if (!res?.ok) {
        setSaveIssues(Array.isArray(res?.issues) ? res.issues : []);
        return;
      }
      const refreshed = await window.ckc.getCharacter(characterId);
      if (refreshed) {
        setCharacter(refreshed);
        setDraftValuesById(refreshed.valuesById || {});
      }
      setSaveIssues(Array.isArray(res?.issues) ? res.issues : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const reloadCharacter = React.useCallback(async () => {
    if (!characterId) return;
    const refreshed = await window.ckc.getCharacter(characterId);
    if (refreshed) setCharacter(refreshed);
  }, [characterId]);

  const addManualTags = React.useCallback(async () => {
    if (!characterId) return;
    const parts = tagsTextToArray(manualTagDraftText);
    if (parts.length === 0) return;
    setIsTagSaving(true);
    setError(null);
    try {
      for (const raw of parts) {
        const trimmed = String(raw).trim();
        if (!trimmed) continue;
        const canonical = allTags.find((t) => String(t).toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
        await window.ckc.addManualTag({ characterId, tagText: String(canonical) });
      }
      setManualTagDraftText('');
      await reloadCharacter();
      window.ckc
        .listAllTags()
        .then((rows) => setAllTags(Array.isArray(rows) ? rows.map((t) => String(t)) : []))
        .catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTagSaving(false);
    }
  }, [characterId, manualTagDraftText, allTags, reloadCharacter]);

  const removeManualTag = React.useCallback(
    async (tagText: string) => {
      if (!characterId) return;
      setIsTagSaving(true);
      setError(null);
      try {
        await window.ckc.removeManualTag({ characterId, tagText });
        await reloadCharacter();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsTagSaving(false);
      }
    },
    [characterId, reloadCharacter]
  );

  const docTags = React.useMemo(() => tagsTextToArray(draftDocTagsText), [draftDocTagsText]);

  const docIsDirty = React.useMemo(() => {
    const loadedTags = loadedDoc?.tags ?? [];
    const sameTags =
      loadedTags.length === docTags.length &&
      loadedTags.every((t) => docTags.includes(t)) &&
      docTags.every((t) => loadedTags.includes(t));

    if (docType === 'moodboard') {
      const currentJson = JSON.stringify(moodboard);
      const loadedJson = loadedDoc?.content ?? '';
      return String(draftDocTitle ?? '') !== String(loadedDoc?.title ?? '') || !sameTags || currentJson !== String(loadedJson ?? '');
    }

    return (
      String(draftDocTitle ?? '') !== String(loadedDoc?.title ?? '') ||
      String(draftDocContent ?? '') !== String(loadedDoc?.content ?? '') ||
      !sameTags
    );
  }, [docType, loadedDoc, draftDocTitle, draftDocContent, docTags, moodboard]);

  const saveDoc = async () => {
    setIsDocSaving(true);
    setDocError(null);
    try {
      const content = docType === 'moodboard' ? JSON.stringify(moodboard) : draftDocContent;
      const res = await window.ckc.upsertDoc({
        docType,
        docId: selectedDocId,
        title: draftDocTitle,
        content,
        tags: docTags,
      });

      const nextId = res?.docId || selectedDocId;
      if (nextId) setSelectedDocId(nextId);
      reloadDocs();
      if (nextId) {
        const fresh = await window.ckc.getDoc({ docType, docId: nextId });
        setLoadedDoc(fresh);
      }
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDocSaving(false);
    }
  };

  const newDoc = async () => {
    setIsDocSaving(true);
    setDocError(null);
    try {
      const res = await window.ckc.upsertDoc({
        docType,
        title: 'Untitled',
        content: docType === 'moodboard' ? JSON.stringify(emptyMoodboard()) : '',
        tags: [],
      });
      if (res?.docId) {
        setSelectedDocId(res.docId);
        reloadDocs();
        onCloseLibraryDrawer();
      }
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDocSaving(false);
    }
  };

  const deleteDoc = async () => {
    if (!selectedDocId) return;
    if (!confirm('Delete this document?')) return;
    setIsDocSaving(true);
    setDocError(null);
    try {
      await window.ckc.deleteDoc({ docType, docId: selectedDocId });
      setSelectedDocId(null);
      setLoadedDoc(null);
      setDraftDocTitle('');
      setDraftDocContent('');
      setDraftDocTagsText('');
      setMoodboard(emptyMoodboard());
      reloadDocs();
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDocSaving(false);
    }
  };

  const importImagesForCharacter = async () => {
    if (!characterId) return;
    setIsImportingImages(true);
    setError(null);
    try {
      await window.ckc.importImages({ characterId });
      const c = await window.ckc.getCharacter(characterId);
      setCharacter(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImportingImages(false);
    }
  };

  const chooseCharacterExportDir = async () => {
    setExportError(null);
    try {
      const dir = await window.ckc.selectFolderDialog({ title: 'Select export folder' });
      if (!dir) return;
      setExportDir(dir);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  };

  const exportCharacterBundle = async () => {
    if (!characterId) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const outDir = exportDir || defaultExportsDir;
      const res = await window.ckc.exportBundle({ characterId, outDir });
      setLastExportPath(res.txtPath);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const exportCharacterFieldPack = async () => {
    if (!characterId) return;
    if (!selectedSpinOffId) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const outDir = exportDir || defaultExportsDir;
      const res = await window.ckc.exportFieldPack({
        characterId,
        spinoffId: selectedSpinOffId,
        includeEmptyOnly: packEmptyOnly,
        includeValues: packIncludeValues,
        includeSections: packSections,
        outDir,
      });
      setLastExportPath(res.path);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const addMoodboardImage = (imageId: string) => {
    setMoodboard((prev) => ({
      ...prev,
      images: [
        ...(prev.images || []),
        {
          imageId,
          x: 0.5,
          y: 0.5,
          w: 0.55,
          h: 0.55,
        },
      ],
    }));
  };

  return (
    <>
      <LibraryDrawer isOpen={isLibraryDrawerOpen} onClose={onCloseLibraryDrawer}>
        <div className={styles.docsDrawer}>
          <div className={styles.docsDrawerTop}>
            <div className={styles.docsTypeRow}>
              {(['notes', 'stories', 'moodboard'] as const).map((t) => (
                <button
                  key={t}
                  className={styles.tabBtn}
                  data-active={docType === t ? '1' : '0'}
                  onClick={() => setDocType(t)}
                >
                  {t === 'notes' ? 'Notes' : t === 'stories' ? 'Stories' : 'Moodboard'}
                </button>
              ))}
            </div>
            <div className={styles.docsDrawerActions}>
              <button className={styles.btnSecondary} onClick={() => void newDoc()} disabled={isDocSaving}>
                New
              </button>
              <button className={styles.btnSecondary} onClick={onCloseLibraryDrawer}>
                Close
              </button>
            </div>
          </div>

          <label className={styles.docsSearch}>
            Search <input value={docQueryText} onChange={(e) => setDocQueryText(e.target.value)} placeholder="Title…" />
          </label>

          <label className={styles.docsSearch}>
            Tags
            <div className={styles.docsTagRow}>
              <input
                value={docTagDraftText}
                onChange={(e) => setDocTagDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDocTagFiltersFromText(docTagDraftText);
                  }
                }}
                placeholder="tag"
                list={docsTagsDatalistId}
              />
              <button
                className={styles.btnSecondary}
                onClick={() => addDocTagFiltersFromText(docTagDraftText)}
                disabled={tagsTextToArray(docTagDraftText).length === 0}
                title="Add tag filter"
              >
                Add
              </button>
              {docTagFilters.length ? (
                <button className={styles.btnSecondary} onClick={() => setDocTagFilters([])} title="Clear all tag filters">
                  Clear
                </button>
              ) : null}
              <datalist id={docsTagsDatalistId}>
                {allTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </label>

          {docTagFilters.length ? (
            <div className={styles.tagChips}>
              {docTagFilters.map((t) => (
                <button
                  key={t}
                  className={styles.tagChip}
                  onClick={() => setDocTagFilters((cur) => (cur || []).filter((x) => x !== t))}
                  title="Remove tag filter"
                >
                  x {t}
                </button>
              ))}
            </div>
          ) : null}

          {docSmartTags.length ? (
            <details className={styles.smartTagsBox}>
              <summary>Smart tags</summary>
              <div className={styles.smartTags}>
                {docSmartTags.slice(0, 200).map((t) => (
                  <button key={t} className={styles.tagChip} onClick={() => addDocTagFiltersFromText(t)} title="Add tag filter">
                    {t}
                  </button>
                ))}
                {docSmartTags.length > 200 ? <span className={styles.muted}>...</span> : null}
              </div>
            </details>
          ) : null}

          {docError ? <div className={styles.error}>{docError}</div> : null}
          {docs === null ? (
            <div className={styles.muted}>Loading…</div>
          ) : docs.length === 0 ? (
            <div className={styles.muted}>No documents.</div>
          ) : (
            <div className={styles.docsList}>
              {docs.map((d) => (
                <button
                  key={d.id}
                  className={styles.docsItem}
                  data-active={d.id === selectedDocId ? '1' : '0'}
                  onClick={() => {
                    setSelectedDocId(d.id);
                    onCloseLibraryDrawer();
                  }}
                  title={d.tags?.length ? d.tags.join(', ') : undefined}
                >
                  <div className={styles.docsItemTitle}>{d.title}</div>
                  <div className={styles.docsItemMeta}>{new Date(d.updatedAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </LibraryDrawer>

      <div className={styles.layout} data-mode={tab === 'notes' ? 'docs' : 'default'}>
        <section className={styles.left}>
          <div className={styles.leftBody}>
            <MediaPane
              headerLeft={
                <div className={styles.leftHeader}>
                  <button
                    className={styles.leftToggle}
                    data-active={mediaMode === 'carousel' ? '1' : '0'}
                    onClick={() => setMediaMode('carousel')}
                  >
                    Carousel
                  </button>
                  <button
                    className={styles.leftToggle}
                    data-active={mediaMode === 'photos' ? '1' : '0'}
                    onClick={() => setMediaMode('photos')}
                  >
                    Photos
                  </button>
                </div>
              }
              showCarouselToggleOnThumbs={mediaMode === 'photos'}
              images={images}
              emptyLabel="No images for this character yet."
              onPatchImageMeta={(imageId, patch) => {
                setCharacter((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    images: (prev.images || []).map((img) =>
                      img.id === imageId ? { ...img, ...patch, tags: patch.tags ?? img.tags } : img
                    ),
                  };
                });
              }}
            />
          </div>
        </section>

        {tab === 'notes' ? (
          <section className={styles.middle}>
            <div className={styles.middleHeader}>
              <div className={styles.docsTypeRow}>
                {(['notes', 'stories', 'moodboard'] as const).map((t) => (
                  <button
                    key={t}
                    className={styles.tabBtn}
                    data-active={docType === t ? '1' : '0'}
                    onClick={() => setDocType(t)}
                  >
                    {t === 'notes' ? 'Notes' : t === 'stories' ? 'Stories' : 'Moodboard'}
                  </button>
                ))}
              </div>

              <div className={styles.docsActionsRow}>
                <button className={styles.btnSecondary} onClick={onOpenLibraryDrawer}>
                  Library
                </button>
                <button className={styles.btnSecondary} onClick={() => void newDoc()} disabled={isDocSaving}>
                  New
                </button>
                <button className={styles.btnSecondary} onClick={() => void saveDoc()} disabled={!docIsDirty || isDocSaving}>
                  {isDocSaving ? 'Saving…' : docIsDirty ? 'Save' : 'Saved'}
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => void deleteDoc()}
                  disabled={!selectedDocId || isDocSaving}
                >
                  Delete
                </button>
                <button className={styles.btnSecondary} onClick={() => setTab('sheet')}>
                  Close
                </button>
              </div>
            </div>

            <div className={styles.middleBody}>
              {docError ? <div className={styles.error}>{docError}</div> : null}

              <div className={styles.docForm}>
                <label className={styles.docLabel}>
                  Title <input value={draftDocTitle} onChange={(e) => setDraftDocTitle(e.target.value)} placeholder="Untitled" />
                </label>
                <label className={styles.docLabel}>
                  Tags{' '}
                  <input
                    value={draftDocTagsText}
                    onChange={(e) => setDraftDocTagsText(e.target.value)}
                    placeholder="tag, tag2"
                  />
                </label>
              </div>

              {docType === 'moodboard' ? (
                <>
                  <MoodboardCanvas
                    value={moodboard}
                    onChange={setMoodboard}
                    onRequestAddImage={() => {
                      setIsImagePickerOpen(true);
                      setImagePickerSource('character');
                    }}
                  />

                  {isImagePickerOpen ? (
                    <div className={styles.modalBackdrop} onClick={() => setIsImagePickerOpen(false)}>
                      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                          <div className={styles.modalTitle}>Add image</div>
                          <button className={styles.btnSecondary} onClick={() => setIsImagePickerOpen(false)}>
                            Close
                          </button>
                        </div>

                        <div className={styles.modalTabs}>
                          <button
                            className={styles.tabBtn}
                            data-active={imagePickerSource === 'character' ? '1' : '0'}
                            onClick={() => setImagePickerSource('character')}
                          >
                            This character
                          </button>
                          <button
                            className={styles.tabBtn}
                            data-active={imagePickerSource === 'global' ? '1' : '0'}
                            onClick={() => setImagePickerSource('global')}
                          >
                            Global carousel
                          </button>
                        </div>

                        <div className={styles.modalGrid}>
                          {(imagePickerSource === 'character' ? (character?.images ?? []) : globalPickerImages).map((img: any) => (
                            <button
                              key={img.id}
                              className={styles.modalImgBtn}
                              onClick={() => {
                                addMoodboardImage(img.id);
                                setIsImagePickerOpen(false);
                              }}
                              title={img.tags?.length ? img.tags.join(', ') : undefined}
                            >
                              <img className={styles.modalImg} src={`ckc://thumb/${encodeURIComponent(img.id)}`} alt="" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <textarea
                  className={styles.docText}
                  value={draftDocContent}
                  onChange={(e) => setDraftDocContent(e.target.value)}
                  placeholder={docType === 'notes' ? 'Write a note…' : 'Write a story…'}
                />
              )}
            </div>
          </section>
        ) : null}

        <aside className={styles.right}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.name}>{character?.displayName ?? 'Character'}</div>
              <div className={styles.sub}>Character Editor (rebuild)</div>
            </div>
            <div className={styles.headerRight}>
              {tab === 'sheet' ? (
                <button className={styles.btnSecondary} onClick={() => void saveSheet()} disabled={!isDirty || isSaving}>
                  {isSaving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
                </button>
              ) : null}
              <button
                className={styles.btnSecondary}
                onClick={() => void importImagesForCharacter()}
                disabled={!characterId || isImportingImages}
                title="Import images into this character"
              >
                {isImportingImages ? 'Importing...' : 'Import images...'}
              </button>
              <button className={styles.btnSecondary} onClick={onBack}>
                Library
              </button>
            </div>
          </div>

          <div className={styles.tabs}>
            <button className={styles.tabBtn} data-active={tab === 'sheet' ? '1' : '0'} onClick={() => setTab('sheet')}>
              Sheet
            </button>
            <button className={styles.tabBtn} data-active={tab === 'photos' ? '1' : '0'} onClick={() => setTab('photos')}>
              Photos
            </button>
            <button className={styles.tabBtn} data-active={tab === 'notes' ? '1' : '0'} onClick={() => setTab('notes')}>
              Notes
            </button>
            <button className={styles.tabBtn} data-active={tab === 'tools' ? '1' : '0'} onClick={() => setTab('tools')}>
              Tools
            </button>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
          {!characterId ? (
            <div className={styles.muted}>No character selected.</div>
          ) : character === null ? (
            <div className={styles.muted}>Loading…</div>
          ) : (
            <div className={styles.body}>
              {tab === 'sheet' ? (
                <>
                  <div className={styles.sectionTitle}>Sheet</div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800 }}>Tags</span>
                      {(character.tags || [])
                        .filter((t) => t.type === 'manual')
                        .map((t) => t.text)
                        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                        .map((t) => (
                          <button
                            key={`manual-${t}`}
                            className={styles.btnSecondary}
                            style={{ padding: '4px 8px' }}
                            onClick={() => void removeManualTag(t)}
                            disabled={isTagSaving}
                            title="Remove manual tag"
                          >
                            {t} ×
                          </button>
                        ))}
                      {(character.tags || [])
                        .filter((t) => t.type === 'derived')
                        .map((t) => t.text)
                        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                        .map((t) => (
                          <span
                            key={`derived-${t}`}
                            style={{
                              padding: '4px 8px',
                              border: '1px dashed var(--glass-border)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.9rem',
                            }}
                            title="Derived tag (read-only)"
                          >
                            {t}
                          </span>
                        ))}
                      {(!character.tags || character.tags.length === 0) ? (
                        <span className={styles.muted}>(none)</span>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      <input
                        value={manualTagDraftText}
                        onChange={(e) => setManualTagDraftText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addManualTags();
                          }
                        }}
                        placeholder="tag"
                        list={tagsDatalistId}
                        style={{ width: 220 }}
                        disabled={isTagSaving}
                      />
                      <button
                        className={styles.btnSecondary}
                        onClick={() => void addManualTags()}
                        disabled={isTagSaving || tagsTextToArray(manualTagDraftText).length === 0}
                      >
                        Add
                      </button>
                      <button
                        className={styles.btnSecondary}
                        onClick={() => setManualTagDraftText('')}
                        disabled={isTagSaving || !manualTagDraftText}
                      >
                        Clear
                      </button>
                      <datalist id={tagsDatalistId}>
                        {allTags.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {saveIssues?.length ? (
                    <div className={styles.issueBox}>
                      <div className={styles.issueTitle}>Validation issues</div>
                      <ul className={styles.issueList}>
                        {saveIssues.map((i, idx) => (
                          <li key={`${i.fieldId}-${idx}`}>
                            <span className={styles.issueSeverity} data-sev={i.severity}>
                              {i.severity}
                            </span>{' '}
                            <span className={styles.issueField}>{i.fieldId}</span>: {i.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {!templateAst ? (
                    <div className={styles.muted}>Loading template…</div>
                  ) : (
                    <SheetEditor
                      templateSections={templateAst.sections || []}
                      valuesById={draftValuesById}
                      onChange={(fieldId, value) => setDraftValuesById((prev) => ({ ...prev, [fieldId]: value }))}
                    />
                  )}
                </>
              ) : tab === 'photos' ? (
                <>
                  <div className={styles.sectionTitle}>Photos</div>
                  <div className={styles.muted}>Media lives in the left pane; this panel will hold photo metadata/edit tools.</div>
                </>
              ) : tab === 'tools' ? (
                <>
                  <div className={styles.sectionTitle}>Tools</div>
                  <div className={styles.smallNote}>Character icon is shown in the Library list. Focus sliders control the crop.</div>

                  <div className={styles.iconRow}>
                    <div className={styles.iconPreview}>
                      {iconDraftImageId ? (
                        <img
                          className={styles.iconImg}
                          src={`ckc://thumb/${encodeURIComponent(iconDraftImageId)}`}
                          alt=""
                          style={{
                            objectPosition: `${Math.round(clamp01(iconDraftFocusX) * 100)}% ${Math.round(
                              clamp01(iconDraftFocusY) * 100
                            )}%`,
                          }}
                        />
                      ) : (
                        <div className={styles.iconPlaceholder}>No icon</div>
                      )}
                    </div>

                    <div className={styles.iconControls}>
                      <div className={styles.iconControlRow}>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => void saveIcon()}
                          disabled={!character || isIconSaving || !iconIsDirty}
                        >
                          {isIconSaving ? 'Saving…' : iconIsDirty ? 'Save icon' : 'Icon saved'}
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => setIconDraftImageId(null)}
                          disabled={!character || isIconSaving || !iconDraftImageId}
                        >
                          Clear
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            setIconDraftFocusX(0.5);
                            setIconDraftFocusY(0.5);
                          }}
                          disabled={!character || isIconSaving}
                        >
                          Center
                        </button>
                      </div>

                      <div className={styles.iconControlRow}>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          Image{' '}
                          <select
                            value={iconDraftImageId ?? ''}
                            onChange={(e) => setIconDraftImageId(e.target.value ? e.target.value : null)}
                            disabled={!character || isIconSaving}
                          >
                            <option value="">(none)</option>
                            {(character?.images || []).map((img) => (
                              <option key={img.id} value={img.id}>
                                {fileNameFromRelativePath(img.relativePath) || img.id}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className={styles.iconControlRow}>
                        <div className={styles.iconSlider}>
                          <span>Focus X</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={String(Math.round(clamp01(iconDraftFocusX) * 100))}
                            onChange={(e) => setIconDraftFocusX((Number(e.target.value) || 0) / 100)}
                            disabled={!character || isIconSaving || !iconDraftImageId}
                          />
                          <code>{Math.round(clamp01(iconDraftFocusX) * 100)}%</code>
                        </div>

                        <div className={styles.iconSlider}>
                          <span>Focus Y</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={String(Math.round(clamp01(iconDraftFocusY) * 100))}
                            onChange={(e) => setIconDraftFocusY((Number(e.target.value) || 0) / 100)}
                            disabled={!character || isIconSaving || !iconDraftImageId}
                          />
                          <code>{Math.round(clamp01(iconDraftFocusY) * 100)}%</code>
                        </div>
                      </div>

                      {iconError ? (
                        <div className={styles.error} style={{ margin: '10px 0' }}>
                          {iconError}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div className={styles.sectionTitle}>Exports</div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Output:</span>
                      <code style={{ fontSize: '0.85rem' }}>{exportDir || defaultExportsDir || '(character exports folder)'}</code>
                      <button className={styles.btnSecondary} onClick={() => void chooseCharacterExportDir()} disabled={isExporting}>
                        Choose folder...
                      </button>
                      {exportDir ? (
                        <button className={styles.btnSecondary} onClick={() => setExportDir(null)} disabled={isExporting}>
                          Default
                        </button>
                      ) : null}
                      <button
                        className={styles.btnSecondary}
                        disabled={!defaultExportsDir && !exportDir}
                        onClick={() => {
                          const target = exportDir || defaultExportsDir;
                          if (!target) return;
                          void window.ckc.openPath(target);
                        }}
                      >
                        Open folder
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                      <button
                        className={styles.btnSecondary}
                        disabled={isExporting || !characterId}
                        onClick={() => void exportCharacterBundle()}
                      >
                        Export bundle (txt/md/pdf)
                      </button>

                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        Preset{' '}
                        <select
                          value={selectedSpinOffId ?? ''}
                          onChange={(e) => setSelectedSpinOffId(e.target.value || null)}
                          disabled={!spinOffs || spinOffs.length === 0 || isExporting}
                        >
                          {(spinOffs || []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {s.outOfDate ? ' (out of date)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        className={styles.btnSecondary}
                        disabled={isExporting || !characterId || !selectedSpinOffId}
                        onClick={() => void exportCharacterFieldPack()}
                      >
                        Export LLM pack
                      </button>

                      {lastExportPath ? (
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            void window.ckc.openPath(dirName(lastExportPath));
                          }}
                        >
                          Open last
                        </button>
                      ) : null}
                    </div>

                    <details style={{ marginTop: 10 }}>
                      <summary>LLM pack options</summary>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={packIncludeValues}
                            onChange={(e) => setPackIncludeValues(e.target.checked)}
                            disabled={isExporting}
                          />{' '}
                          Include values
                        </label>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={packEmptyOnly}
                            onChange={(e) => setPackEmptyOnly(e.target.checked)}
                            disabled={isExporting}
                          />{' '}
                          Empty only
                        </label>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => setPackSections(null)}
                          disabled={isExporting}
                          title="Reset to all sections"
                        >
                          All sections
                        </button>
                      </div>

                      {templateAst ? (
                        <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {(templateAst.sections || []).map((s) => {
                            const all = (templateAst.sections || []).map((x) => x.title);
                            const checked = packSections === null ? true : (packSections || []).includes(s.title);
                            return (
                              <label key={s.title} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const wantOn = e.target.checked;
                                    setPackSections((prev) => {
                                      const cur = prev === null ? all : prev || [];
                                      const next = wantOn
                                        ? Array.from(new Set([...cur, s.title]))
                                        : cur.filter((t) => t !== s.title);
                                      if (next.length === 0 || next.length === all.length) return null;
                                      return next;
                                    });
                                  }}
                                  disabled={isExporting}
                                />{' '}
                                <span title={s.title}>{s.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </details>

                    {exportError ? (
                      <div className={styles.error} style={{ margin: '10px 0' }}>
                        {exportError}
                      </div>
                    ) : null}
                    {lastExportPath ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 6 }}>
                        Last export: <code>{lastExportPath}</code>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.sectionTitle}>Notes</div>
                  <div className={styles.muted}>Use the Notes tab to open the 3-panel docs mode.</div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

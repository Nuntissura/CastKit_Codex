import React from 'react';
import { MediaPane } from '../components/MediaPane';
import { MoodboardCanvas, type MoodboardState } from '../components/MoodboardCanvas';
import styles from './exportHubView.module.css';

function joinPath(a: string, b: string): string {
  const left = String(a || '').replace(/[\\/]+$/, '');
  if (!left) return String(b || '');
  return `${left}\\${String(b || '').replace(/^[\\/]+/, '')}`;
}

function emptyMoodboard(): MoodboardState {
  return {
    version: 1,
    background: { kind: 'paper' },
    strokes: [],
    images: [],
    texts: [],
  };
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(String(text ?? ''));
  } catch {
    return null;
  }
}

function normalizeMoodboardState(raw: any): MoodboardState {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const out: MoodboardState = emptyMoodboard();
  if (obj.background && typeof obj.background === 'object') out.background = obj.background as any;
  out.strokes = Array.isArray(obj.strokes) ? (obj.strokes as any) : [];
  out.images = Array.isArray(obj.images) ? (obj.images as any) : [];
  out.texts = Array.isArray(obj.texts) ? (obj.texts as any) : [];
  out.strokesHidden = !!obj.strokesHidden;
  out.strokesLocked = !!obj.strokesLocked;
  return out;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === 'string');
}

export function ExportHubView({
  onBack,
  initialCharacterId = null,
  initialMoodboardDocId = null,
}: {
  onBack: () => void;
  initialCharacterId?: string | null;
  initialMoodboardDocId?: string | null;
}) {
  const [config, setConfig] = React.useState<any | null>(null);
  const [configPath, setConfigPath] = React.useState<string | null>(null);
  const [libraryRoot, setLibraryRoot] = React.useState<string | null>(null);
  const [exportRootOverride, setExportRootOverride] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);

  const defaultExportsDir = React.useMemo(() => {
    return libraryRoot ? joinPath(libraryRoot, 'exports') : null;
  }, [libraryRoot]);

  const exportRoot = React.useMemo(() => {
    return exportRootOverride || defaultExportsDir || null;
  }, [exportRootOverride, defaultExportsDir]);

  React.useEffect(() => {
    window.ckc
      .getConfigInfo()
      .then((info: any) => {
        const cfg: any = info?.config ?? null;
        setConfig(cfg);
        setConfigPath(typeof info?.configPath === 'string' ? info.configPath : null);
        if (typeof cfg?.libraryRoot === 'string') setLibraryRoot(cfg.libraryRoot);
        if (typeof cfg?.exportRoot === 'string') setExportRootOverride(cfg.exportRoot);
        else setExportRootOverride(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const chooseExportRoot = React.useCallback(async () => {
    setError(null);
    const dir = await window.ckc.selectFolderDialog({ title: 'Select exports folder' });
    if (!dir) return;
    const next = await window.ckc.setConfig({ exportRoot: dir });
    setConfig(next ?? null);
    setExportRootOverride(dir);
  }, []);

  const resetExportRoot = React.useCallback(async () => {
    setError(null);
    const next = await window.ckc.setConfig({ exportRoot: null });
    setConfig(next ?? null);
    setExportRootOverride(null);
  }, []);

  // --- Moodboard PNG export ---
  const [moodboards, setMoodboards] = React.useState<CKCDocListItem[] | null>(null);
  const [selectedMoodboardId, setSelectedMoodboardId] = React.useState<string | null>(initialMoodboardDocId);
  const [selectedMoodboardDoc, setSelectedMoodboardDoc] = React.useState<CKCDocDetail | null>(null);
  const [moodboardState, setMoodboardState] = React.useState<MoodboardState>(() => emptyMoodboard());
  const moodboardCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    window.ckc
      .listDocs({ docType: 'moodboard' })
      .then((rows: any) => {
        const list = Array.isArray(rows) ? (rows as CKCDocListItem[]) : [];
        setMoodboards(list);
        if (!selectedMoodboardId && list[0]?.id) setSelectedMoodboardId(list[0].id);
      })
      .catch(() => setMoodboards([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const docId = String(selectedMoodboardId ?? '').trim();
    if (!docId) {
      setSelectedMoodboardDoc(null);
      setMoodboardState(emptyMoodboard());
      return;
    }
    setError(null);
    window.ckc
      .getDoc({ docType: 'moodboard', docId })
      .then((doc) => {
        setSelectedMoodboardDoc(doc);
        const parsed = safeJsonParse(String(doc?.content ?? ''));
        setMoodboardState(normalizeMoodboardState(parsed));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setSelectedMoodboardDoc(null);
        setMoodboardState(emptyMoodboard());
      });
  }, [selectedMoodboardId]);

  const exportMoodboardPng = React.useCallback(async () => {
    if (!exportRoot) {
      setError('Export folder is not set yet.');
      return;
    }
    if (!moodboardCanvasRef.current) {
      setError('Moodboard canvas not ready.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const pngBase64 = moodboardCanvasRef.current.toDataURL('image/png');
      const res = await window.ckc.exportMoodboardPng({
        docId: selectedMoodboardDoc?.id ?? selectedMoodboardId ?? null,
        title: selectedMoodboardDoc?.title ?? 'Moodboard',
        pngBase64,
        outDir: exportRoot,
      });
      setLastExportPath(res.path);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [exportRoot, selectedMoodboardDoc?.id, selectedMoodboardDoc?.title, selectedMoodboardId]);

  // --- Image set export + share packs ---
  const [characters, setCharacters] = React.useState<CKCCharacterListItem[] | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<string | null>(initialCharacterId);
  const [selectedCharacter, setSelectedCharacter] = React.useState<CKCCharacter | null>(null);
  const [allTags, setAllTags] = React.useState<string[]>([]);
  const [mediaSelectedIds, setMediaSelectedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    window.ckc
      .listCharacters({ queryText: '', tagFilters: [] })
      .then((rows: any) => {
        const list = Array.isArray(rows) ? (rows as CKCCharacterListItem[]) : [];
        setCharacters(list);
        if (!selectedCharacterId && list[0]?.id) setSelectedCharacterId(list[0].id);
      })
      .catch(() => setCharacters([]));
    window.ckc
      .listAllTags()
      .then((rows: any) => setAllTags(isStringArray(rows) ? rows : []))
      .catch(() => setAllTags([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const cid = String(selectedCharacterId ?? '').trim();
    if (!cid) {
      setSelectedCharacter(null);
      setMediaSelectedIds([]);
      return;
    }
    setError(null);
    window.ckc
      .getCharacter(cid)
      .then((c) => setSelectedCharacter(c))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setSelectedCharacter(null);
      });
  }, [selectedCharacterId]);

  const allImageIds = React.useMemo(() => {
    return (selectedCharacter?.images || []).map((i) => i.id);
  }, [selectedCharacter?.images]);

  const exportImageSet = React.useCallback(
    async (mode: 'selected' | 'all') => {
      if (!exportRoot) {
        setError('Export folder is not set yet.');
        return;
      }
      const cid = String(selectedCharacterId ?? '').trim();
      if (!cid) {
        setError('Choose a character first.');
        return;
      }
      const imageIds = mode === 'all' ? allImageIds : mediaSelectedIds;
      if (!imageIds.length) {
        setError(mode === 'all' ? 'This character has no images.' : 'No images selected.');
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const res = await window.ckc.exportImageSet({ characterId: cid, imageIds, outDir: exportRoot });
        setLastExportPath(res.outDir);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [exportRoot, selectedCharacterId, mediaSelectedIds, allImageIds]
  );

  // Share pack doc picks
  const [notesDocs, setNotesDocs] = React.useState<CKCDocListItem[] | null>(null);
  const [storiesDocs, setStoriesDocs] = React.useState<CKCDocListItem[] | null>(null);
  const [moodboardDocs, setMoodboardDocs] = React.useState<CKCDocListItem[] | null>(null);
  const [shareIncludeSheet, setShareIncludeSheet] = React.useState<boolean>(true);
  const [shareImagesMode, setShareImagesMode] = React.useState<'selected' | 'all' | 'none'>('selected');
  const [shareNotesIds, setShareNotesIds] = React.useState<string[]>([]);
  const [shareStoriesIds, setShareStoriesIds] = React.useState<string[]>([]);
  const [shareMoodboardIds, setShareMoodboardIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    // Lazy-ish load docs once; lists are global (not per character).
    window.ckc.listDocs({ docType: 'notes' }).then((rows: any) => setNotesDocs(Array.isArray(rows) ? rows : [])).catch(() => setNotesDocs([]));
    window.ckc.listDocs({ docType: 'stories' }).then((rows: any) => setStoriesDocs(Array.isArray(rows) ? rows : [])).catch(() => setStoriesDocs([]));
    window.ckc.listDocs({ docType: 'moodboard' }).then((rows: any) => setMoodboardDocs(Array.isArray(rows) ? rows : [])).catch(() => setMoodboardDocs([]));
  }, []);

  const shareImageIds = React.useMemo(() => {
    if (shareImagesMode === 'none') return [];
    return shareImagesMode === 'all' ? allImageIds : mediaSelectedIds;
  }, [shareImagesMode, allImageIds, mediaSelectedIds]);

  const exportSharePack = React.useCallback(async () => {
    if (!exportRoot) {
      setError('Export folder is not set yet.');
      return;
    }
    const cid = String(selectedCharacterId ?? '').trim();
    if (!cid) {
      setError('Choose a character first.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await window.ckc.exportSharePack({
        characterId: cid,
        outDir: exportRoot,
        includeSheet: shareIncludeSheet,
        imageIds: shareImageIds,
        docIdsByType: {
          notes: shareNotesIds,
          stories: shareStoriesIds,
          moodboard: shareMoodboardIds,
        },
      });
      setLastExportPath(res.outDir);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    exportRoot,
    selectedCharacterId,
    shareIncludeSheet,
    shareImageIds,
    shareNotesIds,
    shareStoriesIds,
    shareMoodboardIds,
  ]);

  const toggleIdInList = React.useCallback((id: string, list: string[], setList: (next: string[]) => void) => {
    const v = String(id || '').trim();
    if (!v) return;
    const has = list.includes(v);
    setList(has ? list.filter((x) => x !== v) : [...list, v]);
  }, []);

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.btnSecondary} onClick={onBack} disabled={busy}>
            Back
          </button>
          <div className={styles.title}>Export Hub</div>
        </div>
        <div className={styles.headerRight}>
          {lastExportPath ? (
            <button className={styles.btnSecondary} onClick={() => void window.ckc.openPath(lastExportPath)} disabled={busy}>
              Open last
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Output folder</div>
        <div className={styles.row}>
          <div className={styles.label}>Data folder</div>
          <code className={styles.code}>{libraryRoot ?? '(unknown)'}</code>
        </div>
        <div className={styles.row}>
          <div className={styles.label}>Exports folder</div>
          <code className={styles.code}>{exportRoot ?? '(not set)'}</code>
        </div>
        <div className={styles.row}>
          <button className={styles.btnSecondary} onClick={() => exportRoot && void window.ckc.openPath(exportRoot)} disabled={!exportRoot || busy}>
            Open exports
          </button>
          <button className={styles.btnSecondary} onClick={() => void chooseExportRoot()} disabled={busy}>
            Choose…
          </button>
          <button className={styles.btnSecondary} onClick={() => void resetExportRoot()} disabled={busy || !exportRootOverride}>
            Reset to default
          </button>
          <span className={styles.muted}>
            Default: <code>{defaultExportsDir ?? '(unknown)'}</code>
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Moodboard → PNG</div>
          <div className={styles.row}>
            <div className={styles.label}>Moodboard</div>
            <select
              className={styles.select}
              value={selectedMoodboardId ?? ''}
              onChange={(e) => setSelectedMoodboardId(e.target.value)}
              disabled={busy}
            >
              {(moodboards || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title || d.id}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.preview}>
            <MoodboardCanvas value={moodboardState} onChange={() => {}} canvasRefOverride={moodboardCanvasRef} />
          </div>

          <div className={styles.row}>
            <button className={styles.btnSecondary} onClick={() => void exportMoodboardPng()} disabled={busy || !exportRoot || !selectedMoodboardId}>
              Export PNG
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Image set export</div>
          <div className={styles.row}>
            <div className={styles.label}>Character</div>
            <select
              className={styles.select}
              value={selectedCharacterId ?? ''}
              onChange={(e) => setSelectedCharacterId(e.target.value)}
              disabled={busy}
            >
              {(characters || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName || c.id}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.mediaBox} aria-label="Image picker">
            <MediaPane
              images={selectedCharacter?.images || []}
              allTags={allTags}
              defaultShowThumbnails={true}
              defaultShowControls={true}
              emptyLabel="No images for this character."
              onSelectionChange={(ids) => setMediaSelectedIds(ids)}
            />
          </div>

          <div className={styles.row}>
            <button className={styles.btnSecondary} onClick={() => void exportImageSet('selected')} disabled={busy || !selectedCharacterId}>
              Export selected ({mediaSelectedIds.length})
            </button>
            <button className={styles.btnSecondary} onClick={() => void exportImageSet('all')} disabled={busy || !selectedCharacterId}>
              Export all ({allImageIds.length})
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Share pack (per character)</div>

          <div className={styles.row}>
            <label className={styles.inlineLabel}>
              <input type="checkbox" checked={shareIncludeSheet} onChange={(e) => setShareIncludeSheet(e.target.checked)} disabled={busy} /> Include
              sheet
            </label>

            <div className={styles.inlineLabel}>
              Images:
              <select className={styles.select} value={shareImagesMode} onChange={(e) => setShareImagesMode(e.target.value as any)} disabled={busy}>
                <option value="selected">Selected ({mediaSelectedIds.length})</option>
                <option value="all">All ({allImageIds.length})</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <details className={styles.details}>
            <summary>Docs to include</summary>
            <div className={styles.docsGrid}>
              <div className={styles.docsCol}>
                <div className={styles.docsTitle}>Notes ({shareNotesIds.length})</div>
                <div className={styles.docsList}>
                  {(notesDocs || []).map((d) => (
                    <label key={d.id} className={styles.docsItem}>
                      <input
                        type="checkbox"
                        checked={shareNotesIds.includes(d.id)}
                        onChange={() => toggleIdInList(d.id, shareNotesIds, setShareNotesIds)}
                        disabled={busy}
                      />
                      <span title={d.id}>{d.title || d.id}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.docsCol}>
                <div className={styles.docsTitle}>Stories ({shareStoriesIds.length})</div>
                <div className={styles.docsList}>
                  {(storiesDocs || []).map((d) => (
                    <label key={d.id} className={styles.docsItem}>
                      <input
                        type="checkbox"
                        checked={shareStoriesIds.includes(d.id)}
                        onChange={() => toggleIdInList(d.id, shareStoriesIds, setShareStoriesIds)}
                        disabled={busy}
                      />
                      <span title={d.id}>{d.title || d.id}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.docsCol}>
                <div className={styles.docsTitle}>Moodboards ({shareMoodboardIds.length})</div>
                <div className={styles.docsList}>
                  {(moodboardDocs || []).map((d) => (
                    <label key={d.id} className={styles.docsItem}>
                      <input
                        type="checkbox"
                        checked={shareMoodboardIds.includes(d.id)}
                        onChange={() => toggleIdInList(d.id, shareMoodboardIds, setShareMoodboardIds)}
                        disabled={busy}
                      />
                      <span title={d.id}>{d.title || d.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <div className={styles.row}>
            <button className={styles.btnSecondary} onClick={() => void exportSharePack()} disabled={busy || !selectedCharacterId}>
              Export share pack
            </button>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.muted}>
          Exports land under <code>{exportRoot ?? '(not set)'}</code> and create subfolders like <code>image_sets/</code>,{' '}
          <code>share_packs/</code>, and <code>moodboards/</code>.
        </div>
        {configPath ? (
          <div className={styles.muted}>
            Config: <code>{String(configPath)}</code>
          </div>
        ) : null}
      </div>
    </div>
  );
}

import React from 'react';
import { MediaPane } from '../components/MediaPane';
import { CommandBar } from '../components/CommandBar';
import { useElementWidth } from '../hooks/useElementWidth';
import styles from './libraryView.module.css';

function joinPath(a: string, b: string): string {
  const left = String(a || '').replace(/[\\/]+$/, '');
  if (!left) return String(b || '');
  return `${left}\\${String(b || '').replace(/^[\\/]+/, '')}`;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function tagsTextToArray(text: string): string[] {
  const parts = String(text || '')
    .split(/[,\n\r\t]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

export function LibraryView({ onOpenCharacter }: { onOpenCharacter: (characterId: string) => void }) {
  const splitterPx = 10;
  const minLeftPx = 360;
  const minRightPx = 420;

  const [characters, setCharacters] = React.useState<CKCCharacterListItem[] | null>(null);
  const [carouselImages, setCarouselImages] = React.useState<
    Array<{ id: string; favorite: boolean; rating: number; notes: string; tags: string[] }>
  >([]);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState<number>(0);
  const [showCommandBar, setShowCommandBar] = React.useState<boolean>(false);
  const [showExportsBar, setShowExportsBar] = React.useState<boolean>(false);
  const [showLibraryBar, setShowLibraryBar] = React.useState<boolean>(false);

  const [queryText, setQueryText] = React.useState<string>('');
  const [favoriteOnly, setFavoriteOnly] = React.useState<boolean>(false);
  const [ratingOp, setRatingOp] = React.useState<'any' | '=' | '<' | '<=' | '>' | '>='>('any');
  const [ratingValue, setRatingValue] = React.useState<number>(0);
  const [scopeFlags, setScopeFlags] = React.useState<{
    ids: boolean;
    labels: boolean;
    values: boolean;
    tags: boolean;
    name: boolean;
  }>({
    ids: true,
    labels: true,
    values: true,
    tags: true,
    name: true,
  });
  const [tagFilters, setTagFilters] = React.useState<string[]>([]);
  const [tagDraft, setTagDraft] = React.useState<string>('');
  const [allTags, setAllTags] = React.useState<string[]>([]);

  const [savedSearches, setSavedSearches] = React.useState<CKCSavedSearch[] | null>(null);
  const [selectedSavedSearchId, setSelectedSavedSearchId] = React.useState<string>('');
  const [savedSearchName, setSavedSearchName] = React.useState<string>('');
  const [savedSearchError, setSavedSearchError] = React.useState<string | null>(null);

  const [libraryRoot, setLibraryRoot] = React.useState<string | null>(null);
  const [configPath, setConfigPath] = React.useState<string | null>(null);
  const [defaultLibraryRootInfo, setDefaultLibraryRootInfo] = React.useState<{
    isPortable: boolean;
    portableDir: string | null;
    defaultLibraryRoot: string;
  } | null>(null);

  const [layoutRef, layoutWidth] = useElementWidth<HTMLDivElement>();
  const [libraryLeftFrac, setLibraryLeftFrac] = React.useState<number>(0.55);
  const libraryLeftFracRef = React.useRef<number>(libraryLeftFrac);
  const libraryResizeRef = React.useRef<{ startX: number; startLeftPx: number } | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<CKCLibraryDiagnostics | null>(null);
  const [diagnosticsError, setDiagnosticsError] = React.useState<string | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = React.useState<boolean>(false);
  const [repairScanDir, setRepairScanDir] = React.useState<string>('');
  const [repairIncludeSubdirs, setRepairIncludeSubdirs] = React.useState<boolean>(true);
  const [repairBusy, setRepairBusy] = React.useState<boolean>(false);
  const [repairError, setRepairError] = React.useState<string | null>(null);
  const [repairResult, setRepairResult] = React.useState<CKCRepairMissingImagesByHashResult | null>(null);
  const [exportDir, setExportDir] = React.useState<string | null>(null);
  const [templateAst, setTemplateAst] = React.useState<CKCTemplateAst | null>(null);
  const [exportSections, setExportSections] = React.useState<string[] | null>(null);
  const [spinOffs, setSpinOffs] = React.useState<CKCSpinOffListItem[] | null>(null);
  const [selectedSpinOffId, setSelectedSpinOffId] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);

  const defaultExportsDir = React.useMemo(() => {
    return libraryRoot ? joinPath(libraryRoot, 'exports') : null;
  }, [libraryRoot]);

  React.useEffect(() => {
    libraryLeftFracRef.current = libraryLeftFrac;
  }, [libraryLeftFrac]);

  React.useEffect(() => {
    window.ckc.getDefaultLibraryRootInfo().then(setDefaultLibraryRootInfo).catch(() => setDefaultLibraryRootInfo(null));
  }, []);

  React.useEffect(() => {
    window.ckc
      .getConfigInfo()
      .then((info) => {
        setConfigPath(typeof info?.configPath === 'string' ? info.configPath : null);
        const cfg: any = info?.config ?? null;
        if (typeof cfg?.libraryRoot === 'string') setLibraryRoot(cfg.libraryRoot);
        const lf = (cfg?.layoutLibrary2 && typeof cfg.layoutLibrary2 === 'object' ? cfg.layoutLibrary2 : null) as any;
        if (typeof lf?.leftFrac === 'number') setLibraryLeftFrac(clamp01(lf.leftFrac));
      })
      .catch(() => {
        window.ckc
          .getConfig()
          .then((cfg: any) => {
            if (typeof cfg?.libraryRoot === 'string') setLibraryRoot(cfg.libraryRoot);
            const lf = (cfg?.layoutLibrary2 && typeof cfg.layoutLibrary2 === 'object' ? cfg.layoutLibrary2 : null) as any;
            if (typeof lf?.leftFrac === 'number') setLibraryLeftFrac(clamp01(lf.leftFrac));
          })
          .catch(() => {});
      });
  }, []);

  React.useEffect(() => {
    window.ckc
      .getTemplate()
      .then((ast) => setTemplateAst(ast))
      .catch(() => setTemplateAst(null));
  }, [refreshNonce]);

  React.useEffect(() => {
    window.ckc
      .listAllTags()
      .then((rows) => setAllTags(Array.isArray(rows) ? rows.map((t) => String(t)) : []))
      .catch(() => setAllTags([]));
  }, [refreshNonce]);

  const reloadSavedSearches = React.useCallback(() => {
    setSavedSearchError(null);
    window.ckc
      .listSavedSearches()
      .then((rows) => setSavedSearches(rows))
      .catch((err: unknown) => {
        setSavedSearchError(err instanceof Error ? err.message : String(err));
        setSavedSearches([]);
      });
  }, []);

  React.useEffect(() => {
    reloadSavedSearches();
  }, [reloadSavedSearches, refreshNonce]);

  React.useEffect(() => {
    window.ckc
      .listSpinOffs({})
      .then((rows) => {
        setSpinOffs(rows);
        const safe = rows.find((r) => String(r.name || '').toLowerCase().includes('safe subset'));
        setSelectedSpinOffId((safe?.id ?? rows[0]?.id ?? null) as any);
      })
      .catch((err: unknown) => setExportError(err instanceof Error ? err.message : String(err)));
  }, [refreshNonce]);

  const selectedSavedSearch = React.useMemo(() => {
    if (!savedSearches) return null;
    return savedSearches.find((s) => s.id === selectedSavedSearchId) ?? null;
  }, [savedSearches, selectedSavedSearchId]);

  const savedSearchNameKey = React.useMemo(() => savedSearchName.trim().toLowerCase(), [savedSearchName]);
  const nameConflict = React.useMemo(() => {
    if (!savedSearches) return false;
    const match = savedSearches.find((s) => s.name.trim().toLowerCase() === savedSearchNameKey);
    return !!match && match.id !== selectedSavedSearchId;
  }, [savedSearches, savedSearchNameKey, selectedSavedSearchId]);

  const cleanedTagFilters = React.useMemo(() => {
    const cleaned = tagFilters.map((t) => String(t).trim()).filter(Boolean);
    const seen = new Set<string>();
    const out = [];
    for (const t of cleaned) {
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }, [tagFilters]);

  const tagsDatalistId = React.useId();

  const reloadCarousel = React.useCallback(() => {
    window.ckc
      .listGlobalCarouselImages({ preferFrontpage: true })
      .then((rows) => {
        setCarouselImages(
          (rows || []).map((img) => ({
            id: img.id,
            favorite: img.favorite,
            rating: img.rating,
            notes: img.notes,
            tags: img.tags || [],
          }))
        );
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const rows = await window.ckc.listCharacters({
          queryText,
          tagFilters: cleanedTagFilters,
          scopeFlags,
          galleryFilters: {
            favoriteOnly,
            ratingOp: ratingOp === 'any' ? null : ratingOp,
            ratingValue,
          },
        });
        if (cancelled) return;
        setCharacters(rows);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [queryText, cleanedTagFilters, scopeFlags, favoriteOnly, ratingOp, ratingValue, refreshNonce]);

  React.useEffect(() => {
    reloadCarousel();
  }, [reloadCarousel, refreshNonce]);

  const reloadDiagnostics = React.useCallback(async () => {
    setDiagnosticsError(null);
    setDiagnosticsBusy(true);
    try {
      const res = await window.ckc.getLibraryDiagnostics({ topN: 10 });
      setDiagnostics(res);
    } catch (err: unknown) {
      setDiagnosticsError(err instanceof Error ? err.message : String(err));
      setDiagnostics(null);
    } finally {
      setDiagnosticsBusy(false);
    }
  }, []);

  const runRepair = React.useCallback(
    async (dryRun: boolean) => {
      const scanDir = String(repairScanDir || '').trim();
      if (!scanDir) {
        setRepairError('Pick a scan folder first.');
        return;
      }
      setRepairError(null);
      setRepairBusy(true);
      try {
        const res = await window.ckc.repairMissingImagesByHash({ scanDir, includeSubdirs: repairIncludeSubdirs, dryRun });
        setRepairResult(res);
        setDiagnostics(null);
        setRefreshNonce((n) => n + 1);
        void reloadDiagnostics();
        void reloadCarousel();
      } catch (err: unknown) {
        setRepairError(err instanceof Error ? err.message : String(err));
        setRepairResult(null);
      } finally {
        setRepairBusy(false);
      }
    },
    [repairScanDir, repairIncludeSubdirs, reloadDiagnostics, reloadCarousel]
  );

  React.useEffect(() => {
    if (!showLibraryBar) return;
    if (diagnosticsBusy) return;
    if (diagnostics) return;
    void reloadDiagnostics();
  }, [showLibraryBar, diagnostics, diagnosticsBusy, reloadDiagnostics]);

  const filteredCarouselImages = React.useMemo(() => {
    const op = ratingOp;
    const t = ratingValue;
    return carouselImages.filter((img) => {
      if (favoriteOnly && !img.favorite) return false;
      if (op === 'any') return true;
      const v = Number(img.rating) || 0;
      const n = Number(t) || 0;
      if (op === '=') return v === n;
      if (op === '<') return v < n;
      if (op === '<=') return v <= n;
      if (op === '>') return v > n;
      if (op === '>=') return v >= n;
      return true;
    });
  }, [carouselImages, favoriteOnly, ratingOp, ratingValue]);

  const applySavedSearch = React.useCallback((ss: CKCSavedSearch) => {
    setQueryText(String(ss.queryText || ''));

    const gf = (ss.galleryFilters && typeof ss.galleryFilters === 'object' ? ss.galleryFilters : {}) as any;
    setFavoriteOnly(!!gf.favoriteOnly);
    const rawOp = gf.ratingOp != null ? String(gf.ratingOp) : null;
    const op = rawOp && ['=', '<', '<=', '>', '>='].includes(rawOp) ? (rawOp as any) : null;
    setRatingOp(op ?? 'any');
    setRatingValue(Number.isFinite(Number(gf.ratingValue)) ? Number(gf.ratingValue) : 0);

    const tf = Array.isArray(ss.tagFilters) ? ss.tagFilters.map((t) => String(t).trim()).filter(Boolean) : [];
    setTagFilters(tf);

    const sf = (ss.scopeFlags && typeof ss.scopeFlags === 'object' ? ss.scopeFlags : {}) as any;
    setScopeFlags({
      ids: sf.ids !== false,
      labels: sf.labels !== false,
      values: sf.values !== false,
      tags: sf.tags !== false,
      name: sf.name !== false,
    });
  }, []);

  const addTagFiltersFromText = React.useCallback(
    (text: string) => {
      const parts = tagsTextToArray(text);
      if (parts.length === 0) return;
      setTagFilters((prev) => {
        const next = [...prev];
        for (const p of parts) {
          const raw = String(p).trim();
          if (!raw) continue;
          const canonical = allTags.find((t) => String(t).toLowerCase() === raw.toLowerCase()) ?? raw;
          if (next.some((t) => String(t).toLowerCase() === String(canonical).toLowerCase())) continue;
          next.push(String(canonical));
        }
        return next;
      });
    },
    [allTags]
  );

  const addTagFilter = React.useCallback(() => {
    const draft = tagDraft;
    addTagFiltersFromText(draft);
    setTagDraft('');
  }, [tagDraft, addTagFiltersFromText]);

  const effectiveLibraryLeftFrac = React.useMemo(() => {
    const frac = clamp01(libraryLeftFrac);
    const w = Number(layoutWidth) || 0;
    if (w <= 0) return frac;
    const available = w - splitterPx;
    if (available <= 0) return frac;
    const min = minLeftPx / available;
    const max = 1 - minRightPx / available;
    if (min > max) return 0.5;
    return Math.max(min, Math.min(max, frac));
  }, [libraryLeftFrac, layoutWidth, splitterPx, minLeftPx, minRightPx]);

  const libraryGridTemplateColumns = React.useMemo(() => {
    const frac = effectiveLibraryLeftFrac;
    const pct = (frac * 100).toFixed(4);
    const px = (frac * splitterPx).toFixed(2);
    return `calc(${pct}% - ${px}px) ${splitterPx}px 1fr`;
  }, [effectiveLibraryLeftFrac, splitterPx]);

  const beginResizeLibrary = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const w = Number(layoutWidth) || 0;
      const available = w - splitterPx;
      if (available <= 0) return;

      libraryResizeRef.current = {
        startX: e.clientX,
        startLeftPx: effectiveLibraryLeftFrac * available,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    },
    [layoutWidth, splitterPx, effectiveLibraryLeftFrac]
  );

  const onResizeLibraryMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = libraryResizeRef.current;
      if (!st) return;

      const w = Number(layoutWidth) || 0;
      const available = w - splitterPx;
      if (available <= 0) return;

      const dx = e.clientX - st.startX;
      let nextLeftPx = st.startLeftPx + dx;

      const maxLeftPx = available - minRightPx;
      if (maxLeftPx < minLeftPx) {
        nextLeftPx = available / 2;
      } else {
        nextLeftPx = Math.max(minLeftPx, Math.min(maxLeftPx, nextLeftPx));
      }

      const nextFrac = clamp01(nextLeftPx / available);
      libraryLeftFracRef.current = nextFrac;
      setLibraryLeftFrac(nextFrac);
    },
    [layoutWidth, splitterPx, minLeftPx, minRightPx]
  );

  const endResizeLibrary = React.useCallback(() => {
    if (!libraryResizeRef.current) return;
    libraryResizeRef.current = null;

    const w = Number(layoutWidth) || 0;
    const available = w - splitterPx;
    const raw = clamp01(libraryLeftFracRef.current);

    let next = raw;
    if (available > 0) {
      const min = minLeftPx / available;
      const max = 1 - minRightPx / available;
      next = min > max ? 0.5 : Math.max(min, Math.min(max, raw));
    }

    setLibraryLeftFrac(next);
    libraryLeftFracRef.current = next;
    void window.ckc.setConfig({ layoutLibrary2: { leftFrac: next } });
  }, [layoutWidth, splitterPx, minLeftPx, minRightPx]);

  return (
    <div className={styles.layout} ref={layoutRef} style={{ gridTemplateColumns: libraryGridTemplateColumns }}>
      <section className={styles.left}>
        <MediaPane
          images={filteredCarouselImages}
          enableViewerSlideshow
          autoStartSlideshow
          emptyLabel="No global carousel images yet (tag an image with: carousel)."
          onOpenDiagnostics={() => setShowLibraryBar(true)}
          onPatchImageMeta={(imageId, patch) => {
            // Re-fetch to respect the global selection rule (prefer frontpage when present).
            void reloadCarousel();
          }}
        />
      </section>

      <div
        className={styles.splitter}
        role="separator"
        aria-orientation="vertical"
        title="Resize panels"
        onPointerDown={beginResizeLibrary}
        onPointerMove={onResizeLibraryMove}
        onPointerUp={endResizeLibrary}
        onPointerCancel={endResizeLibrary}
      />

      <aside className={styles.right}>
        <CommandBar isOpen={showLibraryBar} onToggle={() => setShowLibraryBar((v) => !v)} label="Library">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Config:</span>
            <code style={{ fontSize: '0.85rem' }}>{configPath ?? '(unknown)'}</code>
            <button
              disabled={!configPath}
              onClick={() => {
                if (!configPath) return;
                void window.ckc.openPath(configPath);
              }}
            >
              Open
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Library root:</span>
            <code style={{ fontSize: '0.85rem' }}>{libraryRoot ?? '(unknown)'}</code>
            <button
              disabled={!libraryRoot}
              onClick={() => {
                if (!libraryRoot) return;
                void window.ckc.openPath(libraryRoot);
              }}
            >
              Open folder
            </button>
            <button
              onClick={async () => {
                setError(null);
                const next = await window.ckc.selectLibraryRoot();
                if (!next) return;
                setLibraryRoot(next);
                setExportDir(null);
                setDiagnostics(null);
                setRefreshNonce((n) => n + 1);
                void reloadDiagnostics();
              }}
              title="Change the library root folder (db, characters, exports)"
            >
              Changeâ€¦
            </button>
            <button
              disabled={!defaultLibraryRootInfo}
              onClick={async () => {
                if (!defaultLibraryRootInfo) return;
                setError(null);
                const next = await window.ckc.resetLibraryRootToDefault();
                setLibraryRoot(next);
                setExportDir(null);
                setDiagnostics(null);
                setRefreshNonce((n) => n + 1);
                void reloadDiagnostics();
              }}
              title={
                defaultLibraryRootInfo?.isPortable
                  ? `Reset to portable default:\n${defaultLibraryRootInfo.defaultLibraryRoot}`
                  : `Reset to default:\n${defaultLibraryRootInfo?.defaultLibraryRoot ?? ''}`
              }
            >
              Reset
            </button>
            <button
              disabled={diagnosticsBusy}
              onClick={() => {
                setDiagnostics(null);
                void reloadDiagnostics();
                setRefreshNonce((n) => n + 1);
              }}
              title="Rescan missing media and refresh the view"
            >
              {diagnosticsBusy ? 'Scanningâ€¦' : 'Rescan'}
            </button>
          </div>

          {diagnosticsError ? <div className={styles.error}>{diagnosticsError}</div> : null}

          {diagnostics ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 800 }}>Media diagnostics</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                Images in DB: <b>{diagnostics.imageCount}</b> â€¢ Originals missing:{' '}
                <b>{diagnostics.originals?.missing ?? 0}</b> â€¢ Thumbs missing: <b>{diagnostics.thumbs?.missing ?? 0}</b>
              </div>

              {Array.isArray(diagnostics.missingCharacterFolders) && diagnostics.missingCharacterFolders.length > 0 ? (
                <details style={{ marginTop: 10 }}>
                  <summary>
                    Missing character folders: <b>{diagnostics.missingCharacterFolders.length}</b>
                  </summary>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {diagnostics.missingCharacterFolders.slice(0, 40).map((id) => (
                      <code key={id} style={{ fontSize: '0.85rem' }}>
                        {id}
                      </code>
                    ))}
                    {diagnostics.missingCharacterFolders.length > 40 ? (
                      <span style={{ color: 'var(--text-secondary)' }}>â€¦</span>
                    ) : null}
                  </div>
                </details>
              ) : null}

              {Array.isArray(diagnostics.topMissingByCharacter) && diagnostics.topMissingByCharacter.length > 0 ? (
                <details style={{ marginTop: 10 }} open>
                  <summary>Top missing images (by character)</summary>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diagnostics.topMissingByCharacter.map((c) => (
                      <div key={c.characterId} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <code style={{ fontSize: '0.85rem' }}>{c.characterId}</code>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          missing originals: <b>{c.missingOriginal}</b> / {c.totalImages}
                        </span>
                        {!c.hasCharacterFolder ? (
                          <span style={{ color: 'rgba(255,0,0,0.75)' }}>(folder missing)</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : (
                <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>
                  No missing originals detected.
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>
              {diagnosticsBusy ? 'Scanning libraryâ€¦' : 'Open this bar to scan for missing media.'}
            </div>
          )}

          <details style={{ marginTop: 12 }}>
            <summary>Repair missing images (by hash)</summary>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Scan folder:</span>
              <code style={{ fontSize: '0.85rem' }}>{repairScanDir ? repairScanDir : '(not selected)'}</code>
              <button
                disabled={repairBusy}
                onClick={async () => {
                  setRepairError(null);
                  const dir = await window.ckc.selectFolderDialog({ title: 'Select scan folder (recovery dump)' });
                  if (!dir) return;
                  setRepairScanDir(dir);
                }}
              >
                Choose folderâ€¦
              </button>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={repairIncludeSubdirs}
                  onChange={(e) => setRepairIncludeSubdirs(e.target.checked)}
                  disabled={repairBusy}
                />{' '}
                Include subfolders
              </label>
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button disabled={repairBusy} onClick={() => void runRepair(true)}>
                {repairBusy ? 'Workingâ€¦' : 'Dry-run'}
              </button>
              <button disabled={repairBusy} onClick={() => void runRepair(false)} title="Copies matched files into the libraryRoot character folders">
                {repairBusy ? 'Workingâ€¦' : 'Run repair'}
              </button>
              {repairResult?.reportPath ? (
                <button onClick={() => void window.ckc.openPath(repairResult.reportPath)} disabled={repairBusy}>
                  Open report
                </button>
              ) : null}
            </div>

            {repairError ? <div className={styles.error}>{repairError}</div> : null}

            {repairResult ? (
              <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>
                Planned: <b>{repairResult.plannedActions}</b> â€¢ Copied: <b>{repairResult.copied}</b> â€¢ Thumbs created:{' '}
                <b>{repairResult.thumbsCreated}</b> â€¢ Copy errors: <b>{repairResult.copyErrors}</b>
              </div>
            ) : null}
          </details>
        </CommandBar>

        <CommandBar isOpen={showCommandBar} onToggle={() => setShowCommandBar((v) => !v)} label="Search / Filters">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Saved{' '}
              <select
                value={selectedSavedSearchId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedSavedSearchId(id);
                  const ss = savedSearches?.find((s) => s.id === id) ?? null;
                  if (ss) {
                    setSavedSearchName(ss.name);
                    applySavedSearch(ss);
                  } else {
                    setSavedSearchName('');
                  }
                }}
                disabled={!savedSearches}
              >
                <option value="">(none)</option>
                {(savedSearches || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isBuiltin ? ' (built-in)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Name{' '}
              <input
                value={savedSearchName}
                onChange={(e) => setSavedSearchName(e.target.value)}
                placeholder="Saved search name"
                style={{ width: 220 }}
              />
            </label>

            <button
              disabled={!savedSearchName.trim() || (savedSearches || []).some((s) => s.name.trim().toLowerCase() === savedSearchNameKey)}
              onClick={async () => {
                setSavedSearchError(null);
                try {
                  const id = await window.ckc.createSavedSearch({
                    name: savedSearchName.trim(),
                    queryText,
                    scopeFlags,
                    tagFilters: cleanedTagFilters,
                    galleryFilters: {
                      favoriteOnly,
                      ratingOp: ratingOp === 'any' ? null : ratingOp,
                      ratingValue,
                    },
                  });
                  reloadSavedSearches();
                  setSelectedSavedSearchId(id);
                } catch (err: unknown) {
                  setSavedSearchError(err instanceof Error ? err.message : String(err));
                }
              }}
              title="Save a new search with the current query + filters"
            >
              Save new
            </button>

            <button
              disabled={!selectedSavedSearchId || !!selectedSavedSearch?.isBuiltin || !savedSearchName.trim() || nameConflict}
              onClick={async () => {
                setSavedSearchError(null);
                try {
                  await window.ckc.updateSavedSearch({
                    searchId: selectedSavedSearchId,
                    name: savedSearchName.trim(),
                    queryText,
                    scopeFlags,
                    tagFilters: cleanedTagFilters,
                    galleryFilters: {
                      favoriteOnly,
                      ratingOp: ratingOp === 'any' ? null : ratingOp,
                      ratingValue,
                    },
                  });
                  reloadSavedSearches();
                } catch (err: unknown) {
                  setSavedSearchError(err instanceof Error ? err.message : String(err));
                }
              }}
              title={selectedSavedSearch?.isBuiltin ? 'Built-in searches cannot be updated' : 'Update the selected saved search'}
            >
              Update
            </button>

            <button
              disabled={!selectedSavedSearchId || !!selectedSavedSearch?.isBuiltin}
              onClick={async () => {
                setSavedSearchError(null);
                try {
                  await window.ckc.deleteSavedSearch(selectedSavedSearchId);
                  setSelectedSavedSearchId('');
                  setSavedSearchName('');
                  reloadSavedSearches();
                } catch (err: unknown) {
                  setSavedSearchError(err instanceof Error ? err.message : String(err));
                }
              }}
              title={selectedSavedSearch?.isBuiltin ? 'Built-in searches cannot be deleted' : 'Delete the selected saved search'}
            >
              Delete
            </button>
          </div>

          {savedSearchError ? <div className={styles.error}>{savedSearchError}</div> : null}

          <label>
            Search{' '}
            <input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Name, tags, fields…"
              style={{ width: 220 }}
            />
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Scope:</span>
            {(
              [
                ['name', 'Name'],
                ['tags', 'Tags'],
                ['ids', 'IDs'],
                ['labels', 'Labels'],
                ['values', 'Values'],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={scopeFlags[key]}
                  onChange={(e) => setScopeFlags((prev) => ({ ...prev, [key]: e.target.checked }))}
                />{' '}
                {label}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Tag filter:</span>
            {cleanedTagFilters.map((t) => (
              <button
                key={t}
                className={styles.characterItem}
                style={{ padding: '4px 8px', background: 'transparent' }}
                onClick={() => setTagFilters((prev) => prev.filter((x) => String(x).toLowerCase() !== String(t).toLowerCase()))}
                title="Remove tag filter"
              >
                {t} ×
              </button>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTagFilter();
                }
              }}
              placeholder="tag"
              list={tagsDatalistId}
              style={{ width: 160 }}
            />
            <button onClick={addTagFilter} disabled={!tagDraft.trim()}>
              Add
            </button>
            <button onClick={() => setTagFilters([])} disabled={cleanedTagFilters.length === 0} title="Clear tag filters">
              Clear tags
            </button>
            <datalist id={tagsDatalistId}>
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>All tags ({allTags.length})</summary>
            <div
              style={{
                marginTop: 8,
                maxHeight: 120,
                overflow: 'auto',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                padding: 8,
                border: '1px solid var(--glass-border)',
                background: 'rgba(0,0,0,0.02)',
              }}
            >
              {allTags.slice(0, 200).map((t) => (
                <button
                  key={t}
                  className={styles.characterItem}
                  style={{ padding: '4px 8px', background: 'transparent' }}
                  onClick={() => addTagFiltersFromText(t)}
                  title="Add tag filter"
                >
                  {t}
                </button>
              ))}
              {allTags.length > 200 ? <span style={{ color: 'var(--text-secondary)' }}>…</span> : null}
            </div>
          </details>

          <label>
            <input type="checkbox" checked={favoriteOnly} onChange={(e) => setFavoriteOnly(e.target.checked)} /> Favorites only
          </label>
          <label>
            Rating{' '}
            <select value={ratingOp} onChange={(e) => setRatingOp(e.target.value as any)}>
              <option value="any">Any</option>
              <option value="=">=</option>
              <option value=">=">≥</option>
              <option value="<=">≤</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
            </select>{' '}
            <select value={String(ratingValue)} onChange={(e) => setRatingValue(Number(e.target.value) || 0)}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setQueryText('');
              setFavoriteOnly(false);
              setRatingOp('any');
              setRatingValue(0);
              setScopeFlags({ ids: true, labels: true, values: true, tags: true, name: true });
              setTagFilters([]);
              setTagDraft('');
              setSelectedSavedSearchId('');
              setSavedSearchName('');
            }}
          >
            Clear
          </button>
        </CommandBar>

        <div style={{ marginTop: 10 }}>
          <CommandBar isOpen={showExportsBar} onToggle={() => setShowExportsBar((v) => !v)} label="Exports">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Output:</span>
              <code style={{ fontSize: '0.85rem' }}>{exportDir ?? '(default exports folder)'}</code>
              <button
                onClick={async () => {
                  setExportError(null);
                  const dir = await window.ckc.selectFolderDialog({ title: 'Select export folder' });
                  if (!dir) return;
                  setExportDir(dir);
                }}
              >
                Choose folder…
              </button>
              {exportDir ? (
                <button onClick={() => setExportDir(null)} title="Use libraryRoot\\exports">
                  Default
                </button>
              ) : null}
              <button
                disabled={!(exportDir || defaultExportsDir)}
                onClick={() => {
                  const target = exportDir || defaultExportsDir;
                  if (!target) return;
                  void window.ckc.openPath(target);
                }}
              >
                Open folder
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                disabled={isExporting}
                onClick={async () => {
                  setExportError(null);
                  setIsExporting(true);
                  try {
                    const res = await window.ckc.exportEmptyTemplate({ outDir: exportDir });
                    setLastExportPath(res.path);
                  } catch (err: unknown) {
                    setExportError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setIsExporting(false);
                  }
                }}
              >
                Export empty template
              </button>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Preset{' '}
                <select
                  value={selectedSpinOffId ?? ''}
                  onChange={(e) => setSelectedSpinOffId(e.target.value || null)}
                  disabled={!spinOffs || spinOffs.length === 0}
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
                disabled={isExporting || !selectedSpinOffId}
                onClick={async () => {
                  setExportError(null);
                  setIsExporting(true);
                  try {
                    const res = await window.ckc.exportTemplateFieldPack({
                      outDir: exportDir,
                      spinoffId: selectedSpinOffId,
                      includeSections: exportSections,
                    });
                    setLastExportPath(res.path);
                  } catch (err: unknown) {
                    setExportError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setIsExporting(false);
                  }
                }}
              >
                Export LLM empty
              </button>

              {lastExportPath ? (
                <button
                  onClick={() => {
                    void window.ckc.openPath(lastExportPath);
                  }}
                >
                  Open last
                </button>
              ) : null}
            </div>

            {templateAst ? (
              <details style={{ marginTop: 10 }}>
                <summary>Sections (optional)</summary>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                  <button onClick={() => setExportSections(null)} disabled={isExporting} title="Reset to all sections">
                    All sections
                  </button>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Applies to: <code>Export LLM empty</code>
                  </span>
                </div>

                <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(templateAst.sections || []).map((s) => {
                    const all = (templateAst.sections || []).map((x) => x.title);
                    const checked = exportSections === null ? true : (exportSections || []).includes(s.title);
                    return (
                      <label key={s.title} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const wantOn = e.target.checked;
                            setExportSections((prev) => {
                              const cur = prev === null ? all : prev || [];
                              const next = wantOn ? Array.from(new Set([...cur, s.title])) : cur.filter((t) => t !== s.title);
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
              </details>
            ) : null}

            {exportError ? <div className={styles.error}>{exportError}</div> : null}
            {lastExportPath ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Last export: <code>{lastExportPath}</code>
              </div>
            ) : null}
          </CommandBar>
        </div>

        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>Characters</div>
          <div className={styles.panelSubtitle}>Select a character to edit the sheet.</div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}
        {characters === null ? (
          <div className={styles.muted}>Loading…</div>
        ) : characters.length === 0 ? (
          <div className={styles.muted}>No characters found.</div>
        ) : (
          <div className={styles.characterList}>
            {characters.map((c) => (
              <button key={c.id} className={styles.characterItem} onClick={() => onOpenCharacter(c.id)}>
                <div className={styles.characterItemInner}>
                  <div className={styles.characterIcon}>
                    {c.iconImageId ? (
                      <img
                        className={styles.characterIconImg}
                        src={`ckc://thumb/${encodeURIComponent(c.iconImageId)}`}
                        alt=""
                        style={{
                          objectPosition: `${Math.round(clamp01(c.iconFocusX) * 100)}% ${Math.round(clamp01(c.iconFocusY) * 100)}%`,
                        }}
                      />
                    ) : (
                      <div className={styles.characterIconPlaceholder}>No icon</div>
                    )}
                  </div>

                  <div className={styles.characterText}>
                    <div className={styles.characterName}>{c.displayName}</div>
                    <div className={styles.characterMeta}>
                      {c.templateId} {c.templateVersion}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              setError(null);
              try {
                const characterId = await window.ckc.createCharacter({ displayName: 'Unnamed' });
                onOpenCharacter(characterId);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            New character
          </button>
          <button
            onClick={async () => {
              setError(null);
              try {
                const res = await window.ckc.importCharacterFromSheetDialog();
                if (res?.characterId) onOpenCharacter(res.characterId);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : String(err));
              }
            }}
          >
            Import from sheet…
          </button>
        </div>
      </aside>
    </div>
  );
}

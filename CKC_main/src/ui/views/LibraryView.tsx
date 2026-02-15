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

function formatBytes(bytes: number): string {
  const b = Number(bytes) || 0;
  if (b <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = b;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  const fixed = u === 0 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toFixed(fixed)} ${units[u]}`;
}

function isEditableActiveElement(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function tagsTextToArray(text: string): string[] {
  const parts = String(text || '')
    .split(/[,\n\r\t]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function dedupeTagsCaseInsensitive(tags: string[]): string[] {
  const cleaned = (tags || []).map((t) => String(t).trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of cleaned) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function LibraryView({
  onOpenCharacter,
  onOpenExports,
}: {
  onOpenCharacter: (characterId: string, selectImageId?: string | null) => void;
  onOpenExports?: () => void;
}) {
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
  const [showInboxBar, setShowInboxBar] = React.useState<boolean>(false);
  const [showTagsBar, setShowTagsBar] = React.useState<boolean>(false);
  const [leftMode, setLeftMode] = React.useState<'carousel' | 'inbox'>('carousel');

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
  const [pinnedTags, setPinnedTags] = React.useState<string[]>([]);
  const [tagStats, setTagStats] = React.useState<CKCTagStats[] | null>(null);
  const [tagManagerQuery, setTagManagerQuery] = React.useState<string>('');
  const [tagManagerBusy, setTagManagerBusy] = React.useState<boolean>(false);
  const [tagManagerMutating, setTagManagerMutating] = React.useState<boolean>(false);
  const [tagManagerError, setTagManagerError] = React.useState<string | null>(null);

  const [inboxDir, setInboxDir] = React.useState<string>('');
  const [inboxIncludeSubdirs, setInboxIncludeSubdirs] = React.useState<boolean>(false);
  const [inboxImages, setInboxImages] = React.useState<
    Array<{ id: string; favorite: boolean; rating: number; notes: string; tags: string[]; addedAt: string }>
  >([]);
  const [inboxSelectedIds, setInboxSelectedIds] = React.useState<string[]>([]);
  const [inboxPrimaryId, setInboxPrimaryId] = React.useState<string | null>(null);
  const [inboxBusy, setInboxBusy] = React.useState<boolean>(false);
  const [inboxError, setInboxError] = React.useState<string | null>(null);
  const [inboxLastScan, setInboxLastScan] = React.useState<{ scanned: number; imported: number; duplicates: number } | null>(null);
  const [inboxAssignCharacters, setInboxAssignCharacters] = React.useState<CKCCharacterListItem[] | null>(null);
  const [inboxAssignTargetId, setInboxAssignTargetId] = React.useState<string>('');
  const [inboxAssignError, setInboxAssignError] = React.useState<string | null>(null);

  const [savedSearches, setSavedSearches] = React.useState<CKCSavedSearch[] | null>(null);
  const [selectedSavedSearchId, setSelectedSavedSearchId] = React.useState<string>('');
  const [savedSearchName, setSavedSearchName] = React.useState<string>('');
  const [savedSearchError, setSavedSearchError] = React.useState<string | null>(null);

  const [libraryRoot, setLibraryRoot] = React.useState<string | null>(null);
  const [configPath, setConfigPath] = React.useState<string | null>(null);
  const [publicIdBusy, setPublicIdBusy] = React.useState<boolean>(false);
  const [publicIdError, setPublicIdError] = React.useState<string | null>(null);
  const [publicIdResult, setPublicIdResult] = React.useState<string | null>(null);
  const [defaultLibraryRootInfo, setDefaultLibraryRootInfo] = React.useState<{
    isPortable: boolean;
    portableDir: string | null;
    defaultLibraryRoot: string;
  } | null>(null);

  const [layoutRef, layoutWidth] = useElementWidth<HTMLDivElement>();
  const [libraryLeftFrac, setLibraryLeftFrac] = React.useState<number>(0.55);
  const libraryLeftFracRef = React.useRef<number>(libraryLeftFrac);
  const reloadCarouselDebounceRef = React.useRef<number | null>(null);
  const libraryResizeRef = React.useRef<{ startX: number; startLeftPx: number } | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<CKCLibraryDiagnostics | null>(null);
  const [diagnosticsError, setDiagnosticsError] = React.useState<string | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = React.useState<boolean>(false);
  const [repairScanDir, setRepairScanDir] = React.useState<string>('');
  const [repairIncludeSubdirs, setRepairIncludeSubdirs] = React.useState<boolean>(true);
  const [repairBusy, setRepairBusy] = React.useState<boolean>(false);
  const [repairError, setRepairError] = React.useState<string | null>(null);
  const [repairResult, setRepairResult] = React.useState<CKCRepairMissingImagesByHashResult | null>(null);

  const [dupGroups, setDupGroups] = React.useState<CKCDuplicateGroup[] | null>(null);
  const [dupBusy, setDupBusy] = React.useState<boolean>(false);
  const [dupError, setDupError] = React.useState<string | null>(null);
  const [exportDir, setExportDir] = React.useState<string | null>(null);
  const [exportRootOverride, setExportRootOverride] = React.useState<string | null>(null);
  const [templateAst, setTemplateAst] = React.useState<CKCTemplateAst | null>(null);
  const [exportSections, setExportSections] = React.useState<string[] | null>(null);
  const [spinOffs, setSpinOffs] = React.useState<CKCSpinOffListItem[] | null>(null);
  const [selectedSpinOffId, setSelectedSpinOffId] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);

  const defaultExportsDir = React.useMemo(() => {
    return exportRootOverride || (libraryRoot ? joinPath(libraryRoot, 'exports') : null);
  }, [exportRootOverride, libraryRoot]);

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
        if (typeof cfg?.exportRoot === 'string') setExportRootOverride(cfg.exportRoot);
        else setExportRootOverride(null);
        if (typeof cfg?.inboxDir === 'string') setInboxDir(cfg.inboxDir);
        if (Array.isArray(cfg?.pinnedTags)) setPinnedTags(dedupeTagsCaseInsensitive(cfg.pinnedTags.map((t: any) => String(t))));
        const lf = (cfg?.layoutLibrary2 && typeof cfg.layoutLibrary2 === 'object' ? cfg.layoutLibrary2 : null) as any;
        if (typeof lf?.leftFrac === 'number') setLibraryLeftFrac(clamp01(lf.leftFrac));
      })
      .catch(() => {
        window.ckc
          .getConfig()
          .then((cfg: any) => {
            if (typeof cfg?.libraryRoot === 'string') setLibraryRoot(cfg.libraryRoot);
            if (typeof cfg?.exportRoot === 'string') setExportRootOverride(cfg.exportRoot);
            else setExportRootOverride(null);
            if (typeof cfg?.inboxDir === 'string') setInboxDir(cfg.inboxDir);
            if (Array.isArray(cfg?.pinnedTags)) setPinnedTags(dedupeTagsCaseInsensitive(cfg.pinnedTags.map((t: any) => String(t))));
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

  const reloadTagStats = React.useCallback(() => {
    setTagManagerError(null);
    setTagManagerBusy(true);
    window.ckc
      .listTagStats()
      .then((rows) => setTagStats(Array.isArray(rows) ? rows : []))
      .catch((err: unknown) => {
        setTagManagerError(err instanceof Error ? err.message : String(err));
        setTagStats([]);
      })
      .finally(() => setTagManagerBusy(false));
  }, []);

  React.useEffect(() => {
    if (!showTagsBar) return;
    reloadTagStats();
  }, [showTagsBar, reloadTagStats, refreshNonce]);

  const savePinnedTags = React.useCallback(async (next: string[]) => {
    const cleaned = dedupeTagsCaseInsensitive(next);
    setPinnedTags(cleaned);
    try {
      await window.ckc.setConfig({ pinnedTags: cleaned });
    } catch {
      // best-effort
    }
  }, []);

  const togglePinnedTag = React.useCallback(
    (tagText: string) => {
      const t = String(tagText || '').trim();
      if (!t) return;
      const isPinned = pinnedTags.some((x) => String(x).toLowerCase() === t.toLowerCase());
      void savePinnedTags(isPinned ? pinnedTags.filter((x) => String(x).toLowerCase() !== t.toLowerCase()) : [...pinnedTags, t]);
    },
    [pinnedTags, savePinnedTags]
  );

  const reloadInbox = React.useCallback(() => {
    setInboxError(null);
    window.ckc
      .listInboxImages()
      .then((rows: any) => {
        const next = Array.isArray(rows)
          ? rows.map((img) => ({
              id: String(img.id),
              favorite: !!img.favorite,
              rating: Number(img.rating) || 0,
              notes: String(img.notes ?? ''),
              tags: Array.isArray(img.tags) ? img.tags.map((t: any) => String(t)) : [],
              addedAt: String(img.addedAt ?? ''),
            }))
          : [];
        setInboxImages(next);
      })
      .catch((err: unknown) => {
        setInboxError(err instanceof Error ? err.message : String(err));
        setInboxImages([]);
      });
  }, []);

  React.useEffect(() => {
    reloadInbox();
  }, [reloadInbox, refreshNonce]);

  const reloadInboxAssignCharacters = React.useCallback(() => {
    window.ckc
      .listCharacters({ queryText: '', tagFilters: [], includeSystem: false })
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setInboxAssignCharacters(list);
        setInboxAssignTargetId((prev) => (prev ? prev : list[0]?.id ? String(list[0].id) : ''));
      })
      .catch(() => setInboxAssignCharacters([]));
  }, []);

  React.useEffect(() => {
    reloadInboxAssignCharacters();
  }, [reloadInboxAssignCharacters, refreshNonce]);

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

  const cleanedPinnedTags = React.useMemo(() => dedupeTagsCaseInsensitive(pinnedTags), [pinnedTags]);

  const activeTagFilterSet = React.useMemo(() => {
    const s = new Set<string>();
    for (const t of cleanedTagFilters) s.add(String(t).toLowerCase());
    return s;
  }, [cleanedTagFilters]);

  const filteredTagStats = React.useMemo(() => {
    const rows = tagStats || [];
    const q = String(tagManagerQuery || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r?.tag ?? '').toLowerCase().includes(q));
  }, [tagStats, tagManagerQuery]);

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

  const reloadDuplicateGroups = React.useCallback(async () => {
    setDupError(null);
    setDupBusy(true);
    try {
      const rows = await window.ckc.listDuplicateGroups({ minCount: 2, limitGroups: 200, maxPerGroup: 200 });
      setDupGroups(Array.isArray(rows) ? rows : []);
    } catch (err: unknown) {
      setDupError(err instanceof Error ? err.message : String(err));
      setDupGroups([]);
    } finally {
      setDupBusy(false);
    }
  }, []);

  const deleteDuplicateExtras = React.useCallback(
    async (group: CKCDuplicateGroup) => {
      const g = group as any;
      if (!g || !Array.isArray(g.images) || g.images.length < 2) return;
      if (g.truncated) {
        setDupError('This duplicate group is truncated. Rescan with a higher max-per-group before deleting.');
        return;
      }

      const imgs: CKCDuplicateImage[] = g.images;
      const score = (img: CKCDuplicateImage): number => {
        const fav = img.favorite ? 1000 : 0;
        const fp = (img.tags || []).includes('frontpage') ? 50 : 0;
        const car = (img.tags || []).includes('carousel') ? 10 : 0;
        const rating = (Number(img.rating) || 0) * 10;
        const missingPenalty = img.isMissing ? -500 : 0;
        return fav + fp + car + rating + missingPenalty;
      };

      const keeper = [...imgs].sort((a, b) => score(b) - score(a) || String(a.addedAt).localeCompare(String(b.addedAt)))[0];
      if (!keeper?.imageId) return;

      const deleteIds = imgs.map((i) => i.imageId).filter((id) => id && id !== keeper.imageId);
      if (deleteIds.length === 0) return;

      const ok = window.confirm(
        `Delete ${deleteIds.length} duplicate(s) and keep 1?\n\nKeep: ${keeper.imageId} (${keeper.characterName || keeper.characterId})\nHash: ${
          g.fileHash
        }\nPotential savings: ${formatBytes(Number(g.potentialSavingsBytes) || 0)}\n\nThis deletes CKC copy files only (never external reference files).`
      );
      if (!ok) return;

      setDupError(null);
      setDupBusy(true);
      try {
        const res = await window.ckc.deleteImages({ imageIds: deleteIds, deleteFiles: true });
        const errs = Array.isArray((res as any)?.errors) ? (res as any).errors : [];
        if (errs.length > 0) {
          setDupError(`Deleted with ${errs.length} error(s). First: ${String(errs[0]?.message ?? 'Unknown error')}`);
        }
        await reloadDuplicateGroups();
        void reloadCarousel();
        setRefreshNonce((n) => n + 1);
      } catch (err: unknown) {
        setDupError(err instanceof Error ? err.message : String(err));
      } finally {
        setDupBusy(false);
      }
    },
    [reloadDuplicateGroups, reloadCarousel]
  );

  const pasteClipboardToInbox = React.useCallback(async () => {
    setInboxError(null);
    setInboxBusy(true);
    try {
      const res = await window.ckc.importClipboardImage({ target: 'inbox' });
      if ((res as any)?.ok === false && (res as any)?.reason === 'no_image') {
        setInboxError('No image in clipboard.');
        return;
      }
      const importedCount = Array.isArray((res as any)?.imported) ? (res as any).imported.length : 0;
      const duplicateCount = Array.isArray((res as any)?.duplicates) ? (res as any).duplicates.length : 0;
      if (importedCount === 0 && duplicateCount > 0) {
        setInboxError('Clipboard image appears to be a duplicate (skipped).');
      }
      reloadInbox();
      setLeftMode('inbox');
      setShowInboxBar(true);
      setRefreshNonce((n) => n + 1);
    } catch (err: unknown) {
      setInboxError(err instanceof Error ? err.message : String(err));
    } finally {
      setInboxBusy(false);
    }
  }, [reloadInbox]);

  const importUrlToInbox = React.useCallback(async () => {
    const proposed = window.prompt('Import image from URL to Inbox:', '');
    if (proposed == null) return;
    const url = String(proposed || '').trim();
    if (!url) return;

    setInboxError(null);
    setInboxBusy(true);
    try {
      const res = await window.ckc.importFromUrl({ target: 'inbox', url });
      const importedCount = Array.isArray((res as any)?.imported) ? (res as any).imported.length : 0;
      const duplicateCount = Array.isArray((res as any)?.duplicates) ? (res as any).duplicates.length : 0;
      if (importedCount === 0 && duplicateCount > 0) {
        setInboxError('URL appears to be a duplicate (skipped).');
      }
      reloadInbox();
      setLeftMode('inbox');
      setShowInboxBar(true);
      setRefreshNonce((n) => n + 1);
    } catch (err: unknown) {
      setInboxError(err instanceof Error ? err.message : String(err));
    } finally {
      setInboxBusy(false);
    }
  }, [reloadInbox]);

  const scanInbox = React.useCallback(async () => {
    const dir = String(inboxDir || '').trim();
    if (!dir) {
      setInboxError('Set an Inbox folder first.');
      return;
    }

    setInboxError(null);
    setInboxBusy(true);
    try {
      const res = await window.ckc.scanInbox({ inboxDir: dir, includeSubdirs: inboxIncludeSubdirs });
      const importedCount = Array.isArray((res as any)?.imported) ? (res as any).imported.length : 0;
      const duplicateCount = Array.isArray((res as any)?.duplicates) ? (res as any).duplicates.length : 0;
      setInboxLastScan({ scanned: Number((res as any)?.scanned) || 0, imported: importedCount, duplicates: duplicateCount });
      reloadInbox();
      setLeftMode('inbox');
      setShowInboxBar(true);
      setRefreshNonce((n) => n + 1);
    } catch (err: unknown) {
      setInboxError(err instanceof Error ? err.message : String(err));
    } finally {
      setInboxBusy(false);
    }
  }, [inboxDir, inboxIncludeSubdirs, reloadInbox]);

  const assignInboxSelection = React.useCallback(async () => {
    const targetId = String(inboxAssignTargetId || '').trim();
    if (!targetId) return;
    if (!Array.isArray(inboxSelectedIds) || inboxSelectedIds.length === 0) return;

    setInboxAssignError(null);
    setInboxBusy(true);
    try {
      const res = await window.ckc.moveImagesToCharacter({ imageIds: inboxSelectedIds, targetCharacterId: targetId });
      const errs = Array.isArray((res as any)?.errors) ? (res as any).errors : [];
      if (errs.length > 0) {
        setInboxAssignError(`Moved with ${errs.length} error(s). First: ${String(errs[0]?.message ?? 'Unknown error')}`);
      }
      reloadInbox();
      void reloadCarousel();
      setRefreshNonce((n) => n + 1);
    } catch (err: unknown) {
      setInboxAssignError(err instanceof Error ? err.message : String(err));
    } finally {
      setInboxBusy(false);
    }
  }, [inboxAssignTargetId, inboxSelectedIds, reloadInbox, reloadCarousel]);

  const deleteInboxSelection = React.useCallback(async () => {
    if (!Array.isArray(inboxSelectedIds) || inboxSelectedIds.length === 0) return;
    const ok = window.confirm(`Delete ${inboxSelectedIds.length} image(s) from Inbox? This deletes CKC copies only.`);
    if (!ok) return;

    setInboxAssignError(null);
    setInboxBusy(true);
    try {
      const res = await window.ckc.deleteImages({ imageIds: inboxSelectedIds, deleteFiles: true });
      const errs = Array.isArray((res as any)?.errors) ? (res as any).errors : [];
      if (errs.length > 0) {
        setInboxAssignError(`Deleted with ${errs.length} error(s). First: ${String(errs[0]?.message ?? 'Unknown error')}`);
      }
      reloadInbox();
      void reloadCarousel();
      setRefreshNonce((n) => n + 1);
    } catch (err: unknown) {
      setInboxAssignError(err instanceof Error ? err.message : String(err));
    } finally {
      setInboxBusy(false);
    }
  }, [inboxSelectedIds, reloadInbox, reloadCarousel]);

  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.repeat) return;
      if (!(evt.ctrlKey || evt.metaKey)) return;
      if (evt.key !== 'v' && evt.key !== 'V') return;
      if (isEditableActiveElement()) return;
      if (inboxBusy) return;
      evt.preventDefault();
      void pasteClipboardToInbox();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pasteClipboardToInbox, inboxBusy]);

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

  const replaceTagInFiltersAndPins = React.useCallback(
    (fromTag: string, toTag: string) => {
      const fromKey = String(fromTag || '').trim().toLowerCase();
      const to = String(toTag || '').trim();
      if (!fromKey || !to) return;

      setTagFilters((prev) => dedupeTagsCaseInsensitive(prev.map((t) => (String(t).trim().toLowerCase() === fromKey ? to : t))));
      void savePinnedTags(pinnedTags.map((t) => (String(t).trim().toLowerCase() === fromKey ? to : t)));
    },
    [pinnedTags, savePinnedTags]
  );

  const runRenameTag = React.useCallback(
    async (stat: CKCTagStats) => {
      const from = String(stat?.tag ?? '').trim();
      if (!from) return;

      const proposed = window.prompt(`Rename tag "${from}" to:`, from);
      if (proposed == null) return;
      const to = String(proposed || '').trim();
      if (!to) return;
      if (to.toLowerCase() === from.toLowerCase()) return;

      const preview = `This tag appears on:\n- images: ${Number(stat.imageCount) || 0}\n- docs: ${Number(stat.docCount) || 0}\n- characters: ${
        Number(stat.characterCount) || 0
      }\n\n`;
      const ok = window.confirm(`${preview}Rename "${from}" \u2192 "${to}"?\n\nThis changes structured tag fields across the library.`);
      if (!ok) return;

      setTagManagerError(null);
      setTagManagerMutating(true);
      try {
        await window.ckc.renameTag({ fromTag: from, toTag: to });
        replaceTagInFiltersAndPins(from, to);
        setRefreshNonce((n) => n + 1);
        reloadTagStats();
      } catch (err: unknown) {
        setTagManagerError(err instanceof Error ? err.message : String(err));
      } finally {
        setTagManagerMutating(false);
      }
    },
    [reloadTagStats, replaceTagInFiltersAndPins]
  );

  const runMergeTag = React.useCallback(
    async (stat: CKCTagStats) => {
      const from = String(stat?.tag ?? '').trim();
      if (!from) return;

      const proposed = window.prompt(`Merge tag "${from}" into:`, '');
      if (proposed == null) return;
      const to = String(proposed || '').trim();
      if (!to) return;
      if (to.toLowerCase() === from.toLowerCase()) return;

      const preview = `This tag appears on:\n- images: ${Number(stat.imageCount) || 0}\n- docs: ${Number(stat.docCount) || 0}\n- characters: ${
        Number(stat.characterCount) || 0
      }\n\n`;
      const ok = window.confirm(`${preview}Merge "${from}" \u2192 "${to}"?\n\nThis replaces "${from}" with "${to}" in structured tag fields.`);
      if (!ok) return;

      setTagManagerError(null);
      setTagManagerMutating(true);
      try {
        await window.ckc.mergeTags({ fromTags: [from], toTag: to });
        replaceTagInFiltersAndPins(from, to);
        setRefreshNonce((n) => n + 1);
        reloadTagStats();
      } catch (err: unknown) {
        setTagManagerError(err instanceof Error ? err.message : String(err));
      } finally {
        setTagManagerMutating(false);
      }
    },
    [reloadTagStats, replaceTagInFiltersAndPins]
  );

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
          key={leftMode}
          images={leftMode === 'inbox' ? inboxImages : filteredCarouselImages}
          allTags={allTags}
          headerLeft={
            <div className={styles.leftHeader}>
              <button
                className={styles.leftToggle}
                data-active={leftMode === 'carousel' ? '1' : '0'}
                onClick={() => setLeftMode('carousel')}
              >
                Carousel
              </button>
              <button
                className={styles.leftToggle}
                data-active={leftMode === 'inbox' ? '1' : '0'}
                onClick={() => {
                  setLeftMode('inbox');
                  setShowInboxBar(true);
                }}
                title="Unassigned inbox images"
              >
                Inbox ({inboxImages.length})
              </button>
              {leftMode === 'inbox' ? (
                <button className={styles.leftToggle} disabled={inboxBusy} onClick={() => setShowInboxBar(true)} title="Inbox settings">
                  Settings
                </button>
              ) : null}
            </div>
          }
          defaultShowThumbnails={leftMode === 'inbox'}
          defaultShowControls={leftMode === 'inbox'}
          autoOpenControlsOnSelect={leftMode === 'inbox'}
          enableViewerSlideshow={leftMode === 'carousel'}
          autoStartSlideshow={leftMode === 'carousel'}
          emptyLabel={
            leftMode === 'carousel'
              ? 'No global carousel images yet (tag an image with: carousel).'
              : inboxDir
                ? 'Inbox is empty. Scan the folder in the Inbox bar.'
                : 'Inbox folder not set. Open the Inbox bar to configure.'
          }
          onSelectionChange={
            leftMode === 'inbox'
              ? (ids, primary) => {
                  setInboxSelectedIds(ids);
                  setInboxPrimaryId(primary);
                }
              : undefined
          }
          onOpenDiagnostics={() => setShowLibraryBar(true)}
          onPatchImageMeta={(imageId, patch) => {
            if (leftMode === 'carousel') {
              // Re-fetch to respect the global selection rule (prefer frontpage when present).
              if (reloadCarouselDebounceRef.current) window.clearTimeout(reloadCarouselDebounceRef.current);
              reloadCarouselDebounceRef.current = window.setTimeout(() => void reloadCarousel(), 120);
              return;
            }

            setInboxImages((prev) =>
              (prev || []).map((img) => (img.id === imageId ? { ...img, ...patch, tags: patch.tags ?? img.tags } : img))
            );
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

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Character IDs:</span>
            <button
              disabled={publicIdBusy}
              onClick={async () => {
                const ok = window.confirm(
                  'Assign public Character IDs to existing characters?\n\nThis does NOT rename folders. It updates CHAR-ID-001 in sheets and creates a sheet version entry per updated character.'
                );
                if (!ok) return;

                setPublicIdError(null);
                setPublicIdResult(null);
                setPublicIdBusy(true);
                try {
                  const res: any = await window.ckc.assignPublicCharacterIds({ dryRun: false });
                  const updated = Number(res?.updated ?? 0) || 0;
                  const errs = Array.isArray(res?.errors) ? res.errors : [];
                  setPublicIdResult(errs.length ? `Updated ${updated} with ${errs.length} error(s).` : `Updated ${updated}.`);
                  setRefreshNonce((n) => n + 1);
                } catch (err: unknown) {
                  setPublicIdError(err instanceof Error ? err.message : String(err));
                } finally {
                  setPublicIdBusy(false);
                }
              }}
              title="Assign human-friendly public IDs (CHAR-000001) to characters that don't have one yet"
            >
              {publicIdBusy ? 'Working...' : 'Assign public IDs'}
            </button>
            {publicIdResult ? <span style={{ color: 'var(--text-secondary)' }}>{publicIdResult}</span> : null}
          </div>

          {publicIdError ? <div className={styles.error}>{publicIdError}</div> : null}

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

          <details style={{ marginTop: 12 }}>
            <summary>Duplicates (exact hash)</summary>

            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button disabled={dupBusy} onClick={() => void reloadDuplicateGroups()}>
                {dupBusy ? 'Working…' : 'Scan duplicates'}
              </button>
              {dupGroups ? (
                <span style={{ color: 'var(--text-secondary)' }}>
                  groups <b>{dupGroups.length}</b>
                </span>
              ) : null}
            </div>

            {dupError ? <div className={styles.error}>{dupError}</div> : null}

            {dupGroups ? (
              dupGroups.length === 0 ? (
                <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>No duplicates found.</div>
              ) : (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dupGroups.map((g) => (
                    <details key={g.fileHash} style={{ border: '1px solid var(--glass-border)', padding: 8 }}>
                      <summary>
                        <code style={{ fontSize: '0.85rem' }}>{g.fileHash.slice(0, 14)}…</code> • <b>{g.count}</b> copies • size{' '}
                        <b>{formatBytes(g.sizeBytes)}</b> • potential save <b>{formatBytes(g.potentialSavingsBytes)}</b>
                      </summary>

                      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button disabled={dupBusy || g.truncated || g.count < 2} onClick={() => void deleteDuplicateExtras(g)}>
                          Delete extras (keep best)
                        </button>
                        {g.truncated ? (
                          <span style={{ color: 'rgba(255,0,0,0.75)' }}>
                            Truncated: showing {g.images.length} of {g.count}. Rescan with higher max-per-group.
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                          gap: 10,
                        }}
                      >
                        {g.images.map((img) => (
                          <div
                            key={img.imageId}
                            style={{
                              border: '1px solid var(--glass-border)',
                              background: 'var(--glass)',
                              padding: 8,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              minWidth: 0,
                            }}
                          >
                            <img
                              src={`ckc://thumb/${encodeURIComponent(img.imageId)}`}
                              alt=""
                              style={{ width: '100%', height: 90, objectFit: 'contain', background: 'rgba(0,0,0,0.08)' }}
                            />
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={img.imageId}
                            >
                              {img.characterName || img.characterId}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span>
                                {img.favorite ? '★' : '☆'} {img.rating}
                              </span>
                              <span>{img.storageMode}</span>
                              <span>{img.sizeBytes != null ? formatBytes(img.sizeBytes) : '?'}</span>
                              {img.isMissing ? <span style={{ color: 'rgba(255,0,0,0.75)' }}>missing</span> : null}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <button disabled={dupBusy} onClick={() => onOpenCharacter(img.characterId, img.imageId)} title="Open character at this image">
                                Open
                              </button>
                            </div>
                            {img.tags?.length ? (
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }} title={img.tags.join(', ')}>
                                {img.tags.slice(0, 4).join(', ')}
                                {img.tags.length > 4 ? '…' : ''}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )
            ) : (
              <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>Scan to find exact (byte-identical) duplicates by hash.</div>
            )}
          </details>
        </CommandBar>

        <CommandBar isOpen={showInboxBar} onToggle={() => setShowInboxBar((v) => !v)} label="Inbox">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Folder:</span>
            <code style={{ fontSize: '0.85rem' }}>{inboxDir ? inboxDir : '(not set)'}</code>
            <button
              disabled={inboxBusy}
              onClick={async () => {
                setInboxError(null);
                const dir = await window.ckc.selectFolderDialog({ title: 'Select Inbox folder (screenshots dump)' });
                if (!dir) return;
                setInboxDir(dir);
                await window.ckc.setConfig({ inboxDir: dir });
              }}
            >
              Choose folder…
            </button>
            <button disabled={!inboxDir} onClick={() => void window.ckc.openPath(inboxDir)}>
              Open folder
            </button>
            <button
              disabled={inboxBusy || !inboxDir}
              onClick={async () => {
                setInboxDir('');
                await window.ckc.setConfig({ inboxDir: '' });
              }}
              title="Clears the configured inbox folder (does not delete files)"
            >
              Clear
            </button>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={inboxIncludeSubdirs}
                onChange={(e) => setInboxIncludeSubdirs(e.target.checked)}
                disabled={inboxBusy}
              />{' '}
              Include subfolders
            </label>
            <button disabled={inboxBusy || !inboxDir} onClick={() => void scanInbox()}>
              {inboxBusy ? 'Working…' : 'Scan Inbox'}
            </button>
            <button disabled={inboxBusy} onClick={() => void importUrlToInbox()} title="Import an image from a URL into the Inbox">
              Import URL...
            </button>
            <button disabled={inboxBusy} onClick={() => void pasteClipboardToInbox()} title="Ctrl+V / Cmd+V also works (when not typing)">
              Paste image
            </button>
            {inboxLastScan ? (
              <span style={{ color: 'var(--text-secondary)' }}>
                scanned <b>{inboxLastScan.scanned}</b> • imported <b>{inboxLastScan.imported}</b> • duplicates <b>{inboxLastScan.duplicates}</b>
              </span>
            ) : null}
          </div>

          {inboxError ? <div className={styles.error}>{inboxError}</div> : null}

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              Selected: <b>{inboxSelectedIds.length}</b>
              {inboxPrimaryId ? (
                <span>
                  {' '}
                  • primary: <code style={{ fontSize: '0.85rem' }}>{inboxPrimaryId}</code>
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Assign to{' '}
                <select
                  value={inboxAssignTargetId}
                  onChange={(e) => setInboxAssignTargetId(e.target.value)}
                  disabled={inboxBusy || !inboxAssignCharacters}
                >
                  <option value="">(pick character)</option>
                  {(inboxAssignCharacters || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <button disabled={inboxBusy || inboxSelectedIds.length === 0 || !inboxAssignTargetId} onClick={() => void assignInboxSelection()}>
                Assign
              </button>

              <button
                disabled={inboxBusy || inboxSelectedIds.length === 0}
                onClick={() => void deleteInboxSelection()}
                title="Deletes CKC copies stored in the Inbox. Does not touch your original inbox folder files."
              >
                Delete
              </button>

              <button disabled={inboxBusy} onClick={reloadInbox} title="Refresh inbox list">
                Refresh
              </button>
            </div>

            {inboxAssignError ? <div className={styles.error}>{inboxAssignError}</div> : null}
          </div>
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
            <span style={{ color: 'var(--text-secondary)' }}>Pinned:</span>
            {cleanedPinnedTags.length === 0 ? <span style={{ color: 'var(--text-secondary)' }}>(none)</span> : null}
            {cleanedPinnedTags.map((t) => {
              const key = String(t).toLowerCase();
              const active = activeTagFilterSet.has(key);
              return (
                <button
                  key={t}
                  className={styles.characterItem}
                  style={{
                    padding: '4px 8px',
                    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderColor: active ? 'rgba(255,255,255,0.26)' : undefined,
                  }}
                  onClick={() => {
                    if (active) {
                      setTagFilters((prev) => prev.filter((x) => String(x).toLowerCase() !== key));
                      return;
                    }
                    addTagFiltersFromText(t);
                  }}
                  title={active ? 'Remove tag filter' : 'Add tag filter'}
                >
                  {t}
                </button>
              );
            })}
            <button onClick={() => setShowTagsBar(true)} title="Open tag manager">
              Manage…
            </button>
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
          <CommandBar isOpen={showTagsBar} onToggle={() => setShowTagsBar((v) => !v)} label="Tags">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button disabled={tagManagerBusy || tagManagerMutating} onClick={() => reloadTagStats()}>
                {tagManagerBusy ? 'Working…' : 'Refresh'}
              </button>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                Find{' '}
                <input
                  value={tagManagerQuery}
                  onChange={(e) => setTagManagerQuery(e.target.value)}
                  placeholder="tag"
                  style={{ width: 200 }}
                />
              </label>
              <span style={{ color: 'var(--text-secondary)' }}>
                tags <b>{tagStats ? tagStats.length : '?'}</b> • pinned <b>{cleanedPinnedTags.length}</b>
              </span>
            </div>

            {tagManagerError ? <div className={styles.error}>{tagManagerError}</div> : null}

            {!tagStats ? (
              <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>Open this bar to scan global tags.</div>
            ) : filteredTagStats.length === 0 ? (
              <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>No tags match.</div>
            ) : (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflow: 'auto' }}>
                {filteredTagStats.map((s) => {
                  const key = String(s.tag || '').toLowerCase();
                  const isPinned = cleanedPinnedTags.some((t) => String(t).toLowerCase() === key);
                  return (
                    <div
                      key={s.tag}
                      style={{
                        border: '1px solid var(--glass-border)',
                        background: 'var(--glass)',
                        padding: 8,
                        display: 'flex',
                        gap: 10,
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 900,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={s.tag}
                        >
                          {s.tag}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <span>
                            img <b>{Number(s.imageCount) || 0}</b>
                          </span>
                          <span>
                            docs <b>{Number(s.docCount) || 0}</b> (N {Number(s.docNotesCount) || 0} / S {Number(s.docStoriesCount) || 0} / M{' '}
                            {Number(s.docMoodboardCount) || 0})
                          </span>
                          <span>
                            chars <b>{Number(s.characterCount) || 0}</b>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button disabled={tagManagerMutating} onClick={() => togglePinnedTag(s.tag)}>
                          {isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button disabled={tagManagerMutating} onClick={() => void runRenameTag(s)}>
                          Rename…
                        </button>
                        <button disabled={tagManagerMutating} onClick={() => void runMergeTag(s)}>
                          Merge…
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CommandBar>
        </div>

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
              {onOpenExports ? (
                <button onClick={onOpenExports} title="Open the centralized Export Hub">
                  Export hub…
                </button>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                disabled={isExporting}
                onClick={async () => {
                  setExportError(null);
                  setIsExporting(true);
                  try {
                    const outDir = exportDir || defaultExportsDir;
                    const res = await window.ckc.exportEmptyTemplate({ outDir });
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
                    const outDir = exportDir || defaultExportsDir;
                    const res = await window.ckc.exportTemplateFieldPack({
                      outDir,
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
                      {(c as any).publicId ? (
                        <>
                          <span style={{ color: 'var(--text-secondary)' }}>ID:</span> <code>{String((c as any).publicId)}</code>{' '}
                          â€¢ {c.templateId} {c.templateVersion}
                        </>
                      ) : (
                        <>
                          {c.templateId} {c.templateVersion}
                        </>
                      )}
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

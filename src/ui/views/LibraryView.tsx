import React from 'react';
import { MediaPane } from '../components/MediaPane';
import { CommandBar } from '../components/CommandBar';
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
  const [characters, setCharacters] = React.useState<CKCCharacterListItem[] | null>(null);
  const [carouselImages, setCarouselImages] = React.useState<
    Array<{ id: string; favorite: boolean; rating: number; notes: string; tags: string[] }>
  >([]);
  const [error, setError] = React.useState<string | null>(null);
  const [showCommandBar, setShowCommandBar] = React.useState<boolean>(false);
  const [showExportsBar, setShowExportsBar] = React.useState<boolean>(false);

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
  const [exportDir, setExportDir] = React.useState<string | null>(null);
  const [spinOffs, setSpinOffs] = React.useState<CKCSpinOffListItem[] | null>(null);
  const [selectedSpinOffId, setSelectedSpinOffId] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);

  const defaultExportsDir = React.useMemo(() => {
    return libraryRoot ? joinPath(libraryRoot, 'exports') : null;
  }, [libraryRoot]);

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
      .listAllTags()
      .then((rows) => setAllTags(Array.isArray(rows) ? rows.map((t) => String(t)) : []))
      .catch(() => setAllTags([]));
  }, []);

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
  }, [reloadSavedSearches]);

  React.useEffect(() => {
    window.ckc
      .listSpinOffs({})
      .then((rows) => {
        setSpinOffs(rows);
        const safe = rows.find((r) => String(r.name || '').toLowerCase().includes('safe subset'));
        setSelectedSpinOffId((safe?.id ?? rows[0]?.id ?? null) as any);
      })
      .catch((err: unknown) => setExportError(err instanceof Error ? err.message : String(err)));
  }, []);

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
  }, [queryText, cleanedTagFilters, scopeFlags, favoriteOnly, ratingOp, ratingValue]);

  React.useEffect(() => {
    reloadCarousel();
  }, [reloadCarousel]);

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

  return (
    <div className={styles.layout}>
      <section className={styles.left}>
        <MediaPane
          images={filteredCarouselImages}
          emptyLabel="No global carousel images yet (tag an image with: carousel)."
          onPatchImageMeta={(imageId, patch) => {
            // Re-fetch to respect the global selection rule (prefer frontpage when present).
            void reloadCarousel();
          }}
        />
      </section>

      <aside className={styles.right}>
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
                    const res = await window.ckc.exportTemplateFieldPack({ outDir: exportDir, spinoffId: selectedSpinOffId });
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

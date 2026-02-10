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
      .listSpinOffs({})
      .then((rows) => {
        setSpinOffs(rows);
        const safe = rows.find((r) => String(r.name || '').toLowerCase().includes('safe subset'));
        setSelectedSpinOffId((safe?.id ?? rows[0]?.id ?? null) as any);
      })
      .catch((err: unknown) => setExportError(err instanceof Error ? err.message : String(err)));
  }, []);

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
  }, [queryText, favoriteOnly, ratingOp, ratingValue]);

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
          <label>
            Search{' '}
            <input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Name, tags, fields…"
              style={{ width: 220 }}
            />
          </label>
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

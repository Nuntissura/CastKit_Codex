import React from 'react';
import { MediaPane } from '../components/MediaPane';
import { CommandBar } from '../components/CommandBar';
import styles from './libraryView.module.css';

export function LibraryView({ onOpenCharacter }: { onOpenCharacter: (characterId: string) => void }) {
  const [characters, setCharacters] = React.useState<CKCCharacterListItem[] | null>(null);
  const [carouselImages, setCarouselImages] = React.useState<
    Array<{ id: string; favorite: boolean; rating: number; notes: string; tags: string[] }>
  >([]);
  const [error, setError] = React.useState<string | null>(null);
  const [showCommandBar, setShowCommandBar] = React.useState<boolean>(false);

  const [queryText, setQueryText] = React.useState<string>('');
  const [favoriteOnly, setFavoriteOnly] = React.useState<boolean>(false);
  const [ratingOp, setRatingOp] = React.useState<'any' | '=' | '<' | '<=' | '>' | '>='>('any');
  const [ratingValue, setRatingValue] = React.useState<number>(0);

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
        <CommandBar isOpen={showCommandBar} onToggle={() => setShowCommandBar((v) => !v)}>
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
                <div className={styles.characterName}>{c.displayName}</div>
                <div className={styles.characterMeta}>
                  {c.templateId} {c.templateVersion}
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

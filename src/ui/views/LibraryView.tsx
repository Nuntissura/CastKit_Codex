import React from 'react';
import { MediaPane } from '../components/MediaPane';
import styles from './libraryView.module.css';

export function LibraryView({ onOpenCharacter }: { onOpenCharacter: (characterId: string) => void }) {
  const [characters, setCharacters] = React.useState<CKCCharacterListItem[] | null>(null);
  const [carouselImages, setCarouselImages] = React.useState<Array<{ id: string; favorite: boolean; rating: number; notes: string; tags: string[] }>>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    window.ckc
      .listCharacters({})
      .then(async (rows) => {
        if (cancelled) return;
        setCharacters(rows);

        const charRows = await Promise.all(rows.map((r) => window.ckc.getCharacter(r.id)));
        if (cancelled) return;

        const global = [];
        for (const c of charRows) {
          if (!c) continue;
          for (const img of c.images || []) {
            const tags = img.tags || [];
            if (tags.includes('carousel')) {
              global.push({ id: img.id, favorite: img.favorite, rating: img.rating, notes: img.notes, tags });
            }
          }
        }
        setCarouselImages(global);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.layout}>
      <section className={styles.left}>
        <MediaPane
          images={carouselImages}
          emptyLabel="No global carousel images yet (tag an image with: carousel)."
          onPatchImageMeta={(imageId, patch) => {
            setCarouselImages((prev) => {
              const idx = prev.findIndex((p) => p.id === imageId);
              if (idx < 0) return prev;
              const next = { ...prev[idx], ...patch, tags: patch.tags ?? prev[idx].tags };
              if (!next.tags.includes('carousel')) return prev.filter((p) => p.id !== imageId);
              const copy = prev.slice();
              copy[idx] = next;
              return copy;
            });
          }}
        />
      </section>

      <aside className={styles.right}>
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
      </aside>
    </div>
  );
}

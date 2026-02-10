import React from 'react';
import { MediaPane } from '../components/MediaPane';
import styles from './characterView.module.css';

export function CharacterView({ characterId, onBack }: { characterId: string | null; onBack: () => void }) {
  const [character, setCharacter] = React.useState<CKCCharacter | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'sheet' | 'photos' | 'notes' | 'tools'>('sheet');
  const [mediaMode, setMediaMode] = React.useState<'carousel' | 'photos'>('carousel');

  React.useEffect(() => {
    if (!characterId) return;
    setCharacter(null);
    setError(null);

    window.ckc
      .getCharacter(characterId)
      .then((c) => setCharacter(c))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [characterId]);

  const images = React.useMemo(() => {
    const all = character?.images ?? [];
    if (mediaMode === 'photos') return all;
    const carousel = all.filter((i) => (i.tags || []).includes('carousel'));
    return carousel.length > 0 ? carousel : all;
  }, [character, mediaMode]);

  return (
    <div className={styles.layout} data-mode={tab === 'notes' ? 'docs' : 'default'}>
      <section className={styles.left}>
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
        <div className={styles.leftBody}>
          <MediaPane
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
            <div className={styles.middleTitle}>Notes / Stories / Moodboard</div>
            <button className={styles.btnSecondary} onClick={() => setTab('sheet')}>
              Close
            </button>
          </div>
          <div className={styles.middleBody}>
            <div className={styles.muted}>Stub panel — next: separate libraries + smart tags + moodboard canvas.</div>
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
            <button className={styles.btnSecondary} onClick={onBack}>
              Library
            </button>
          </div>
        </div>

        <div className={styles.tabs}>
          <button className={styles.tabBtn} data-active={tab === 'sheet' ? '1' : '0'} onClick={() => setTab('sheet')}>
            Sheet
          </button>
          <button
            className={styles.tabBtn}
            data-active={tab === 'photos' ? '1' : '0'}
            onClick={() => setTab('photos')}
          >
            Photos
          </button>
          <button
            className={styles.tabBtn}
            data-active={tab === 'notes' ? '1' : '0'}
            onClick={() => setTab('notes')}
          >
            Notes
          </button>
          <button
            className={styles.tabBtn}
            data-active={tab === 'tools' ? '1' : '0'}
            onClick={() => setTab('tools')}
          >
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
                <div className={styles.sectionTitle}>Sheet (placeholder)</div>
                <div className={styles.muted}>Next: render the canonical template fields and wire `Save`.</div>
              </>
            ) : tab === 'photos' ? (
              <>
                <div className={styles.sectionTitle}>Photos</div>
                <div className={styles.muted}>Media lives in the left pane; this panel will hold photo metadata/edit tools.</div>
              </>
            ) : tab === 'tools' ? (
              <>
                <div className={styles.sectionTitle}>Tools</div>
                <div className={styles.muted}>Next: exports, packs, template tools, etc.</div>
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
  );
}

import React from 'react';
import styles from './mediaPane.module.css';

type MediaImage = {
  id: string;
  favorite: boolean;
  rating: number;
  notes: string;
  tags: string[];
};

type RatingOp = 'any' | '=' | '<' | '<=' | '>' | '>=';

function ratingFromKeyCode(code: string): number | null {
  switch (code) {
    case 'Digit1':
    case 'Numpad1':
      return 1;
    case 'Digit2':
    case 'Numpad2':
      return 2;
    case 'Digit3':
    case 'Numpad3':
      return 3;
    case 'Digit4':
    case 'Numpad4':
      return 4;
    case 'Digit5':
    case 'Numpad5':
      return 5;
    default:
      return null;
  }
}

function isEditableActiveElement(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function passesRatingFilter(value: number, op: RatingOp, target: number): boolean {
  const v = Number(value) || 0;
  const t = Number(target) || 0;
  switch (op) {
    case 'any':
      return true;
    case '=':
      return v === t;
    case '<':
      return v < t;
    case '<=':
      return v <= t;
    case '>':
      return v > t;
    case '>=':
      return v >= t;
    default:
      return true;
  }
}

export function MediaPane({
  images,
  defaultShowThumbnails = false,
  defaultShowControls = false,
  emptyLabel = 'No images.',
  onPatchImageMeta,
}: {
  images: MediaImage[];
  defaultShowThumbnails?: boolean;
  defaultShowControls?: boolean;
  emptyLabel?: string;
  onPatchImageMeta?: (imageId: string, patch: Partial<Pick<MediaImage, 'favorite' | 'rating' | 'notes' | 'tags'>>) => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(images[0]?.id ?? null);
  const [showThumbnails, setShowThumbnails] = React.useState<boolean>(defaultShowThumbnails);
  const [showControls, setShowControls] = React.useState<boolean>(defaultShowControls);
  const [busyImageId, setBusyImageId] = React.useState<string | null>(null);
  const [filterFavoriteOnly, setFilterFavoriteOnly] = React.useState<boolean>(false);
  const [filterRatingOp, setFilterRatingOp] = React.useState<RatingOp>('any');
  const [filterRatingValue, setFilterRatingValue] = React.useState<number>(0);
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState<boolean>(false);
  const [slideshowOn, setSlideshowOn] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Keep selection valid when the underlying image list changes.
    if (!images.some((i) => i.id === selectedId)) setSelectedId(images[0]?.id ?? null);
  }, [images, selectedId]);

  const filteredImages = React.useMemo(() => {
    return images.filter((img) => {
      if (filterFavoriteOnly && !img.favorite) return false;
      if (!passesRatingFilter(img.rating, filterRatingOp, filterRatingValue)) return false;
      return true;
    });
  }, [images, filterFavoriteOnly, filterRatingOp, filterRatingValue]);

  React.useEffect(() => {
    // Keep selection valid when filters change.
    if (!filteredImages.some((i) => i.id === selectedId)) {
      setSelectedId(filteredImages[0]?.id ?? null);
    }
  }, [filteredImages, selectedId]);

  const selected = selectedId ? filteredImages.find((i) => i.id === selectedId) ?? null : null;
  const isBusy = !!busyImageId && busyImageId === selected?.id;

  const patchMeta = async (
    imageId: string,
    patch: Partial<Pick<MediaImage, 'favorite' | 'rating' | 'notes' | 'tags'>>
  ) => {
    setBusyImageId(imageId);
    try {
      await window.ckc.setImageMeta({ imageId, ...patch });
      onPatchImageMeta?.(imageId, patch);
    } finally {
      setBusyImageId(null);
    }
  };

  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (!selected || isBusy) return;
      if (evt.repeat) return;
      if (isEditableActiveElement()) return;

      const isAltGraph = evt.getModifierState?.('AltGraph') || (evt.ctrlKey && evt.altKey && !evt.metaKey);
      if (!isAltGraph) return;

      const rating = ratingFromKeyCode(evt.code);
      if (!rating) return;

      evt.preventDefault();
      void patchMeta(selected.id, { rating });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, isBusy, patchMeta]);

  React.useEffect(() => {
    if (!isFullscreenOpen) return;

    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        setIsFullscreenOpen(false);
        return;
      }
      if (evt.key === 'ArrowLeft') {
        evt.preventDefault();
        const idx = selected ? filteredImages.findIndex((i) => i.id === selected.id) : -1;
        if (idx > 0) setSelectedId(filteredImages[idx - 1].id);
        return;
      }
      if (evt.key === 'ArrowRight' || evt.key === ' ') {
        evt.preventDefault();
        const idx = selected ? filteredImages.findIndex((i) => i.id === selected.id) : -1;
        if (idx >= 0 && idx < filteredImages.length - 1) setSelectedId(filteredImages[idx + 1].id);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreenOpen, filteredImages, selected]);

  React.useEffect(() => {
    if (!isFullscreenOpen || !slideshowOn) return;
    if (filteredImages.length <= 1) return;

    const id = window.setInterval(() => {
      setSelectedId((cur) => {
        const idx = cur ? filteredImages.findIndex((i) => i.id === cur) : -1;
        const nextIdx = idx >= 0 ? (idx + 1) % filteredImages.length : 0;
        return filteredImages[nextIdx]?.id ?? cur;
      });
    }, 2500);

    return () => window.clearInterval(id);
  }, [isFullscreenOpen, slideshowOn, filteredImages]);

  return (
    <div className={styles.root}>
      <div className={styles.viewer}>
        {selected ? (
          <img className={styles.viewerImg} src={`ckc://image/${encodeURIComponent(selected.id)}`} alt="" />
        ) : (
          <div className={styles.empty}>{emptyLabel}</div>
        )}

        <div className={styles.overlay}>
          <button className={styles.overlayBtn} onClick={() => setShowControls((v) => !v)}>
            {showControls ? 'Hide controls' : 'Controls'}
          </button>
          <button className={styles.overlayBtn} onClick={() => setShowThumbnails((v) => !v)}>
            {showThumbnails ? 'Hide thumbs' : 'Thumbs'}
          </button>
          <button className={styles.overlayBtn} onClick={() => setIsFullscreenOpen(true)} disabled={!selected}>
            Fullscreen
          </button>
        </div>

        {selected && showControls ? (
          <div className={styles.controls}>
            <button
              className={styles.controlBtn}
              disabled={isBusy}
              onClick={() => patchMeta(selected.id, { favorite: !selected.favorite })}
              title="Favorite"
            >
              {selected.favorite ? '★ Favorite' : '☆ Favorite'}
            </button>

            <div className={styles.stars} aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={styles.starBtn}
                  disabled={isBusy}
                  onClick={() => patchMeta(selected.id, { rating: n })}
                  title={`${n} star`}
                >
                  {selected.rating >= n ? '★' : '☆'}
                </button>
              ))}
              <button
                className={styles.clearBtn}
                disabled={isBusy}
                onClick={() => patchMeta(selected.id, { rating: 0 })}
                title="Clear rating"
              >
                Clear
              </button>
            </div>

            <div className={styles.tags}>
              {(['carousel', 'frontpage'] as const).map((tag) => {
                const active = (selected.tags || []).includes(tag);
                return (
                  <button
                    key={tag}
                    className={styles.tagBtn}
                    data-active={active ? '1' : '0'}
                    disabled={isBusy}
                    onClick={() => {
                      const base = Array.isArray(selected.tags) ? selected.tags : [];
                      const next = active ? base.filter((t) => t !== tag) : Array.from(new Set([...base, tag]));
                      void patchMeta(selected.id, { tags: next });
                    }}
                    title={`Toggle tag: ${tag}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className={styles.filterRow}>
              <div className={styles.filterTitle}>Filters</div>
              <label className={styles.filterItem}>
                <input
                  type="checkbox"
                  checked={filterFavoriteOnly}
                  onChange={(e) => setFilterFavoriteOnly(e.target.checked)}
                />{' '}
                Favorites only
              </label>
              <label className={styles.filterItem}>
                Rating{' '}
                <select value={filterRatingOp} onChange={(e) => setFilterRatingOp(e.target.value as RatingOp)}>
                  <option value="any">Any</option>
                  <option value="=">=</option>
                  <option value=">=">≥</option>
                  <option value="<=">≤</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                </select>{' '}
                <select value={String(filterRatingValue)} onChange={(e) => setFilterRatingValue(Number(e.target.value) || 0)}>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {showThumbnails ? (
        <div
          className={styles.thumbs}
          onWheel={(evt) => {
            if (!evt.currentTarget) return;
            evt.currentTarget.scrollLeft += evt.deltaY;
          }}
        >
          {filteredImages.map((img) => (
            <button
              key={img.id}
              className={styles.thumbBtn}
              data-selected={img.id === selectedId ? '1' : '0'}
              onClick={() => setSelectedId(img.id)}
              title={img.tags?.length ? img.tags.join(', ') : undefined}
            >
              <img className={styles.thumbImg} src={`ckc://thumb/${encodeURIComponent(img.id)}`} alt="" />
            </button>
          ))}
        </div>
      ) : null}

      {isFullscreenOpen ? (
        <div className={styles.fullscreen} role="dialog" aria-label="Fullscreen viewer">
          <div className={styles.fullscreenTop}>
            <div className={styles.fullscreenTitle}>
              {filteredImages.length ? `${filteredImages.findIndex((i) => i.id === selectedId) + 1} / ${filteredImages.length}` : ''}
            </div>
            <div className={styles.fullscreenActions}>
              <button className={styles.overlayBtn} onClick={() => setSlideshowOn((v) => !v)} disabled={filteredImages.length <= 1}>
                {slideshowOn ? 'Stop' : 'Slideshow'}
              </button>
              <button className={styles.overlayBtn} onClick={() => setIsFullscreenOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <div className={styles.fullscreenBody} onClick={() => setIsFullscreenOpen(false)}>
            {selected ? (
              <img
                className={styles.fullscreenImg}
                src={`ckc://image/${encodeURIComponent(selected.id)}`}
                alt=""
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className={styles.empty}>{emptyLabel}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

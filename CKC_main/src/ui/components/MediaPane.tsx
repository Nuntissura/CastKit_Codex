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
    case 'Digit0':
    case 'Numpad0':
      return 0;
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
  autoOpenControlsOnSelect = false,
  enableViewerSlideshow = false,
  autoStartSlideshow = false,
  slideshowIntervalMs = 2500,
  emptyLabel = 'No images.',
  headerLeft = null,
  showCarouselToggleOnThumbs = false,
  onOpenDiagnostics,
  onPatchImageMeta,
}: {
  images: MediaImage[];
  defaultShowThumbnails?: boolean;
  defaultShowControls?: boolean;
  autoOpenControlsOnSelect?: boolean;
  enableViewerSlideshow?: boolean;
  autoStartSlideshow?: boolean;
  slideshowIntervalMs?: number;
  emptyLabel?: string;
  headerLeft?: React.ReactNode;
  showCarouselToggleOnThumbs?: boolean;
  onOpenDiagnostics?: () => void;
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
  const didUserToggleSlideshowRef = React.useRef<boolean>(false);
  const [draftNotes, setDraftNotes] = React.useState<string>('');
  const [viewerError, setViewerError] = React.useState<boolean>(false);
  const [reloadToken, setReloadToken] = React.useState<number>(0);
  const altLeftDownRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.code === 'AltLeft') altLeftDownRef.current = true;
    };
    const onKeyUp = (evt: KeyboardEvent) => {
      if (evt.code === 'AltLeft') altLeftDownRef.current = false;
    };
    const onBlur = () => {
      altLeftDownRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

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

  const filtersActive = filterFavoriteOnly || filterRatingOp !== 'any';
  const hasAnyImages = images.length > 0;
  const noMatches = hasAnyImages && filteredImages.length === 0;

  React.useEffect(() => {
    // Keep selection valid when filters change.
    if (!filteredImages.some((i) => i.id === selectedId)) {
      setSelectedId(filteredImages[0]?.id ?? null);
    }
  }, [filteredImages, selectedId]);

  const selected = selectedId ? filteredImages.find((i) => i.id === selectedId) ?? null : null;
  const isBusy = !!busyImageId && busyImageId === selected?.id;
  const notesIsDirty = !!selected && String(draftNotes ?? '') !== String(selected.notes ?? '');
  const didInitialSelectionRef = React.useRef<boolean>(false);

  const clearFilters = React.useCallback(() => {
    setFilterFavoriteOnly(false);
    setFilterRatingOp('any');
    setFilterRatingValue(0);
  }, []);

  const toggleSlideshow = React.useCallback(() => {
    didUserToggleSlideshowRef.current = true;
    setSlideshowOn((v) => !v);
  }, []);

  React.useEffect(() => {
    if (!autoStartSlideshow) return;
    if (!enableViewerSlideshow) return;
    if (didUserToggleSlideshowRef.current) return;
    if (filteredImages.length <= 1) return;
    setSlideshowOn(true);
  }, [autoStartSlideshow, enableViewerSlideshow, filteredImages.length]);

  React.useEffect(() => {
    if (!selected) {
      setDraftNotes('');
      setViewerError(false);
      return;
    }
    setDraftNotes(String(selected.notes ?? ''));
    setViewerError(false);
  }, [selected?.id, selected?.notes]);

  React.useEffect(() => {
    if (!autoOpenControlsOnSelect) return;
    if (!selected) return;
    if (!didInitialSelectionRef.current) {
      didInitialSelectionRef.current = true;
      return;
    }
    if (!showControls) setShowControls(true);
  }, [autoOpenControlsOnSelect, selected?.id, showControls]);

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

      if (!altLeftDownRef.current) return;
      if (evt.ctrlKey || evt.metaKey || evt.shiftKey) return;
      if (evt.getModifierState?.('AltGraph')) return;

      const rating = ratingFromKeyCode(evt.code);
      if (rating === null) return;

      evt.preventDefault();
      void patchMeta(selected.id, { rating });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, isBusy, patchMeta]);

  React.useEffect(() => {
    if (isFullscreenOpen) return;

    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.repeat) return;
      if (isEditableActiveElement()) return;

      if (evt.key === 'ArrowLeft') {
        evt.preventDefault();
        const idx = selected ? filteredImages.findIndex((i) => i.id === selected.id) : -1;
        if (idx > 0) setSelectedId(filteredImages[idx - 1].id);
        return;
      }
      if (evt.key === 'ArrowRight') {
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

    const ms = Math.max(800, Math.min(60_000, Number(slideshowIntervalMs) || 2500));
    const id = window.setInterval(() => {
      setSelectedId((cur) => {
        const idx = cur ? filteredImages.findIndex((i) => i.id === cur) : -1;
        const nextIdx = idx >= 0 ? (idx + 1) % filteredImages.length : 0;
        return filteredImages[nextIdx]?.id ?? cur;
      });
    }, ms);

    return () => window.clearInterval(id);
  }, [isFullscreenOpen, slideshowOn, filteredImages, slideshowIntervalMs]);

  React.useEffect(() => {
    const canRunViewer = enableViewerSlideshow && !showControls && !isFullscreenOpen;
    if (!canRunViewer || !slideshowOn) return;
    if (filteredImages.length <= 1) return;

    const ms = Math.max(800, Math.min(60_000, Number(slideshowIntervalMs) || 2500));
    const id = window.setInterval(() => {
      setSelectedId((cur) => {
        const idx = cur ? filteredImages.findIndex((i) => i.id === cur) : -1;
        const nextIdx = idx >= 0 ? (idx + 1) % filteredImages.length : 0;
        return filteredImages[nextIdx]?.id ?? cur;
      });
    }, ms);

    return () => window.clearInterval(id);
  }, [enableViewerSlideshow, showControls, isFullscreenOpen, slideshowOn, filteredImages, slideshowIntervalMs]);

  React.useEffect(() => {
    if (enableViewerSlideshow) return;
    if (isFullscreenOpen) return;
    if (!slideshowOn) return;
    setSlideshowOn(false);
  }, [enableViewerSlideshow, isFullscreenOpen, slideshowOn]);

  const toggleCarouselTag = React.useCallback(
    (img: MediaImage) => {
      const base = Array.isArray(img.tags) ? img.tags : [];
      const active = base.includes('carousel');
      const next = active ? base.filter((t) => t !== 'carousel') : Array.from(new Set([...base, 'carousel']));
      void patchMeta(img.id, { tags: next });
    },
    [patchMeta]
  );

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>{headerLeft}</div>
        <div className={styles.topBarRight}>
          {enableViewerSlideshow ? (
            <button
              className={styles.topBtn}
              data-active={slideshowOn ? '1' : '0'}
              onClick={toggleSlideshow}
              disabled={filteredImages.length <= 1}
              title="Auto-advance images"
            >
              {slideshowOn ? 'Stop' : 'Slideshow'}
            </button>
          ) : null}
          <button
            className={styles.topBtn}
            data-active={showControls ? '1' : '0'}
            onClick={() => setShowControls((v) => !v)}
          >
            Controls
          </button>
          <button
            className={styles.topBtn}
            data-active={showThumbnails ? '1' : '0'}
            onClick={() => setShowThumbnails((v) => !v)}
          >
            Thumbs
          </button>
          <button className={styles.topBtn} onClick={() => setIsFullscreenOpen(true)} disabled={!selected}>
            Fullscreen
          </button>
        </div>
      </div>

      {showControls ? (
        <div className={styles.controlsPanel}>
          <div className={styles.filterRow}>
            <div className={styles.filterTitle}>Filters</div>
            <label className={styles.filterItem}>
              <input type="checkbox" checked={filterFavoriteOnly} onChange={(e) => setFilterFavoriteOnly(e.target.checked)} /> Favorites only
            </label>
            <label className={styles.filterItem}>
              Rating{' '}
              <select value={filterRatingOp} onChange={(e) => setFilterRatingOp(e.target.value as RatingOp)}>
                <option value="any">Any</option>
                <option value="=">=</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
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

            {filtersActive ? (
              <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.viewer}>
        {noMatches ? (
          <div className={styles.noMatches}>
            <div className={styles.noMatchesTitle}>No images match filters.</div>
            <button className={styles.noMatchesBtn} onClick={clearFilters} disabled={!filtersActive}>
              Clear filters
            </button>
          </div>
        ) : selected && !viewerError ? (
          <img
            className={styles.viewerImg}
            src={`ckc://image/${encodeURIComponent(selected.id)}?r=${reloadToken}`}
            alt=""
            onClick={() => {
              if (!autoOpenControlsOnSelect) return;
              if (showControls) return;
              setShowControls(true);
            }}
            onError={() => setViewerError(true)}
          />
        ) : selected && viewerError ? (
          <div className={styles.missing}>
            <div className={styles.missingTitle}>Missing image file</div>
            <div className={styles.missingHint}>
              This image exists in the database, but the file is missing on disk (or the Library Root points at the wrong folder).
            </div>
            <div className={styles.missingActions}>
              <button
                className={styles.missingBtn}
                onClick={() => {
                  setViewerError(false);
                  setReloadToken((n) => n + 1);
                }}
              >
                Retry
              </button>
              <button
                className={styles.missingBtn}
                onClick={async () => {
                  const next = await window.ckc.selectLibraryRoot();
                  if (!next) return;
                  setViewerError(false);
                  setReloadToken((n) => n + 1);
                }}
                title="Pick the folder that contains db/, characters/, exports/"
              >
                Change library folder...
              </button>
              {onOpenDiagnostics ? (
                <button className={styles.missingBtn} onClick={onOpenDiagnostics}>
                  Open diagnostics
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={styles.empty}>{emptyLabel}</div>
        )}

        {selected && showControls ? (
          <div className={styles.bottomBar} aria-label="Image metadata">
            <div className={styles.notesRow}>
              <div className={styles.notesTitle}>Notes</div>

              <div className={styles.notesRight}>
                <div className={styles.metaControls} aria-label="Controls">
                  <button
                    className={styles.tagBtn}
                    data-active={selected.favorite ? '1' : '0'}
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
                </div>

                <button
                  className={styles.notesSave}
                  disabled={isBusy || !notesIsDirty}
                  onClick={() => void patchMeta(selected.id, { notes: String(draftNotes ?? '') })}
                  title="Save notes"
                >
                  {isBusy ? 'Saving…' : notesIsDirty ? 'Save' : 'Saved'}
                </button>
              </div>
            </div>

            <textarea
              className={styles.notesInput}
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              onBlur={() => {
                if (!selected) return;
                if (!notesIsDirty) return;
                void patchMeta(selected.id, { notes: String(draftNotes ?? '') });
              }}
              placeholder="Notes…"
            />

            <div className={styles.metaTagsRow} aria-label="Tags">
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
          {filteredImages.map((img) => {
            const carouselActive = (img.tags || []).includes('carousel');
            const thumbBusy = busyImageId === img.id;
            return (
              <div key={img.id} className={styles.thumbItem}>
                {showCarouselToggleOnThumbs ? (
                  <button
                    className={styles.thumbCarouselBtn}
                    data-active={carouselActive ? '1' : '0'}
                    disabled={thumbBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCarouselTag(img);
                    }}
                    title={carouselActive ? 'Remove from carousel' : 'Add to carousel'}
                  >
                    {carouselActive ? '✓' : '+'}
                  </button>
                ) : null}

                <button
                  className={styles.thumbBtn}
                  data-selected={img.id === selectedId ? '1' : '0'}
                  onClick={() => setSelectedId(img.id)}
                  title={img.tags?.length ? img.tags.join(', ') : undefined}
                >
                  <img className={styles.thumbImg} src={`ckc://thumb/${encodeURIComponent(img.id)}?r=${reloadToken}`} alt="" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {isFullscreenOpen ? (
        <div className={styles.fullscreen} role="dialog" aria-label="Fullscreen viewer">
          <div className={styles.fullscreenTop}>
            <div className={styles.fullscreenTitle}>
              {filteredImages.length ? `${filteredImages.findIndex((i) => i.id === selectedId) + 1} / ${filteredImages.length}` : ''}
            </div>
            <div className={styles.fullscreenActions}>
              <button className={styles.overlayBtn} onClick={toggleSlideshow} disabled={filteredImages.length <= 1}>
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
                src={`ckc://image/${encodeURIComponent(selected.id)}?r=${reloadToken}`}
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

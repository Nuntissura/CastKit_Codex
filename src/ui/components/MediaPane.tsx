import React from 'react';
import styles from './mediaPane.module.css';

type MediaImage = {
  id: string;
  favorite: boolean;
  rating: number;
  notes: string;
  tags: string[];
};

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

  React.useEffect(() => {
    if (!images.some((i) => i.id === selectedId)) {
      setSelectedId(images[0]?.id ?? null);
    }
  }, [images, selectedId]);

  const selected = selectedId ? images.find((i) => i.id === selectedId) ?? null : null;
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
          {images.map((img) => (
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
    </div>
  );
}

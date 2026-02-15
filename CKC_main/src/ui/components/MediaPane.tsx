import React from 'react';
import styles from './mediaPane.module.css';

type MediaImage = {
  id: string;
  favorite: boolean;
  rating: number;
  notes: string;
  sourceUrl?: string | null;
  sourceNote?: string;
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

function tagsTextToArray(text: string): string[] {
  const parts = String(text || '')
    .split(/[,\n\r\t]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
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
  allTags = [],
  selectImageId = null,
  onSelectionChange,
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
  allTags?: string[];
  selectImageId?: string | null;
  onSelectionChange?: (selectedIds: string[], primaryId: string | null) => void;
  onOpenDiagnostics?: () => void;
  onPatchImageMeta?: (imageId: string, patch: Partial<Pick<MediaImage, 'favorite' | 'rating' | 'notes' | 'tags' | 'sourceNote'>>) => void;
}) {
  const [primarySelectedId, setPrimarySelectedId] = React.useState<string | null>(images[0]?.id ?? null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>(() => (images[0]?.id ? [images[0].id] : []));
  const [showThumbnails, setShowThumbnails] = React.useState<boolean>(defaultShowThumbnails);
  const [showControls, setShowControls] = React.useState<boolean>(defaultShowControls);
  const [busyImageId, setBusyImageId] = React.useState<string | null>(null);
  const [imageBacklinks, setImageBacklinks] = React.useState<CKCBacklinkEntry[]>([]);
  const [imageBacklinksError, setImageBacklinksError] = React.useState<string | null>(null);
  const [imageBacklinksBusy, setImageBacklinksBusy] = React.useState<boolean>(false);
  const [showPins, setShowPins] = React.useState<boolean>(false);
  const [pinMode, setPinMode] = React.useState<boolean>(false);
  const [pins, setPins] = React.useState<CKCImageAnnotations['pins']>([]);
  const [pinsBusy, setPinsBusy] = React.useState<boolean>(false);
  const [pinsError, setPinsError] = React.useState<string | null>(null);
  const [busyBatch, setBusyBatch] = React.useState<boolean>(false);
  const [filterFavoriteOnly, setFilterFavoriteOnly] = React.useState<boolean>(false);
  const [filterRatingOp, setFilterRatingOp] = React.useState<RatingOp>('any');
  const [filterRatingValue, setFilterRatingValue] = React.useState<number>(0);
  const [isFullscreenOpen, setIsFullscreenOpen] = React.useState<boolean>(false);
  const [slideshowOn, setSlideshowOn] = React.useState<boolean>(false);
  const didUserToggleSlideshowRef = React.useRef<boolean>(false);
  const [draftNotes, setDraftNotes] = React.useState<string>('');
  const [draftSourceNote, setDraftSourceNote] = React.useState<string>('');
  const [tagDraft, setTagDraft] = React.useState<string>('');
  const [viewerError, setViewerError] = React.useState<boolean>(false);
  const [reloadToken, setReloadToken] = React.useState<number>(0);
  const altLeftDownRef = React.useRef<boolean>(false);
  const selectionAnchorRef = React.useRef<string | null>(images[0]?.id ?? null);
  const externalSelectAppliedRef = React.useRef<string | null>(null);
  const viewerRef = React.useRef<HTMLDivElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [fitRect, setFitRect] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const tagsDatalistId = React.useId();

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

  const recalcFitRect = React.useCallback(() => {
    const viewer = viewerRef.current;
    const img = imgRef.current;
    if (!viewer || !img) {
      setFitRect(null);
      return;
    }

    const cw = viewer.clientWidth;
    const ch = viewer.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!(cw > 0 && ch > 0 && iw > 0 && ih > 0)) {
      setFitRect(null);
      return;
    }

    const scale = Math.min(cw / iw, ch / ih);
    const w = iw * scale;
    const h = ih * scale;
    const x = (cw - w) / 2;
    const y = (ch - h) / 2;
    setFitRect({ x, y, w, h });
  }, []);

  React.useEffect(() => {
    const onResize = () => recalcFitRect();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recalcFitRect]);

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
    // Keep selection valid when the filtered image list changes.
    const available = new Set(filteredImages.map((i) => i.id));
    let nextSelected = selectedIds.filter((id) => available.has(id));
    let nextPrimary = primarySelectedId && available.has(primarySelectedId) ? primarySelectedId : null;

    if (filteredImages.length === 0) {
      if (primarySelectedId !== null) setPrimarySelectedId(null);
      if (selectedIds.length !== 0) setSelectedIds([]);
      return;
    }

    if (nextSelected.length === 0) {
      const first = filteredImages[0].id;
      selectionAnchorRef.current = first;
      nextSelected = [first];
      nextPrimary = first;
    }

    if (!nextPrimary || !nextSelected.includes(nextPrimary)) nextPrimary = nextSelected[0] ?? null;

    const nextSet = new Set(nextSelected);
    nextSelected = filteredImages.filter((i) => nextSet.has(i.id)).map((i) => i.id);

    if (nextPrimary !== primarySelectedId) setPrimarySelectedId(nextPrimary);
    if (nextSelected.length !== selectedIds.length || nextSelected.some((id, idx) => id !== selectedIds[idx])) {
      setSelectedIds(nextSelected);
    }
  }, [filteredImages, primarySelectedId, selectedIds]);

  React.useEffect(() => {
    onSelectionChange?.(selectedIds, primarySelectedId);
  }, [onSelectionChange, selectedIds, primarySelectedId]);

  const primarySelected = primarySelectedId ? filteredImages.find((i) => i.id === primarySelectedId) ?? null : null;
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedImages = React.useMemo(() => filteredImages.filter((i) => selectedSet.has(i.id)), [filteredImages, selectedSet]);
  const selectionCount = selectedImages.length;

  React.useEffect(() => {
    void window.ckc.setReferenceSelection({ imageId: primarySelectedId });
  }, [primarySelectedId]);

  React.useEffect(() => {
    if (!showPins) {
      if (pinMode) setPinMode(false);
      if (pinsError) setPinsError(null);
    }
    if (selectionCount !== 1 && pinMode) setPinMode(false);
  }, [showPins, selectionCount, pinMode, pinsError]);

  React.useEffect(() => {
    if (!showPins) return;
    if (selectionCount !== 1 || !primarySelectedId) {
      setPins([]);
      return;
    }

    let cancelled = false;
    setPinsError(null);
    setPinsBusy(true);
    window.ckc
      .getImageAnnotations({ imageId: primarySelectedId })
      .then((res: any) => {
        if (cancelled) return;
        const nextPins = Array.isArray(res?.annotations?.pins) ? res.annotations.pins : [];
        setPins(nextPins);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPinsError(err instanceof Error ? err.message : String(err));
        setPins([]);
      })
      .finally(() => {
        if (cancelled) return;
        setPinsBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showPins, selectionCount, primarySelectedId]);

  React.useEffect(() => {
    if (!showPins) return;
    recalcFitRect();
  }, [showPins, primarySelectedId, recalcFitRect]);

  const isBusy = busyBatch || !!busyImageId || pinsBusy;
  const notesIsDirty = selectionCount === 1 && !!primarySelected && String(draftNotes ?? '') !== String(primarySelected.notes ?? '');
  const sourceNoteIsDirty =
    selectionCount === 1 && !!primarySelected && String(draftSourceNote ?? '') !== String(primarySelected.sourceNote ?? '');
  const didInitialSelectionRef = React.useRef<boolean>(false);

  const savePins = React.useCallback(
    async (nextPins: CKCImageAnnotations['pins']) => {
      const id = String(primarySelectedId ?? '').trim();
      if (!id) return;
      setPins(nextPins);
      setPinsError(null);
      setPinsBusy(true);
      try {
        await window.ckc.setImageAnnotations({ imageId: id, annotations: { version: 1, pins: nextPins } });
      } catch (err: unknown) {
        setPinsError(err instanceof Error ? err.message : String(err));
      } finally {
        setPinsBusy(false);
      }
    },
    [primarySelectedId]
  );

  const clearFilters = React.useCallback(() => {
    setFilterFavoriteOnly(false);
    setFilterRatingOp('any');
    setFilterRatingValue(0);
  }, []);

  React.useEffect(() => {
    const want = String(selectImageId ?? '').trim();
    if (!want) return;
    if (externalSelectAppliedRef.current === want) return;

    const existsInAll = images.some((img) => img.id === want);
    if (!existsInAll) return;

    if (filtersActive && !filteredImages.some((img) => img.id === want)) {
      clearFilters();
      return;
    }

    externalSelectAppliedRef.current = want;
    selectionAnchorRef.current = want;
    setPrimarySelectedId(want);
    setSelectedIds([want]);
    if (autoOpenControlsOnSelect) setShowControls(true);
  }, [selectImageId, images, filteredImages, filtersActive, clearFilters, autoOpenControlsOnSelect]);

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
    if (selectionCount !== 1 || !primarySelected) {
      setDraftNotes('');
      setDraftSourceNote('');
      setViewerError(false);
      return;
    }
    setDraftNotes(String(primarySelected.notes ?? ''));
    setDraftSourceNote(String(primarySelected.sourceNote ?? ''));
    setViewerError(false);
  }, [selectionCount, primarySelected?.id, primarySelected?.notes, primarySelected?.sourceNote]);

  React.useEffect(() => {
    if (!autoOpenControlsOnSelect) return;
    if (!primarySelected) return;
    if (!didInitialSelectionRef.current) {
      didInitialSelectionRef.current = true;
      return;
    }
    if (!showControls) setShowControls(true);
  }, [autoOpenControlsOnSelect, primarySelected?.id, showControls]);

  const reloadImageBacklinks = React.useCallback(async () => {
    const id = String(primarySelectedId ?? '').trim();
    if (!id) {
      setImageBacklinks([]);
      return;
    }
    setImageBacklinksError(null);
    setImageBacklinksBusy(true);
    try {
      const rows = await window.ckc.listBacklinks({ targetType: 'image', targetId: id, limit: 250 });
      setImageBacklinks(Array.isArray(rows) ? rows : []);
    } catch (err: unknown) {
      setImageBacklinksError(err instanceof Error ? err.message : String(err));
      setImageBacklinks([]);
    } finally {
      setImageBacklinksBusy(false);
    }
  }, [primarySelectedId]);

  React.useEffect(() => {
    if (!showControls) return;
    if (!primarySelectedId) {
      setImageBacklinks([]);
      return;
    }
    void reloadImageBacklinks();
  }, [showControls, primarySelectedId, reloadImageBacklinks]);

  const patchMetaSingle = React.useCallback(
    async (imageId: string, patch: Partial<Pick<MediaImage, 'favorite' | 'rating' | 'notes' | 'tags' | 'sourceNote'>>) => {
      setBusyImageId(imageId);
      try {
        await window.ckc.setImageMeta({ imageId, ...patch });
        onPatchImageMeta?.(imageId, patch);
      } finally {
        setBusyImageId(null);
      }
    },
    [onPatchImageMeta]
  );

  const patchMetaBatch = React.useCallback(
    async (params: { imageIds: string[]; favorite?: boolean; rating?: number; addTags?: string[]; removeTags?: string[] }) => {
      const ids = Array.isArray(params.imageIds) ? params.imageIds : [];
      if (ids.length === 0) return;

      setBusyBatch(true);
      try {
        await window.ckc.setImagesMetaBatch(params);

        const byId = new Map<string, MediaImage>();
        for (const img of images) byId.set(img.id, img);

        if (params.favorite !== undefined) {
          for (const id of ids) onPatchImageMeta?.(id, { favorite: !!params.favorite });
        }

        if (params.rating !== undefined) {
          for (const id of ids) onPatchImageMeta?.(id, { rating: Math.max(0, Math.min(5, Number(params.rating) || 0)) });
        }

        const add = Array.isArray(params.addTags) ? params.addTags : [];
        const remove = Array.isArray(params.removeTags) ? params.removeTags : [];
        if (add.length > 0 || remove.length > 0) {
          const addSet = new Set(add.map((t) => String(t ?? '').trim()).filter(Boolean));
          const removeSet = new Set(remove.map((t) => String(t ?? '').trim()).filter(Boolean));
          for (const id of ids) {
            const cur = byId.get(id);
            const base = Array.isArray(cur?.tags) ? cur.tags : [];
            const next = [];
            const seen = new Set<string>();
            for (const t of base) {
              const s = String(t ?? '').trim();
              if (!s) continue;
              if (removeSet.has(s)) continue;
              if (seen.has(s)) continue;
              seen.add(s);
              next.push(s);
            }
            for (const t of Array.from(addSet)) {
              if (seen.has(t)) continue;
              seen.add(t);
              next.push(t);
            }
            onPatchImageMeta?.(id, { tags: next });
          }
        }
      } finally {
        setBusyBatch(false);
      }
    },
    [images, onPatchImageMeta]
  );

  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (selectionCount === 0 || !primarySelected) return;
      if (isBusy) return;
      if (evt.repeat) return;
      if (isEditableActiveElement()) return;

      if (!altLeftDownRef.current) return;
      if (evt.ctrlKey || evt.metaKey || evt.shiftKey) return;
      if (evt.getModifierState?.('AltGraph')) return;

      const rating = ratingFromKeyCode(evt.code);
      if (rating === null) return;

      evt.preventDefault();
      if (selectionCount === 1) {
        void patchMetaSingle(primarySelected.id, { rating });
      } else {
        void patchMetaBatch({ imageIds: selectedIds, rating });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [primarySelected, selectionCount, selectedIds, isBusy, patchMetaSingle, patchMetaBatch]);

  React.useEffect(() => {
    if (isFullscreenOpen) return;

    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.repeat) return;
      if (isEditableActiveElement()) return;

      if (evt.key === 'ArrowLeft') {
        evt.preventDefault();
        const idx = primarySelectedId ? filteredImages.findIndex((i) => i.id === primarySelectedId) : -1;
        if (idx > 0) {
          const next = filteredImages[idx - 1].id;
          selectionAnchorRef.current = next;
          setPrimarySelectedId(next);
          setSelectedIds([next]);
        }
        return;
      }
      if (evt.key === 'ArrowRight') {
        evt.preventDefault();
        const idx = primarySelectedId ? filteredImages.findIndex((i) => i.id === primarySelectedId) : -1;
        if (idx >= 0 && idx < filteredImages.length - 1) {
          const next = filteredImages[idx + 1].id;
          selectionAnchorRef.current = next;
          setPrimarySelectedId(next);
          setSelectedIds([next]);
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreenOpen, filteredImages, primarySelectedId]);

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
        const idx = primarySelectedId ? filteredImages.findIndex((i) => i.id === primarySelectedId) : -1;
        if (idx > 0) {
          const next = filteredImages[idx - 1].id;
          selectionAnchorRef.current = next;
          setPrimarySelectedId(next);
          setSelectedIds([next]);
        }
        return;
      }
      if (evt.key === 'ArrowRight' || evt.key === ' ') {
        evt.preventDefault();
        const idx = primarySelectedId ? filteredImages.findIndex((i) => i.id === primarySelectedId) : -1;
        if (idx >= 0 && idx < filteredImages.length - 1) {
          const next = filteredImages[idx + 1].id;
          selectionAnchorRef.current = next;
          setPrimarySelectedId(next);
          setSelectedIds([next]);
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreenOpen, filteredImages, primarySelectedId]);

  React.useEffect(() => {
    if (!isFullscreenOpen || !slideshowOn) return;
    if (filteredImages.length <= 1) return;

    const ms = Math.max(800, Math.min(60_000, Number(slideshowIntervalMs) || 2500));
    const id = window.setInterval(() => {
      setPrimarySelectedId((cur) => {
        const idx = cur ? filteredImages.findIndex((i) => i.id === cur) : -1;
        const nextIdx = idx >= 0 ? (idx + 1) % filteredImages.length : 0;
        const next = filteredImages[nextIdx]?.id ?? cur;
        if (next && next !== cur) {
          selectionAnchorRef.current = next;
          setSelectedIds([next]);
        }
        return next;
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
      setPrimarySelectedId((cur) => {
        const idx = cur ? filteredImages.findIndex((i) => i.id === cur) : -1;
        const nextIdx = idx >= 0 ? (idx + 1) % filteredImages.length : 0;
        const next = filteredImages[nextIdx]?.id ?? cur;
        if (next && next !== cur) {
          selectionAnchorRef.current = next;
          setSelectedIds([next]);
        }
        return next;
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
      void patchMetaSingle(img.id, { tags: next });
    },
    [patchMetaSingle]
  );

  const allFavorite = selectionCount > 0 && selectedImages.every((img) => !!img.favorite);
  const anyFavorite = selectionCount > 0 && selectedImages.some((img) => !!img.favorite);

  const commonTags = React.useMemo(() => {
    if (selectionCount === 0) return [];
    if (selectionCount === 1) return Array.isArray(primarySelected?.tags) ? primarySelected?.tags ?? [] : [];

    let common: Set<string> | null = null;
    for (const img of selectedImages) {
      const set = new Set<string>((img.tags || []).map((t) => String(t ?? '').trim()).filter(Boolean));
      if (common === null) {
        common = set;
        continue;
      }
      const next = new Set<string>();
      for (const t of common) {
        if (set.has(t)) next.add(t);
      }
      common = next;
    }
    return common ? Array.from(common).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })) : [];
  }, [selectionCount, selectedImages, primarySelected?.tags]);

  const applyFavoriteToggle = React.useCallback(() => {
    if (isBusy) return;
    if (selectionCount === 0) return;
    const next = !allFavorite;
    if (selectionCount === 1 && primarySelected) {
      void patchMetaSingle(primarySelected.id, { favorite: next });
      return;
    }
    void patchMetaBatch({ imageIds: selectedIds, favorite: next });
  }, [isBusy, selectionCount, allFavorite, primarySelected, selectedIds, patchMetaSingle, patchMetaBatch]);

  const applyRating = React.useCallback(
    (nextRating: number) => {
      if (isBusy) return;
      if (selectionCount === 0) return;
      if (selectionCount === 1 && primarySelected) {
        void patchMetaSingle(primarySelected.id, { rating: nextRating });
        return;
      }
      void patchMetaBatch({ imageIds: selectedIds, rating: nextRating });
    },
    [isBusy, selectionCount, primarySelected, selectedIds, patchMetaSingle, patchMetaBatch]
  );

  const toggleTagForSelection = React.useCallback(
    (tag: string) => {
      if (isBusy) return;
      const t = String(tag ?? '').trim();
      if (!t) return;
      if (selectionCount === 0) return;

      const allHave = selectedImages.every((img) => (img.tags || []).includes(t));
      if (selectionCount === 1 && primarySelected) {
        const base = Array.isArray(primarySelected.tags) ? primarySelected.tags : [];
        const next = allHave ? base.filter((x) => x !== t) : Array.from(new Set([...base, t]));
        void patchMetaSingle(primarySelected.id, { tags: next });
        return;
      }

      if (allHave) void patchMetaBatch({ imageIds: selectedIds, removeTags: [t] });
      else void patchMetaBatch({ imageIds: selectedIds, addTags: [t] });
    },
    [isBusy, selectionCount, selectedImages, primarySelected, selectedIds, patchMetaSingle, patchMetaBatch]
  );

  const removeTagFromSelection = React.useCallback(
    (tag: string) => {
      if (isBusy) return;
      const t = String(tag ?? '').trim();
      if (!t) return;
      if (selectionCount === 0) return;

      if (selectionCount === 1 && primarySelected) {
        const base = Array.isArray(primarySelected.tags) ? primarySelected.tags : [];
        const next = base.filter((x) => x !== t);
        void patchMetaSingle(primarySelected.id, { tags: next });
        return;
      }

      void patchMetaBatch({ imageIds: selectedIds, removeTags: [t] });
    },
    [isBusy, selectionCount, primarySelected, selectedIds, patchMetaSingle, patchMetaBatch]
  );

  const addTagsFromDraft = React.useCallback(() => {
    if (isBusy) return;
    const toAdd = tagsTextToArray(tagDraft);
    if (toAdd.length === 0) return;
    setTagDraft('');

    if (selectionCount === 0) return;
    if (selectionCount === 1 && primarySelected) {
      const base = Array.isArray(primarySelected.tags) ? primarySelected.tags : [];
      const next = Array.from(new Set([...base, ...toAdd]));
      void patchMetaSingle(primarySelected.id, { tags: next });
      return;
    }
    void patchMetaBatch({ imageIds: selectedIds, addTags: toAdd });
  }, [isBusy, tagDraft, selectionCount, primarySelected, selectedIds, patchMetaSingle, patchMetaBatch]);

  const onThumbClick = React.useCallback(
    (evt: React.MouseEvent, imageId: string) => {
      if (isBusy) return;
      const clicked = String(imageId || '');
      if (!clicked) return;

      if (evt.shiftKey) {
        const anchor = selectionAnchorRef.current ?? primarySelectedId ?? clicked;
        const start = filteredImages.findIndex((i) => i.id === anchor);
        const end = filteredImages.findIndex((i) => i.id === clicked);
        if (start < 0 || end < 0) {
          selectionAnchorRef.current = clicked;
          setPrimarySelectedId(clicked);
          setSelectedIds([clicked]);
          return;
        }

        const a = Math.min(start, end);
        const b = Math.max(start, end);
        const range = filteredImages.slice(a, b + 1).map((i) => i.id);
        const base = evt.ctrlKey || evt.metaKey ? selectedIds : [];
        const set = new Set<string>(base);
        for (const id of range) set.add(id);
        const ordered = filteredImages.filter((i) => set.has(i.id)).map((i) => i.id);
        setSelectedIds(ordered);
        setPrimarySelectedId(clicked);
        return;
      }

      if (evt.ctrlKey || evt.metaKey) {
        const set = new Set(selectedIds);
        if (set.has(clicked)) {
          if (set.size > 1) set.delete(clicked);
        } else {
          set.add(clicked);
        }
        const ordered = filteredImages.filter((i) => set.has(i.id)).map((i) => i.id);
        const nextPrimary = ordered.includes(clicked) ? clicked : ordered[ordered.length - 1] ?? ordered[0] ?? null;
        setSelectedIds(ordered.length ? ordered : [clicked]);
        setPrimarySelectedId(nextPrimary);
        if (nextPrimary) selectionAnchorRef.current = nextPrimary;
        return;
      }

      selectionAnchorRef.current = clicked;
      setPrimarySelectedId(clicked);
      setSelectedIds([clicked]);
    },
    [isBusy, filteredImages, primarySelectedId, selectedIds]
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
          <button className={styles.topBtn} onClick={() => setIsFullscreenOpen(true)} disabled={!primarySelected}>
            Fullscreen
          </button>
          <button
            className={styles.topBtn}
            onClick={() => {
              if (!primarySelectedId) return;
              void window.ckc
                .openReferenceWindow()
                .then(() => window.ckc.setReferenceSelection({ imageId: primarySelectedId }))
                .catch(() => {});
            }}
            disabled={!primarySelected}
            title="Open a pop-out reference window synced to selection"
          >
            Pop out
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

      <div
        className={styles.viewer}
        ref={viewerRef}
        onClick={(e) => {
          if (!pinMode) return;
          if (selectionCount !== 1 || !primarySelectedId) return;
          if (!fitRect) return;

          e.preventDefault();
          e.stopPropagation();

          const viewer = viewerRef.current;
          if (!viewer) return;
          const bounds = viewer.getBoundingClientRect();
          const xPx = e.clientX - bounds.left;
          const yPx = e.clientY - bounds.top;

          const rx = (xPx - fitRect.x) / fitRect.w;
          const ry = (yPx - fitRect.y) / fitRect.h;
          if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return;

          const proposed = window.prompt('Pin text:', '');
          if (proposed == null) return;
          const text = String(proposed || '').trim();
          if (!text) return;

          const id = `pin_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
          const next = [...pins, { id, x: rx, y: ry, text }];
          void savePins(next);
          setPinMode(false);
        }}
      >
        {noMatches ? (
          <div className={styles.noMatches}>
            <div className={styles.noMatchesTitle}>No images match filters.</div>
            <button className={styles.noMatchesBtn} onClick={clearFilters} disabled={!filtersActive}>
              Clear filters
            </button>
          </div>
        ) : primarySelected && !viewerError ? (
          <img
            className={styles.viewerImg}
            src={`ckc://image/${encodeURIComponent(primarySelected.id)}?r=${reloadToken}`}
            ref={imgRef}
            alt=""
            onClick={() => {
              if (!autoOpenControlsOnSelect) return;
              if (showControls) return;
              setShowControls(true);
            }}
            onLoad={() => recalcFitRect()}
            onError={() => setViewerError(true)}
          />
        ) : primarySelected && viewerError ? (
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

        {showPins && selectionCount === 1 && primarySelected && !viewerError && fitRect ? (
          <div className={styles.pinLayer} aria-label="Pins">
            {pinMode ? <div className={styles.pinHint}>Click on the image to place a pin…</div> : null}
            {pins.map((p) => {
              const left = fitRect.x + Number(p.x) * fitRect.w;
              const top = fitRect.y + Number(p.y) * fitRect.h;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={styles.pinMarker}
                  style={{ left, top }}
                  title={String(p.text || '')}
                  onClick={(evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    const proposed = window.prompt('Pin text (blank deletes):', String(p.text || ''));
                    if (proposed == null) return;
                    const nextText = String(proposed || '').trim();
                    if (!nextText) {
                      if (!window.confirm('Delete pin?')) return;
                      void savePins(pins.filter((x) => x.id !== p.id));
                      return;
                    }
                    void savePins(pins.map((x) => (x.id === p.id ? { ...x, text: nextText } : x)));
                  }}
                >
                  <div className={styles.pinDot} />
                  {String(p.text || '').trim() ? <div className={styles.pinLabel}>{String(p.text || '')}</div> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {selectionCount > 0 && showControls ? (
          <div className={styles.bottomBar} aria-label="Image metadata">
            <div className={styles.notesRow}>
              <div className={styles.notesTitle}>{selectionCount === 1 ? 'Notes' : `Selection: ${selectionCount}`}</div>

              <div className={styles.notesRight}>
                <div className={styles.metaControls} aria-label="Controls">
                  <button
                    className={styles.tagBtn}
                    data-active={allFavorite ? '1' : '0'}
                    disabled={isBusy}
                    onClick={applyFavoriteToggle}
                    title="Favorite"
                  >
                    {selectionCount === 1 ? (
                      primarySelected?.favorite ? (
                        '★ Favorite'
                      ) : (
                        '☆ Favorite'
                      )
                    ) : allFavorite ? (
                      '★ Favorite (all)'
                    ) : anyFavorite ? (
                      '☆ Favorite (mixed)'
                    ) : (
                      '☆ Favorite'
                    )}
                  </button>

                  <div className={styles.stars} aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        className={styles.starBtn}
                        disabled={isBusy}
                        onClick={() => applyRating(n)}
                        title={`${n} star`}
                      >
                        {selectionCount === 1 && (primarySelected?.rating ?? 0) >= n ? '★' : '☆'}
                      </button>
                    ))}
                    <button className={styles.clearBtn} disabled={isBusy} onClick={() => applyRating(0)} title="Clear rating">
                      Clear
                    </button>
                  </div>

                  <button
                    className={styles.tagBtn}
                    data-active={showPins ? '1' : '0'}
                    disabled={isBusy || selectionCount !== 1}
                    onClick={() =>
                      setShowPins((v) => {
                        const next = !v;
                        if (v && !next) setPinMode(false);
                        return next;
                      })
                    }
                    title="Show/hide pins"
                  >
                    {pinsBusy ? 'Pins…' : showPins ? `Pins (${pins.length})` : 'Pins'}
                  </button>

                  {showPins ? (
                    <button
                      className={styles.tagBtn}
                      data-active={pinMode ? '1' : '0'}
                      disabled={isBusy || selectionCount !== 1}
                      onClick={() => setPinMode((v) => !v)}
                      title="Add a pin"
                    >
                      {pinMode ? 'Cancel pin' : 'Add pin'}
                    </button>
                  ) : null}
                </div>

                {selectionCount === 1 && primarySelected ? (
                  <button
                    className={styles.notesSave}
                    disabled={isBusy || !notesIsDirty}
                    onClick={() => void patchMetaSingle(primarySelected.id, { notes: String(draftNotes ?? '') })}
                    title="Save notes"
                  >
                    {isBusy ? 'Saving…' : notesIsDirty ? 'Save' : 'Saved'}
                  </button>
                ) : (
                  <div className={styles.batchHint}>Batch edit</div>
                )}
              </div>
            </div>

            {selectionCount === 1 && primarySelected ? (
              <textarea
                className={styles.notesInput}
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                onBlur={() => {
                  if (!notesIsDirty) return;
                  void patchMetaSingle(primarySelected.id, { notes: String(draftNotes ?? '') });
                }}
                placeholder="Notes…"
                disabled={isBusy}
              />
            ) : (
              <div className={styles.batchNotesHint}>Notes are per-image. Select 1 image to edit notes.</div>
            )}

            <div className={styles.metaTagsRow} aria-label="Tags">
              <div className={styles.tagChipRow} aria-label="Current tags">
                {commonTags.map((t) => (
                  <button key={t} className={styles.tagChip} disabled={isBusy} onClick={() => removeTagFromSelection(t)} title="Remove tag">
                    {t} ×
                  </button>
                ))}
                {commonTags.length === 0 ? <span className={styles.tagsEmpty}>(no tags)</span> : null}
              </div>

              <div className={styles.tagActionsRow} aria-label="Tag actions">
                {(['carousel', 'frontpage'] as const).map((tag) => {
                  const active = selectedImages.every((img) => (img.tags || []).includes(tag));
                  return (
                    <button
                      key={tag}
                      className={styles.tagBtn}
                      data-active={active ? '1' : '0'}
                      disabled={isBusy}
                      onClick={() => toggleTagForSelection(tag)}
                      title={`Toggle tag: ${tag}`}
                    >
                      {tag}
                    </button>
                  );
                })}

                <input
                  className={styles.tagInput}
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTagsFromDraft();
                    }
                  }}
                  list={tagsDatalistId}
                  placeholder="Add tag…"
                  disabled={isBusy}
                />
                <button className={styles.tagBtn} onClick={addTagsFromDraft} disabled={isBusy || tagsTextToArray(tagDraft).length === 0}>
                  Add
                </button>
                <datalist id={tagsDatalistId}>
                  {(allTags || []).slice(0, 500).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>

            {showPins && pinsError ? <div style={{ color: 'rgba(255, 0, 0, 0.85)', marginTop: 10 }}>{pinsError}</div> : null}

            {selectionCount === 1 && primarySelected ? (
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 10, marginTop: 10 }} aria-label="Provenance">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Source URL</div>
                  {String(primarySelected.sourceUrl ?? '').trim() ? (
                    <>
                      <code
                        style={{
                          fontSize: '0.85rem',
                          maxWidth: '64ch',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                        }}
                        title={String(primarySelected.sourceUrl ?? '')}
                      >
                        {String(primarySelected.sourceUrl ?? '')}
                      </code>
                      <button
                        className={styles.tagBtn}
                        disabled={isBusy}
                        onClick={() => window.ckc.copyText(String(primarySelected.sourceUrl ?? ''))}
                        title="Copy source URL"
                      >
                        Copy
                      </button>
                    </>
                  ) : (
                    <span className={styles.tagsEmpty}>(none)</span>
                  )}
                </div>

                <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Source note</div>
                  <input
                    className={styles.tagInput}
                    style={{ flex: 1, minWidth: 260 }}
                    value={draftSourceNote}
                    onChange={(e) => setDraftSourceNote(e.target.value)}
                    onBlur={() => {
                      if (!sourceNoteIsDirty) return;
                      void patchMetaSingle(primarySelected.id, { sourceNote: String(draftSourceNote ?? '') });
                    }}
                    placeholder="(optional)"
                    disabled={isBusy}
                  />
                  <button
                    className={styles.notesSave}
                    disabled={isBusy || !sourceNoteIsDirty}
                    onClick={() => void patchMetaSingle(primarySelected.id, { sourceNote: String(draftSourceNote ?? '') })}
                    title="Save source note"
                  >
                    {isBusy ? 'Saving…' : sourceNoteIsDirty ? 'Save' : 'Saved'}
                  </button>
                </div>
              </div>
            ) : null}

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 10 }} aria-label="Backlinks">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800 }}>Backlinks ({imageBacklinks.length})</div>
                <button
                  className={styles.tagBtn}
                  disabled={imageBacklinksBusy}
                  onClick={() => void reloadImageBacklinks()}
                  title="Refresh backlinks for this image"
                >
                  {imageBacklinksBusy ? 'Loading…' : 'Refresh'}
                </button>
              </div>

              {imageBacklinksError ? (
                <div style={{ color: 'rgba(255, 0, 0, 0.85)', marginTop: 6 }}>{imageBacklinksError}</div>
              ) : null}

              {!imageBacklinksBusy && imageBacklinks.length === 0 ? (
                <div className={styles.tagsEmpty} style={{ marginTop: 6 }}>
                  (none)
                </div>
              ) : null}

              {imageBacklinks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {imageBacklinks.map((b) => (
                    <div key={`${b.sourceType}:${b.sourceId}:${b.rawText}`} style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} title={b.rawText}>
                      {b.label}
                    </div>
                  ))}
                </div>
              ) : null}
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
            return (
              <div key={img.id} className={styles.thumbItem}>
                {showCarouselToggleOnThumbs ? (
                  <button
                    className={styles.thumbCarouselBtn}
                    data-active={carouselActive ? '1' : '0'}
                    disabled={isBusy}
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
                  data-selected={selectedSet.has(img.id) ? '1' : '0'}
                  data-primary={img.id === primarySelectedId ? '1' : '0'}
                  onClick={(e) => onThumbClick(e, img.id)}
                  title={img.tags?.length ? img.tags.join(', ') : undefined}
                  disabled={isBusy}
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
              {filteredImages.length && primarySelectedId
                ? `${filteredImages.findIndex((i) => i.id === primarySelectedId) + 1} / ${filteredImages.length}`
                : ''}
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
            {primarySelected ? (
              <img
                className={styles.fullscreenImg}
                src={`ckc://image/${encodeURIComponent(primarySelected.id)}?r=${reloadToken}`}
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

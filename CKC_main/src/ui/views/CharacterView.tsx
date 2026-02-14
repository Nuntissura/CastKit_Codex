import React from 'react';
import { LibraryDrawer } from '../components/LibraryDrawer';
import { MediaPane } from '../components/MediaPane';
import { MoodboardCanvas, makeMoodId, type MoodboardState } from '../components/MoodboardCanvas';
import { SheetIngestMergeTools } from '../components/SheetIngestMergeTools';
import { SheetEditor } from '../components/SheetEditor';
import { SheetVersionTools } from '../components/SheetVersionTools';
import { useElementWidth } from '../hooks/useElementWidth';
import styles from './characterView.module.css';

function tagsTextToArray(text: string): string[] {
  const parts = String(text || '')
    .split(/[,\n\r\t]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function tagsArrayToText(tags: string[]): string {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function emptyMoodboard(): MoodboardState {
  return { version: 1, strokes: [], images: [] };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function clampFrac2WithMin(
  frac: number,
  containerWidthPx: number,
  splitterPx: number,
  minLeftPx: number,
  minRightPx: number
): number {
  const raw = clamp01(frac);
  const w = Number(containerWidthPx) || 0;
  if (w <= 0) return raw;
  const available = w - splitterPx;
  if (available <= 0) return raw;
  const min = minLeftPx / available;
  const max = 1 - minRightPx / available;
  if (min > max) return 0.5;
  return Math.max(min, Math.min(max, raw));
}

function clampFracs3WithMin(
  leftFrac: number,
  middleFrac: number,
  containerWidthPx: number,
  splitterPx: number,
  minLeftPx: number,
  minMiddlePx: number,
  minRightPx: number
): { leftFrac: number; middleFrac: number } {
  let left = clamp01(leftFrac);
  let middle = clamp01(middleFrac);

  const w = Number(containerWidthPx) || 0;
  if (w <= 0) {
    const sum = left + middle;
    if (sum > 0.95) {
      const scale = 0.95 / sum;
      left *= scale;
      middle *= scale;
    }
    return { leftFrac: left, middleFrac: middle };
  }

  const available = w - splitterPx * 2;
  if (available <= 0) return { leftFrac: left, middleFrac: middle };

  const minLeft = minLeftPx / available;
  const minMiddle = minMiddlePx / available;
  const minRight = minRightPx / available;
  const maxSum = 1 - minRight;

  if (minLeft + minMiddle > maxSum) {
    return { leftFrac: clamp01(minLeft), middleFrac: clamp01(minMiddle) };
  }

  left = Math.max(minLeft, left);
  middle = Math.max(minMiddle, middle);

  if (left + middle > maxSum) {
    middle = Math.max(minMiddle, maxSum - left);
    if (left + middle > maxSum) {
      left = Math.max(minLeft, maxSum - middle);
    }
  }

  return { leftFrac: clamp01(left), middleFrac: clamp01(middle) };
}

function fileNameFromRelativePath(rel: string): string {
  const raw = String(rel || '');
  const parts = raw.split(/[\\/]/);
  return parts[parts.length - 1] || raw;
}

function joinPath(a: string, b: string): string {
  const left = String(a || '').replace(/[\\/]+$/, '');
  if (!left) return String(b || '');
  return `${left}\\${String(b || '').replace(/^[\\/]+/, '')}`;
}

function dirName(p: string): string {
  const s = String(p || '');
  const idx = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
  return idx >= 0 ? s.slice(0, idx) : s;
}

function shortCharacterId(id: string): string {
  const raw = String(id || '').trim();
  if (!raw) return '';
  if (raw.length <= 18) return raw;

  const prefix = raw.startsWith('char_') ? 'char_' : '';
  const body = prefix ? raw.slice(prefix.length) : raw;
  const start = body.slice(0, 8);
  const end = body.slice(-4);
  return `${prefix}${start}...${end}`;
}

export function CharacterView({
  characterId,
  onBack,
  onOpenLibraryDrawer,
  isLibraryDrawerOpen,
  onCloseLibraryDrawer,
}: {
  characterId: string | null;
  onBack: () => void;
  onOpenLibraryDrawer: () => void;
  isLibraryDrawerOpen: boolean;
  onCloseLibraryDrawer: () => void;
}) {
  const [character, setCharacter] = React.useState<CKCCharacter | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [rightTab, setRightTab] = React.useState<'sheet' | 'photos' | 'tools'>('sheet');
  const [isDocsOpen, setIsDocsOpen] = React.useState<boolean>(false);
  const [mediaMode, setMediaMode] = React.useState<'carousel' | 'photos'>('carousel');

  const splitterPx = 10;
  const minLeftPx2 = 360;
  const minRightPx2 = 460;
  const minLeftPx3 = 320;
  const minMiddlePx3 = 360;
  const minRightPx3 = 460;

  const [layoutRef, layoutWidth] = useElementWidth<HTMLDivElement>();
  const [characterLeftFrac2, setCharacterLeftFrac2] = React.useState<number>(0.55);
  const characterLeftFrac2Ref = React.useRef<number>(characterLeftFrac2);

  const [characterLeftFrac3, setCharacterLeftFrac3] = React.useState<number>(1 / 3);
  const [characterMiddleFrac3, setCharacterMiddleFrac3] = React.useState<number>(1 / 3);
  const characterLeftFrac3Ref = React.useRef<number>(characterLeftFrac3);
  const characterMiddleFrac3Ref = React.useRef<number>(characterMiddleFrac3);

  const characterResizeRef = React.useRef<
    | { kind: '2'; startX: number; startLeftPx: number }
    | { kind: '3-left'; startX: number; startLeftPx: number; sumLMPx: number }
    | { kind: '3-middle'; startX: number; startMiddlePx: number; leftPx: number }
    | null
  >(null);

  const [templateAst, setTemplateAst] = React.useState<CKCTemplateAst | null>(null);
  const [draftValuesById, setDraftValuesById] = React.useState<Record<string, string>>({});
  const [saveIssues, setSaveIssues] = React.useState<Array<{ fieldId: string; severity: string; message: string }> | null>(null);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  const [iconDraftImageId, setIconDraftImageId] = React.useState<string | null>(null);
  const [iconDraftFocusX, setIconDraftFocusX] = React.useState<number>(0.5);
  const [iconDraftFocusY, setIconDraftFocusY] = React.useState<number>(0.5);
  const [iconError, setIconError] = React.useState<string | null>(null);
  const [isIconSaving, setIsIconSaving] = React.useState<boolean>(false);

  const [manualTagDraftText, setManualTagDraftText] = React.useState<string>('');
  const [isTagSaving, setIsTagSaving] = React.useState<boolean>(false);
  const [allTags, setAllTags] = React.useState<string[]>([]);
  const tagsDatalistId = React.useId();
  const docsTagsDatalistId = React.useId();

  const [docsLowerType, setDocsLowerType] = React.useState<'stories' | 'moodboard'>('stories');

  const [docsDrawerScope, setDocsDrawerScope] = React.useState<CKCDocType | 'all'>('notes');
  const [docsDrawerQueryText, setDocsDrawerQueryText] = React.useState<string>('');
  const [docsDrawerTagDraftText, setDocsDrawerTagDraftText] = React.useState<string>('');
  const [docsDrawerTagFilters, setDocsDrawerTagFilters] = React.useState<string[]>([]);
  const [docsDrawerDocs, setDocsDrawerDocs] = React.useState<CKCDocListItem[] | null>(null);
  const [docsDrawerError, setDocsDrawerError] = React.useState<string | null>(null);

  const [notesDocId, setNotesDocId] = React.useState<string | null>(null);
  const [notesLoadedDoc, setNotesLoadedDoc] = React.useState<CKCDocDetail | null>(null);
  const [notesDraftTitle, setNotesDraftTitle] = React.useState<string>('');
  const [notesDraftContent, setNotesDraftContent] = React.useState<string>('');
  const [notesDraftTagsText, setNotesDraftTagsText] = React.useState<string>('');
  const [notesError, setNotesError] = React.useState<string | null>(null);
  const [isNotesSaving, setIsNotesSaving] = React.useState<boolean>(false);

  const [storiesDocId, setStoriesDocId] = React.useState<string | null>(null);
  const [storiesLoadedDoc, setStoriesLoadedDoc] = React.useState<CKCDocDetail | null>(null);
  const [storiesDraftTitle, setStoriesDraftTitle] = React.useState<string>('');
  const [storiesDraftContent, setStoriesDraftContent] = React.useState<string>('');
  const [storiesDraftTagsText, setStoriesDraftTagsText] = React.useState<string>('');
  const [storiesError, setStoriesError] = React.useState<string | null>(null);
  const [isStoriesSaving, setIsStoriesSaving] = React.useState<boolean>(false);

  const [moodboardDocId, setMoodboardDocId] = React.useState<string | null>(null);
  const [moodboardLoadedDoc, setMoodboardLoadedDoc] = React.useState<CKCDocDetail | null>(null);
  const [moodboardDraftTitle, setMoodboardDraftTitle] = React.useState<string>('');
  const [moodboardDraftTagsText, setMoodboardDraftTagsText] = React.useState<string>('');
  const [moodboardDraft, setMoodboardDraft] = React.useState<MoodboardState>(() => emptyMoodboard());
  const [moodboardError, setMoodboardError] = React.useState<string | null>(null);
  const [isMoodboardSaving, setIsMoodboardSaving] = React.useState<boolean>(false);

  const [isImagePickerOpen, setIsImagePickerOpen] = React.useState<boolean>(false);
  const [imagePickerSource, setImagePickerSource] = React.useState<'character' | 'global'>('character');
  const [globalPickerImages, setGlobalPickerImages] = React.useState<CKCGlobalImage[]>([]);

  const [libraryRoot, setLibraryRoot] = React.useState<string | null>(null);
  const [defaultLibraryRootInfo, setDefaultLibraryRootInfo] = React.useState<{
    isPortable: boolean;
    portableDir: string | null;
    defaultLibraryRoot: string;
  } | null>(null);
  const [exportDir, setExportDir] = React.useState<string | null>(null);
  const [spinOffs, setSpinOffs] = React.useState<CKCSpinOffListItem[] | null>(null);
  const [selectedSpinOffId, setSelectedSpinOffId] = React.useState<string | null>(null);
  const [packIncludeValues, setPackIncludeValues] = React.useState<boolean>(true);
  const [packEmptyOnly, setPackEmptyOnly] = React.useState<boolean>(false);
  const [packSections, setPackSections] = React.useState<string[] | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [lastExportPath, setLastExportPath] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);

  const [isImportingImages, setIsImportingImages] = React.useState<boolean>(false);
  const [isHeaderDropActive, setIsHeaderDropActive] = React.useState<boolean>(false);
  const [isCharacterIdCopied, setIsCharacterIdCopied] = React.useState<boolean>(false);
  const characterIdCopyTimerRef = React.useRef<number | null>(null);

  const [llmBaseUrl, setLlmBaseUrl] = React.useState<string>('http://127.0.0.1:11434/v1');
  const [llmModel, setLlmModel] = React.useState<string>('');
  const [llmApiKey, setLlmApiKey] = React.useState<string>('');
  const [llmSystemPrompt, setLlmSystemPrompt] = React.useState<string>('');
  const [llmTimeoutSec, setLlmTimeoutSec] = React.useState<number>(900);
  const [llmPrompt, setLlmPrompt] = React.useState<string>('');
  const [llmResponse, setLlmResponse] = React.useState<string>('');
  const [llmError, setLlmError] = React.useState<string | null>(null);
  const [isLlmBusy, setIsLlmBusy] = React.useState<boolean>(false);

  const defaultExportsDir = React.useMemo(() => {
    return libraryRoot ? joinPath(libraryRoot, 'exports') : null;
  }, [libraryRoot]);

  React.useEffect(() => {
    return () => {
      if (characterIdCopyTimerRef.current) window.clearTimeout(characterIdCopyTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    characterLeftFrac2Ref.current = characterLeftFrac2;
  }, [characterLeftFrac2]);

  React.useEffect(() => {
    characterLeftFrac3Ref.current = characterLeftFrac3;
  }, [characterLeftFrac3]);

  React.useEffect(() => {
    characterMiddleFrac3Ref.current = characterMiddleFrac3;
  }, [characterMiddleFrac3]);

  React.useEffect(() => {
    if (!characterId) return;
    setCharacter(null);
    setError(null);
    setTemplateAst(null);
    setDraftValuesById({});
    setSaveIssues(null);
    setIconDraftImageId(null);
    setIconDraftFocusX(0.5);
    setIconDraftFocusY(0.5);
    setIconError(null);

    window.ckc
      .getCharacter(characterId)
      .then((c) => setCharacter(c))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [characterId]);

  React.useEffect(() => {
    if (!character) return;
    setDraftValuesById(character.valuesById || {});
    void window.ckc.getTemplateDetail(character.templateId).then((detail) => setTemplateAst(detail?.ast ?? null));
  }, [character?.id, character?.templateId]);

  React.useEffect(() => {
    setPackSections(null);
  }, [characterId, templateAst]);

  React.useEffect(() => {
    window.ckc.getDefaultLibraryRootInfo().then(setDefaultLibraryRootInfo).catch(() => setDefaultLibraryRootInfo(null));
    window.ckc
      .getConfig()
      .then((cfg: any) => {
        if (typeof cfg?.libraryRoot === 'string') setLibraryRoot(cfg.libraryRoot);
        const l2 = (cfg?.layoutCharacter2 && typeof cfg.layoutCharacter2 === 'object' ? cfg.layoutCharacter2 : null) as any;
        if (typeof l2?.leftFrac === 'number') setCharacterLeftFrac2(clamp01(l2.leftFrac));

        const l3 = (cfg?.layoutCharacter3 && typeof cfg.layoutCharacter3 === 'object' ? cfg.layoutCharacter3 : null) as any;
        if (typeof l3?.leftFrac === 'number') setCharacterLeftFrac3(clamp01(l3.leftFrac));
        if (typeof l3?.middleFrac === 'number') setCharacterMiddleFrac3(clamp01(l3.middleFrac));

        const docsUi = (cfg?.docsUi && typeof cfg.docsUi === 'object' ? cfg.docsUi : null) as any;
        const lowerType = docsUi?.lowerType;
        if (lowerType === 'stories' || lowerType === 'moodboard') setDocsLowerType(lowerType);

        const selected = (docsUi?.selected && typeof docsUi.selected === 'object' ? docsUi.selected : null) as any;
        if (typeof selected?.notes === 'string') setNotesDocId(selected.notes);
        if (typeof selected?.stories === 'string') setStoriesDocId(selected.stories);
        if (typeof selected?.moodboard === 'string') setMoodboardDocId(selected.moodboard);

        const llm = (cfg?.llm && typeof cfg.llm === 'object' ? cfg.llm : null) as any;
        if (typeof llm?.baseUrl === 'string') setLlmBaseUrl(llm.baseUrl);
        if (typeof llm?.model === 'string') setLlmModel(llm.model);
        if (typeof llm?.apiKey === 'string') setLlmApiKey(llm.apiKey);
        if (typeof llm?.systemPrompt === 'string') setLlmSystemPrompt(llm.systemPrompt);
        if (typeof llm?.timeoutSec === 'number' && Number.isFinite(llm.timeoutSec)) setLlmTimeoutSec(llm.timeoutSec);
      })
      .catch(() => {});
  }, []);

  const effectiveCharacterLeftFrac2 = React.useMemo(() => {
    return clampFrac2WithMin(characterLeftFrac2, layoutWidth, splitterPx, minLeftPx2, minRightPx2);
  }, [characterLeftFrac2, layoutWidth, splitterPx, minLeftPx2, minRightPx2]);

  const effectiveCharacter3 = React.useMemo(() => {
    return clampFracs3WithMin(
      characterLeftFrac3,
      characterMiddleFrac3,
      layoutWidth,
      splitterPx,
      minLeftPx3,
      minMiddlePx3,
      minRightPx3
    );
  }, [characterLeftFrac3, characterMiddleFrac3, layoutWidth, splitterPx, minLeftPx3, minMiddlePx3, minRightPx3]);

  const characterGridDefault = React.useMemo(() => {
    const frac = effectiveCharacterLeftFrac2;
    const pct = (frac * 100).toFixed(4);
    const px = (frac * splitterPx).toFixed(2);
    return `calc(${pct}% - ${px}px) ${splitterPx}px 1fr`;
  }, [effectiveCharacterLeftFrac2, splitterPx]);

  const characterGridDocs = React.useMemo(() => {
    const left = effectiveCharacter3.leftFrac;
    const middle = effectiveCharacter3.middleFrac;
    const splittersTotalPx = splitterPx * 2;
    const leftPct = (left * 100).toFixed(4);
    const middlePct = (middle * 100).toFixed(4);
    const leftPx = (left * splittersTotalPx).toFixed(2);
    const middlePx = (middle * splittersTotalPx).toFixed(2);
    return `calc(${leftPct}% - ${leftPx}px) ${splitterPx}px calc(${middlePct}% - ${middlePx}px) ${splitterPx}px 1fr`;
  }, [effectiveCharacter3.leftFrac, effectiveCharacter3.middleFrac, splitterPx]);

  const beginResizeCharacter2 = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const w = Number(layoutWidth) || 0;
      const available = w - splitterPx;
      if (available <= 0) return;

      characterResizeRef.current = {
        kind: '2',
        startX: e.clientX,
        startLeftPx: effectiveCharacterLeftFrac2 * available,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    },
    [layoutWidth, splitterPx, effectiveCharacterLeftFrac2]
  );

  const beginResizeCharacter3Left = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const w = Number(layoutWidth) || 0;
      const available = w - splitterPx * 2;
      if (available <= 0) return;

      const leftPx = effectiveCharacter3.leftFrac * available;
      const sumLMPx = (effectiveCharacter3.leftFrac + effectiveCharacter3.middleFrac) * available;

      characterResizeRef.current = {
        kind: '3-left',
        startX: e.clientX,
        startLeftPx: leftPx,
        sumLMPx,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    },
    [layoutWidth, splitterPx, effectiveCharacter3.leftFrac, effectiveCharacter3.middleFrac]
  );

  const beginResizeCharacter3Middle = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const w = Number(layoutWidth) || 0;
      const available = w - splitterPx * 2;
      if (available <= 0) return;

      const leftPx = effectiveCharacter3.leftFrac * available;
      const middlePx = effectiveCharacter3.middleFrac * available;

      characterResizeRef.current = {
        kind: '3-middle',
        startX: e.clientX,
        startMiddlePx: middlePx,
        leftPx,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    },
    [layoutWidth, splitterPx, effectiveCharacter3.leftFrac, effectiveCharacter3.middleFrac]
  );

  const onResizeCharacterMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = characterResizeRef.current;
      if (!st) return;

      if (st.kind === '2') {
        const w = Number(layoutWidth) || 0;
        const available = w - splitterPx;
        if (available <= 0) return;

        const dx = e.clientX - st.startX;
        let nextLeftPx = st.startLeftPx + dx;

        const maxLeftPx = available - minRightPx2;
        if (maxLeftPx < minLeftPx2) {
          nextLeftPx = available / 2;
        } else {
          nextLeftPx = Math.max(minLeftPx2, Math.min(maxLeftPx, nextLeftPx));
        }

        const nextFrac = clamp01(nextLeftPx / available);
        characterLeftFrac2Ref.current = nextFrac;
        setCharacterLeftFrac2(nextFrac);
        return;
      }

      if (st.kind === '3-left') {
        const w = Number(layoutWidth) || 0;
        const available = w - splitterPx * 2;
        if (available <= 0) return;

        const dx = e.clientX - st.startX;
        let nextLeftPx = st.startLeftPx + dx;

        const maxLeftPx = st.sumLMPx - minMiddlePx3;
        if (maxLeftPx < minLeftPx3) {
          nextLeftPx = st.sumLMPx / 2;
        } else {
          nextLeftPx = Math.max(minLeftPx3, Math.min(maxLeftPx, nextLeftPx));
        }

        const nextMiddlePx = Math.max(0, st.sumLMPx - nextLeftPx);
        const nextLeftFrac = clamp01(nextLeftPx / available);
        const nextMiddleFrac = clamp01(nextMiddlePx / available);

        characterLeftFrac3Ref.current = nextLeftFrac;
        characterMiddleFrac3Ref.current = nextMiddleFrac;
        setCharacterLeftFrac3(nextLeftFrac);
        setCharacterMiddleFrac3(nextMiddleFrac);
        return;
      }

      if (st.kind === '3-middle') {
        const w = Number(layoutWidth) || 0;
        const available = w - splitterPx * 2;
        if (available <= 0) return;

        const dx = e.clientX - st.startX;
        let nextMiddlePx = st.startMiddlePx + dx;

        const maxMiddlePx = available - st.leftPx - minRightPx3;
        if (maxMiddlePx < minMiddlePx3) {
          nextMiddlePx = Math.max(minMiddlePx3, available - st.leftPx);
        } else {
          nextMiddlePx = Math.max(minMiddlePx3, Math.min(maxMiddlePx, nextMiddlePx));
        }

        const nextMiddleFrac = clamp01(nextMiddlePx / available);
        characterMiddleFrac3Ref.current = nextMiddleFrac;
        setCharacterMiddleFrac3(nextMiddleFrac);
      }
    },
    [layoutWidth, splitterPx, minLeftPx2, minRightPx2, minLeftPx3, minMiddlePx3, minRightPx3]
  );

  const endResizeCharacter = React.useCallback(() => {
    const st = characterResizeRef.current;
    if (!st) return;
    characterResizeRef.current = null;

    if (st.kind === '2') {
      const next = clampFrac2WithMin(characterLeftFrac2Ref.current, layoutWidth, splitterPx, minLeftPx2, minRightPx2);
      setCharacterLeftFrac2(next);
      characterLeftFrac2Ref.current = next;
      void window.ckc.setConfig({ layoutCharacter2: { leftFrac: next } });
      return;
    }

    const next3 = clampFracs3WithMin(
      characterLeftFrac3Ref.current,
      characterMiddleFrac3Ref.current,
      layoutWidth,
      splitterPx,
      minLeftPx3,
      minMiddlePx3,
      minRightPx3
    );
    setCharacterLeftFrac3(next3.leftFrac);
    setCharacterMiddleFrac3(next3.middleFrac);
    characterLeftFrac3Ref.current = next3.leftFrac;
    characterMiddleFrac3Ref.current = next3.middleFrac;
    void window.ckc.setConfig({ layoutCharacter3: { leftFrac: next3.leftFrac, middleFrac: next3.middleFrac } });
  }, [layoutWidth, splitterPx, minLeftPx2, minRightPx2, minLeftPx3, minMiddlePx3, minRightPx3]);

  React.useEffect(() => {
    window.ckc
      .listSpinOffs({})
      .then((rows) => {
        setSpinOffs(rows);
        const safe = (rows || []).find((r: any) => String(r.name || '').toLowerCase().includes('safe subset'));
        setSelectedSpinOffId((safe?.id ?? rows?.[0]?.id ?? null) as any);
      })
      .catch((err: unknown) => setExportError(err instanceof Error ? err.message : String(err)));
  }, []);

  React.useEffect(() => {
    window.ckc
      .listAllTags()
      .then((rows) => setAllTags(Array.isArray(rows) ? rows.map((t) => String(t)) : []))
      .catch(() => setAllTags([]));
  }, []);

  React.useEffect(() => {
    if (!characterId) return;
    if (!character) return;
    setIconDraftImageId(character.iconImageId ?? null);
    setIconDraftFocusX(clamp01(character.iconFocusX));
    setIconDraftFocusY(clamp01(character.iconFocusY));
    setIconError(null);
  }, [characterId, character?.iconImageId, character?.iconFocusX, character?.iconFocusY]);

  const reloadDocsDrawer = React.useCallback(() => {
    setDocsDrawerError(null);
    setDocsDrawerDocs(null);

    if (docsDrawerScope === 'all') {
      void Promise.all(
        (['notes', 'stories', 'moodboard'] as const).map((t) =>
          window.ckc.listDocs({ docType: t, queryText: docsDrawerQueryText, tagFilters: docsDrawerTagFilters })
        )
      )
        .then((lists) => {
          const merged = ([] as CKCDocListItem[]).concat(...(lists || []));
          merged.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
          setDocsDrawerDocs(merged);
        })
        .catch((err: unknown) => {
          setDocsDrawerError(err instanceof Error ? err.message : String(err));
          setDocsDrawerDocs([]);
        });
      return;
    }

    void window.ckc
      .listDocs({ docType: docsDrawerScope, queryText: docsDrawerQueryText, tagFilters: docsDrawerTagFilters })
      .then((rows) => setDocsDrawerDocs(rows))
      .catch((err: unknown) => {
        setDocsDrawerError(err instanceof Error ? err.message : String(err));
        setDocsDrawerDocs([]);
      });
  }, [docsDrawerScope, docsDrawerQueryText, docsDrawerTagFilters]);

  React.useEffect(() => {
    if (!isLibraryDrawerOpen) return;
    reloadDocsDrawer();
  }, [isLibraryDrawerOpen, reloadDocsDrawer]);

  React.useEffect(() => {
    if (!notesDocId) {
      setNotesLoadedDoc(null);
      return;
    }
    setNotesError(null);
    window.ckc
      .getDoc({ docType: 'notes', docId: notesDocId })
      .then((doc) => {
        setNotesLoadedDoc(doc);
        setNotesDraftTitle(doc?.title ?? '');
        setNotesDraftContent(doc?.content ?? '');
        setNotesDraftTagsText(tagsArrayToText(doc?.tags ?? []));
      })
      .catch((err: unknown) => setNotesError(err instanceof Error ? err.message : String(err)));
  }, [notesDocId]);

  React.useEffect(() => {
    if (!storiesDocId) {
      setStoriesLoadedDoc(null);
      return;
    }
    setStoriesError(null);
    window.ckc
      .getDoc({ docType: 'stories', docId: storiesDocId })
      .then((doc) => {
        setStoriesLoadedDoc(doc);
        setStoriesDraftTitle(doc?.title ?? '');
        setStoriesDraftContent(doc?.content ?? '');
        setStoriesDraftTagsText(tagsArrayToText(doc?.tags ?? []));
      })
      .catch((err: unknown) => setStoriesError(err instanceof Error ? err.message : String(err)));
  }, [storiesDocId]);

  React.useEffect(() => {
    if (!moodboardDocId) {
      setMoodboardLoadedDoc(null);
      return;
    }
    setMoodboardError(null);
    window.ckc
      .getDoc({ docType: 'moodboard', docId: moodboardDocId })
      .then((doc) => {
        setMoodboardLoadedDoc(doc);
        setMoodboardDraftTitle(doc?.title ?? '');
        setMoodboardDraftTagsText(tagsArrayToText(doc?.tags ?? []));
        try {
          const parsed = JSON.parse(doc?.content ?? '{}');
          if (
            parsed &&
            typeof parsed === 'object' &&
            parsed.version === 1 &&
            Array.isArray(parsed.strokes) &&
            Array.isArray(parsed.images)
          ) {
            setMoodboardDraft(parsed);
          } else {
            setMoodboardDraft(emptyMoodboard());
          }
        } catch {
          setMoodboardDraft(emptyMoodboard());
        }
      })
      .catch((err: unknown) => setMoodboardError(err instanceof Error ? err.message : String(err)));
  }, [moodboardDocId]);

  React.useEffect(() => {
    if (!isImagePickerOpen) return;
    if (imagePickerSource !== 'global') return;
    window.ckc
      .listGlobalCarouselImages({ preferFrontpage: true })
      .then((rows) => setGlobalPickerImages(rows || []))
      .catch(() => setGlobalPickerImages([]));
  }, [isImagePickerOpen, imagePickerSource]);

  const images = React.useMemo(() => {
    const all = character?.images ?? [];
    if (mediaMode === 'photos') return all;
    const carousel = all.filter((i) => (i.tags || []).includes('carousel'));
    return carousel.length > 0 ? carousel : all;
  }, [character, mediaMode]);

  const docsDrawerSmartTags = React.useMemo(() => {
    if (!docsDrawerDocs) return [];
    const seen = new Set<string>();
    for (const d of docsDrawerDocs) {
      for (const t of d.tags || []) seen.add(String(t));
    }
    return Array.from(seen)
      .map((t) => t.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [docsDrawerDocs]);

  const addDocsDrawerTagFiltersFromText = (text: string) => {
    const toAdd = tagsTextToArray(text);
    if (toAdd.length === 0) return;
    setDocsDrawerTagFilters((prev) => Array.from(new Set([...(prev || []), ...toAdd])));
    setDocsDrawerTagDraftText('');
  };

  const isDirty = React.useMemo(() => {
    if (!character) return false;
    const a = character.valuesById || {};
    const b = draftValuesById || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (String(a[k] ?? '') !== String(b[k] ?? '')) return true;
    }
    return false;
  }, [character, draftValuesById]);

  const iconIsDirty = React.useMemo(() => {
    if (!character) return false;
    const aId = character.iconImageId ?? null;
    const bId = iconDraftImageId ?? null;
    if (aId !== bId) return true;
    if (Math.abs(clamp01(character.iconFocusX) - clamp01(iconDraftFocusX)) > 1e-6) return true;
    if (Math.abs(clamp01(character.iconFocusY) - clamp01(iconDraftFocusY)) > 1e-6) return true;
    return false;
  }, [character, iconDraftImageId, iconDraftFocusX, iconDraftFocusY]);

  const saveIcon = async () => {
    if (!characterId) return;
    setIsIconSaving(true);
    setIconError(null);
    try {
      await window.ckc.setCharacterIcon({
        characterId,
        imageId: iconDraftImageId,
        focusX: clamp01(iconDraftFocusX),
        focusY: clamp01(iconDraftFocusY),
      });

      setCharacter((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          iconImageId: iconDraftImageId ?? null,
          iconFocusX: clamp01(iconDraftFocusX),
          iconFocusY: clamp01(iconDraftFocusY),
        };
      });
    } catch (err: unknown) {
      setIconError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsIconSaving(false);
    }
  };

  const saveSheet = async () => {
    if (!characterId) return;
    setIsSaving(true);
    setSaveIssues(null);
    setError(null);
    try {
      const res: any = await window.ckc.saveCharacter({ characterId, valuesById: draftValuesById });
      if (!res?.ok) {
        setSaveIssues(Array.isArray(res?.issues) ? res.issues : []);
        return;
      }
      const refreshed = await window.ckc.getCharacter(characterId);
      if (refreshed) {
        setCharacter(refreshed);
        setDraftValuesById(refreshed.valuesById || {});
      }
      setSaveIssues(Array.isArray(res?.issues) ? res.issues : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const reloadCharacter = React.useCallback(async () => {
    if (!characterId) return;
    const refreshed = await window.ckc.getCharacter(characterId);
    if (refreshed) setCharacter(refreshed);
  }, [characterId]);

  const addManualTags = React.useCallback(async () => {
    if (!characterId) return;
    const parts = tagsTextToArray(manualTagDraftText);
    if (parts.length === 0) return;
    setIsTagSaving(true);
    setError(null);
    try {
      for (const raw of parts) {
        const trimmed = String(raw).trim();
        if (!trimmed) continue;
        const canonical = allTags.find((t) => String(t).toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
        await window.ckc.addManualTag({ characterId, tagText: String(canonical) });
      }
      setManualTagDraftText('');
      await reloadCharacter();
      window.ckc
        .listAllTags()
        .then((rows) => setAllTags(Array.isArray(rows) ? rows.map((t) => String(t)) : []))
        .catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTagSaving(false);
    }
  }, [characterId, manualTagDraftText, allTags, reloadCharacter]);

  const removeManualTag = React.useCallback(
    async (tagText: string) => {
      if (!characterId) return;
      setIsTagSaving(true);
      setError(null);
      try {
        await window.ckc.removeManualTag({ characterId, tagText });
        await reloadCharacter();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsTagSaving(false);
      }
    },
    [characterId, reloadCharacter]
  );

  const notesDocIdRef = React.useRef<string | null>(notesDocId);
  const storiesDocIdRef = React.useRef<string | null>(storiesDocId);
  const moodboardDocIdRef = React.useRef<string | null>(moodboardDocId);

  React.useEffect(() => {
    notesDocIdRef.current = notesDocId;
  }, [notesDocId]);

  React.useEffect(() => {
    storiesDocIdRef.current = storiesDocId;
  }, [storiesDocId]);

  React.useEffect(() => {
    moodboardDocIdRef.current = moodboardDocId;
  }, [moodboardDocId]);

  const notesTags = React.useMemo(() => tagsTextToArray(notesDraftTagsText), [notesDraftTagsText]);
  const storiesTags = React.useMemo(() => tagsTextToArray(storiesDraftTagsText), [storiesDraftTagsText]);
  const moodboardTags = React.useMemo(() => tagsTextToArray(moodboardDraftTagsText), [moodboardDraftTagsText]);

  const notesIsDirty = React.useMemo(() => {
    const loadedTags = notesLoadedDoc?.tags ?? [];
    const sameTags =
      loadedTags.length === notesTags.length &&
      loadedTags.every((t) => notesTags.includes(t)) &&
      notesTags.every((t) => loadedTags.includes(t));

    return (
      String(notesDraftTitle ?? '') !== String(notesLoadedDoc?.title ?? '') ||
      String(notesDraftContent ?? '') !== String(notesLoadedDoc?.content ?? '') ||
      !sameTags
    );
  }, [notesLoadedDoc, notesDraftTitle, notesDraftContent, notesTags]);

  const storiesIsDirty = React.useMemo(() => {
    const loadedTags = storiesLoadedDoc?.tags ?? [];
    const sameTags =
      loadedTags.length === storiesTags.length &&
      loadedTags.every((t) => storiesTags.includes(t)) &&
      storiesTags.every((t) => loadedTags.includes(t));

    return (
      String(storiesDraftTitle ?? '') !== String(storiesLoadedDoc?.title ?? '') ||
      String(storiesDraftContent ?? '') !== String(storiesLoadedDoc?.content ?? '') ||
      !sameTags
    );
  }, [storiesLoadedDoc, storiesDraftTitle, storiesDraftContent, storiesTags]);

  const moodboardIsDirty = React.useMemo(() => {
    const loadedTags = moodboardLoadedDoc?.tags ?? [];
    const sameTags =
      loadedTags.length === moodboardTags.length &&
      loadedTags.every((t) => moodboardTags.includes(t)) &&
      moodboardTags.every((t) => loadedTags.includes(t));

    const currentJson = JSON.stringify(moodboardDraft);
    const loadedJson = moodboardLoadedDoc?.content ?? '';

    return (
      String(moodboardDraftTitle ?? '') !== String(moodboardLoadedDoc?.title ?? '') ||
      !sameTags ||
      currentJson !== String(loadedJson ?? '')
    );
  }, [moodboardLoadedDoc, moodboardDraftTitle, moodboardTags, moodboardDraft]);

  const saveNotes = React.useCallback(async () => {
    if (isNotesSaving) return;

    const docIdAtStart = notesDocIdRef.current;
    const title = String(notesDraftTitle || '').trim() || 'Untitled';
    const content = String(notesDraftContent ?? '');
    const tags = notesTags;

    const isMeaningful = !!docIdAtStart || title !== 'Untitled' || content.trim().length > 0 || tags.length > 0;
    if (!isMeaningful) return;

    setIsNotesSaving(true);
    setNotesError(null);
    try {
      const res = await window.ckc.upsertDoc({ docType: 'notes', docId: docIdAtStart, title, content, tags });
      const nextId = res?.docId || docIdAtStart;
      if (!nextId) return;

      if (notesDocIdRef.current !== docIdAtStart) return;
      notesDocIdRef.current = nextId;
      setNotesDocId(nextId);

      if (isLibraryDrawerOpen) reloadDocsDrawer();
      const fresh = await window.ckc.getDoc({ docType: 'notes', docId: nextId });
      if (notesDocIdRef.current === nextId) setNotesLoadedDoc(fresh);
    } catch (err: unknown) {
      setNotesError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsNotesSaving(false);
    }
  }, [isNotesSaving, notesDraftTitle, notesDraftContent, notesTags, isLibraryDrawerOpen, reloadDocsDrawer]);

  const saveStories = React.useCallback(async () => {
    if (isStoriesSaving) return;

    const docIdAtStart = storiesDocIdRef.current;
    const title = String(storiesDraftTitle || '').trim() || 'Untitled';
    const content = String(storiesDraftContent ?? '');
    const tags = storiesTags;

    const isMeaningful = !!docIdAtStart || title !== 'Untitled' || content.trim().length > 0 || tags.length > 0;
    if (!isMeaningful) return;

    setIsStoriesSaving(true);
    setStoriesError(null);
    try {
      const res = await window.ckc.upsertDoc({ docType: 'stories', docId: docIdAtStart, title, content, tags });
      const nextId = res?.docId || docIdAtStart;
      if (!nextId) return;

      if (storiesDocIdRef.current !== docIdAtStart) return;
      storiesDocIdRef.current = nextId;
      setStoriesDocId(nextId);

      if (isLibraryDrawerOpen) reloadDocsDrawer();
      const fresh = await window.ckc.getDoc({ docType: 'stories', docId: nextId });
      if (storiesDocIdRef.current === nextId) setStoriesLoadedDoc(fresh);
    } catch (err: unknown) {
      setStoriesError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStoriesSaving(false);
    }
  }, [isStoriesSaving, storiesDraftTitle, storiesDraftContent, storiesTags, isLibraryDrawerOpen, reloadDocsDrawer]);

  const saveMoodboard = React.useCallback(async () => {
    if (isMoodboardSaving) return;

    const docIdAtStart = moodboardDocIdRef.current;
    const title = String(moodboardDraftTitle || '').trim() || 'Untitled';
    const content = JSON.stringify(moodboardDraft);
    const tags = moodboardTags;

    const isMeaningful = !!docIdAtStart || title !== 'Untitled' || content.trim().length > 0 || tags.length > 0;
    if (!isMeaningful) return;

    setIsMoodboardSaving(true);
    setMoodboardError(null);
    try {
      const res = await window.ckc.upsertDoc({ docType: 'moodboard', docId: docIdAtStart, title, content, tags });
      const nextId = res?.docId || docIdAtStart;
      if (!nextId) return;

      if (moodboardDocIdRef.current !== docIdAtStart) return;
      moodboardDocIdRef.current = nextId;
      setMoodboardDocId(nextId);

      if (isLibraryDrawerOpen) reloadDocsDrawer();
      const fresh = await window.ckc.getDoc({ docType: 'moodboard', docId: nextId });
      if (moodboardDocIdRef.current === nextId) setMoodboardLoadedDoc(fresh);
    } catch (err: unknown) {
      setMoodboardError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsMoodboardSaving(false);
    }
  }, [isMoodboardSaving, moodboardDraftTitle, moodboardDraft, moodboardTags, isLibraryDrawerOpen, reloadDocsDrawer]);

  const newNotesDoc = React.useCallback(async () => {
    setIsNotesSaving(true);
    setNotesError(null);
    try {
      const res = await window.ckc.upsertDoc({ docType: 'notes', title: 'Untitled', content: '', tags: [] });
      if (res?.docId) {
        notesDocIdRef.current = res.docId;
        setNotesDocId(res.docId);
        if (isLibraryDrawerOpen) reloadDocsDrawer();
        onCloseLibraryDrawer();
      }
    } catch (err: unknown) {
      setNotesError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsNotesSaving(false);
    }
  }, [isLibraryDrawerOpen, reloadDocsDrawer, onCloseLibraryDrawer]);

  const newStoriesDoc = React.useCallback(async () => {
    setIsStoriesSaving(true);
    setStoriesError(null);
    try {
      const res = await window.ckc.upsertDoc({ docType: 'stories', title: 'Untitled', content: '', tags: [] });
      if (res?.docId) {
        storiesDocIdRef.current = res.docId;
        setStoriesDocId(res.docId);
        if (isLibraryDrawerOpen) reloadDocsDrawer();
        onCloseLibraryDrawer();
      }
    } catch (err: unknown) {
      setStoriesError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStoriesSaving(false);
    }
  }, [isLibraryDrawerOpen, reloadDocsDrawer, onCloseLibraryDrawer]);

  const newMoodboardDoc = React.useCallback(async () => {
    setIsMoodboardSaving(true);
    setMoodboardError(null);
    try {
      const res = await window.ckc.upsertDoc({
        docType: 'moodboard',
        title: 'Untitled',
        content: JSON.stringify(emptyMoodboard()),
        tags: [],
      });
      if (res?.docId) {
        moodboardDocIdRef.current = res.docId;
        setMoodboardDocId(res.docId);
        if (isLibraryDrawerOpen) reloadDocsDrawer();
        onCloseLibraryDrawer();
      }
    } catch (err: unknown) {
      setMoodboardError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsMoodboardSaving(false);
    }
  }, [isLibraryDrawerOpen, reloadDocsDrawer, onCloseLibraryDrawer]);

  const deleteNotesDoc = React.useCallback(async () => {
    const id = notesDocIdRef.current;
    if (!id) return;
    if (!confirm('Delete this note?')) return;
    setIsNotesSaving(true);
    setNotesError(null);
    try {
      await window.ckc.deleteDoc({ docType: 'notes', docId: id });
      if (notesDocIdRef.current === id) {
        notesDocIdRef.current = null;
        setNotesDocId(null);
        setNotesLoadedDoc(null);
        setNotesDraftTitle('');
        setNotesDraftContent('');
        setNotesDraftTagsText('');
      }
      if (isLibraryDrawerOpen) reloadDocsDrawer();
    } catch (err: unknown) {
      setNotesError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsNotesSaving(false);
    }
  }, [isLibraryDrawerOpen, reloadDocsDrawer]);

  const deleteStoriesDoc = React.useCallback(async () => {
    const id = storiesDocIdRef.current;
    if (!id) return;
    if (!confirm('Delete this story?')) return;
    setIsStoriesSaving(true);
    setStoriesError(null);
    try {
      await window.ckc.deleteDoc({ docType: 'stories', docId: id });
      if (storiesDocIdRef.current === id) {
        storiesDocIdRef.current = null;
        setStoriesDocId(null);
        setStoriesLoadedDoc(null);
        setStoriesDraftTitle('');
        setStoriesDraftContent('');
        setStoriesDraftTagsText('');
      }
      if (isLibraryDrawerOpen) reloadDocsDrawer();
    } catch (err: unknown) {
      setStoriesError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStoriesSaving(false);
    }
  }, [isLibraryDrawerOpen, reloadDocsDrawer]);

  const deleteMoodboardDoc = React.useCallback(async () => {
    const id = moodboardDocIdRef.current;
    if (!id) return;
    if (!confirm('Delete this moodboard?')) return;
    setIsMoodboardSaving(true);
    setMoodboardError(null);
    try {
      await window.ckc.deleteDoc({ docType: 'moodboard', docId: id });
      if (moodboardDocIdRef.current === id) {
        moodboardDocIdRef.current = null;
        setMoodboardDocId(null);
        setMoodboardLoadedDoc(null);
        setMoodboardDraftTitle('');
        setMoodboardDraftTagsText('');
        setMoodboardDraft(emptyMoodboard());
      }
      if (isLibraryDrawerOpen) reloadDocsDrawer();
    } catch (err: unknown) {
      setMoodboardError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsMoodboardSaving(false);
    }
  }, [isLibraryDrawerOpen, reloadDocsDrawer]);

  const notesAutosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const storiesAutosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodboardAutosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushNotesAutosave = React.useCallback(() => {
    if (notesAutosaveTimerRef.current) {
      clearTimeout(notesAutosaveTimerRef.current);
      notesAutosaveTimerRef.current = null;
    }
    if (notesIsDirty) void saveNotes();
  }, [notesIsDirty, saveNotes]);

  const flushStoriesAutosave = React.useCallback(() => {
    if (storiesAutosaveTimerRef.current) {
      clearTimeout(storiesAutosaveTimerRef.current);
      storiesAutosaveTimerRef.current = null;
    }
    if (storiesIsDirty) void saveStories();
  }, [storiesIsDirty, saveStories]);

  const flushMoodboardAutosave = React.useCallback(() => {
    if (moodboardAutosaveTimerRef.current) {
      clearTimeout(moodboardAutosaveTimerRef.current);
      moodboardAutosaveTimerRef.current = null;
    }
    if (moodboardIsDirty) void saveMoodboard();
  }, [moodboardIsDirty, saveMoodboard]);

  React.useEffect(() => {
    if (!isDocsOpen) return;
    if (!notesIsDirty) return;
    if (notesAutosaveTimerRef.current) clearTimeout(notesAutosaveTimerRef.current);
    notesAutosaveTimerRef.current = setTimeout(() => void saveNotes(), 800);
    return () => {
      if (notesAutosaveTimerRef.current) {
        clearTimeout(notesAutosaveTimerRef.current);
        notesAutosaveTimerRef.current = null;
      }
    };
  }, [isDocsOpen, notesIsDirty, notesDraftTitle, notesDraftContent, notesDraftTagsText, saveNotes]);

  React.useEffect(() => {
    if (!isDocsOpen) return;
    if (!storiesIsDirty) return;
    if (storiesAutosaveTimerRef.current) clearTimeout(storiesAutosaveTimerRef.current);
    storiesAutosaveTimerRef.current = setTimeout(() => void saveStories(), 900);
    return () => {
      if (storiesAutosaveTimerRef.current) {
        clearTimeout(storiesAutosaveTimerRef.current);
        storiesAutosaveTimerRef.current = null;
      }
    };
  }, [isDocsOpen, storiesIsDirty, storiesDraftTitle, storiesDraftContent, storiesDraftTagsText, saveStories]);

  React.useEffect(() => {
    if (!isDocsOpen) return;
    if (!moodboardIsDirty) return;
    if (moodboardAutosaveTimerRef.current) clearTimeout(moodboardAutosaveTimerRef.current);
    moodboardAutosaveTimerRef.current = setTimeout(() => void saveMoodboard(), 1200);
    return () => {
      if (moodboardAutosaveTimerRef.current) {
        clearTimeout(moodboardAutosaveTimerRef.current);
        moodboardAutosaveTimerRef.current = null;
      }
    };
  }, [isDocsOpen, moodboardIsDirty, moodboardDraftTitle, moodboardDraftTagsText, moodboardDraft, saveMoodboard]);

  React.useEffect(() => {
    if (isDocsOpen) return;
    flushNotesAutosave();
    flushStoriesAutosave();
    flushMoodboardAutosave();
  }, [isDocsOpen, flushNotesAutosave, flushStoriesAutosave, flushMoodboardAutosave]);

  React.useEffect(() => {
    void window.ckc.setConfig({
      docsUi: {
        lowerType: docsLowerType,
        selected: { notes: notesDocId, stories: storiesDocId, moodboard: moodboardDocId },
      },
    });
  }, [docsLowerType, notesDocId, storiesDocId, moodboardDocId]);

  const importImagesForCharacter = async () => {
    if (!characterId) return;
    setIsImportingImages(true);
    setError(null);
    try {
      await window.ckc.importImages({ characterId });
      const c = await window.ckc.getCharacter(characterId);
      setCharacter(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImportingImages(false);
    }
  };

  const importImagesForCharacterFromPaths = async (filePaths: string[]) => {
    if (!characterId) return;
    const paths = Array.isArray(filePaths) ? filePaths.map((p) => String(p || '')).filter(Boolean) : [];
    if (paths.length === 0) return;
    setIsImportingImages(true);
    setError(null);
    try {
      await window.ckc.importImages({ characterId, filePaths: paths });
      const c = await window.ckc.getCharacter(characterId);
      setCharacter(c);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImportingImages(false);
    }
  };

  const copyCurrentCharacterId = React.useCallback(() => {
    if (!characterId) return;
    try {
      window.ckc.copyText(characterId);
      setIsCharacterIdCopied(true);
      if (characterIdCopyTimerRef.current) window.clearTimeout(characterIdCopyTimerRef.current);
      characterIdCopyTimerRef.current = window.setTimeout(() => setIsCharacterIdCopied(false), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [characterId]);

  const chooseCharacterExportDir = async () => {
    setExportError(null);
    try {
      const dir = await window.ckc.selectFolderDialog({ title: 'Select export folder' });
      if (!dir) return;
      setExportDir(dir);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    }
  };

  const exportCharacterBundle = async () => {
    if (!characterId) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const outDir = exportDir || defaultExportsDir;
      const res = await window.ckc.exportBundle({ characterId, outDir });
      setLastExportPath(res.txtPath);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const exportCharacterFieldPack = async () => {
    if (!characterId) return;
    if (!selectedSpinOffId) return;
    setExportError(null);
    setIsExporting(true);
    try {
      const outDir = exportDir || defaultExportsDir;
      const res = await window.ckc.exportFieldPack({
        characterId,
        spinoffId: selectedSpinOffId,
        includeEmptyOnly: packEmptyOnly,
        includeValues: packIncludeValues,
        includeSections: packSections,
        outDir,
      });
      setLastExportPath(res.path);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const addMoodboardImage = (imageId: string) => {
    setMoodboardDraft((prev) => ({
      ...prev,
      images: [
        ...(prev.images || []),
        {
          id: makeMoodId('mbi_'),
          imageId,
          x: 0.5,
          y: 0.5,
          w: 0.55,
          h: 0.55,
        },
      ],
    }));
  };

  const persistLlmConfig = React.useCallback(async () => {
    const timeoutSec = Number.isFinite(llmTimeoutSec) ? llmTimeoutSec : 900;
    const clampedTimeoutSec = Math.max(5, Math.min(7200, timeoutSec));
    await window.ckc.setConfig({
      llm: {
        baseUrl: String(llmBaseUrl || '').trim(),
        model: String(llmModel || '').trim(),
        apiKey: String(llmApiKey || '').trim(),
        systemPrompt: String(llmSystemPrompt || ''),
        timeoutSec: clampedTimeoutSec,
      },
    });
  }, [llmApiKey, llmBaseUrl, llmModel, llmSystemPrompt, llmTimeoutSec]);

  const runLlm = React.useCallback(async () => {
    const prompt = String(llmPrompt || '').trim();
    if (!prompt) return;
    setIsLlmBusy(true);
    setLlmError(null);
    setLlmResponse('');
    try {
      await persistLlmConfig();
      const res: any = await window.ckc.llmChat({ messages: [{ role: 'user', content: prompt }] });
      setLlmResponse(typeof res?.text === 'string' ? res.text : JSON.stringify(res, null, 2));
    } catch (err: unknown) {
      setLlmError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLlmBusy(false);
    }
  }, [llmPrompt, persistLlmConfig]);

  return (
    <>
      <LibraryDrawer isOpen={isLibraryDrawerOpen} onClose={onCloseLibraryDrawer}>
        <div className={styles.docsDrawer}>
          <div className={styles.docsDrawerTop}>
            <div className={styles.docsTypeRow}>
              {(['notes', 'stories', 'moodboard'] as const).map((t) => (
                <button
                  key={t}
                  className={styles.tabBtn}
                  data-active={docsDrawerScope === t ? '1' : '0'}
                  onClick={() => setDocsDrawerScope(t)}
                >
                  {t === 'notes' ? 'Notes' : t === 'stories' ? 'Stories' : 'Moodboard'}
                </button>
              ))}
              <button
                className={styles.tabBtn}
                data-active={docsDrawerScope === 'all' ? '1' : '0'}
                onClick={() => setDocsDrawerScope('all')}
                title="Show all doc types together"
              >
                All
              </button>
            </div>
            <div className={styles.docsDrawerActions}>
              <button
                className={styles.btnSecondary}
                onClick={() =>
                  void (docsDrawerScope === 'stories' ? newStoriesDoc() : docsDrawerScope === 'moodboard' ? newMoodboardDoc() : newNotesDoc())
                }
                disabled={docsDrawerScope === 'stories' ? isStoriesSaving : docsDrawerScope === 'moodboard' ? isMoodboardSaving : isNotesSaving}
              >
                New
              </button>
              <button className={styles.btnSecondary} onClick={onCloseLibraryDrawer}>
                Close
              </button>
            </div>
          </div>

          <label className={styles.docsSearch}>
            Search{' '}
            <input value={docsDrawerQueryText} onChange={(e) => setDocsDrawerQueryText(e.target.value)} placeholder="Title…" />
          </label>

          <label className={styles.docsSearch}>
            Tags
            <div className={styles.docsTagRow}>
              <input
                value={docsDrawerTagDraftText}
                onChange={(e) => setDocsDrawerTagDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDocsDrawerTagFiltersFromText(docsDrawerTagDraftText);
                  }
                }}
                placeholder="tag"
                list={docsTagsDatalistId}
              />
              <button
                className={styles.btnSecondary}
                onClick={() => addDocsDrawerTagFiltersFromText(docsDrawerTagDraftText)}
                disabled={tagsTextToArray(docsDrawerTagDraftText).length === 0}
                title="Add tag filter"
              >
                Add
              </button>
              {docsDrawerTagFilters.length ? (
                <button
                  className={styles.btnSecondary}
                  onClick={() => setDocsDrawerTagFilters([])}
                  title="Clear all tag filters"
                >
                  Clear
                </button>
              ) : null}
              <datalist id={docsTagsDatalistId}>
                {allTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </label>

          {docsDrawerTagFilters.length ? (
            <div className={styles.tagChips}>
              {docsDrawerTagFilters.map((t) => (
                <button
                  key={t}
                  className={styles.tagChip}
                  onClick={() => setDocsDrawerTagFilters((cur) => (cur || []).filter((x) => x !== t))}
                  title="Remove tag filter"
                >
                  x {t}
                </button>
              ))}
            </div>
          ) : null}

          {docsDrawerSmartTags.length ? (
            <details className={styles.smartTagsBox}>
              <summary>Smart tags</summary>
              <div className={styles.smartTags}>
                {docsDrawerSmartTags.slice(0, 200).map((t) => (
                  <button
                    key={t}
                    className={styles.tagChip}
                    onClick={() => addDocsDrawerTagFiltersFromText(t)}
                    title="Add tag filter"
                  >
                    {t}
                  </button>
                ))}
                {docsDrawerSmartTags.length > 200 ? <span className={styles.muted}>...</span> : null}
              </div>
            </details>
          ) : null}

          {docsDrawerError ? <div className={styles.error}>{docsDrawerError}</div> : null}
          {docsDrawerDocs === null ? (
            <div className={styles.muted}>Loading…</div>
          ) : docsDrawerDocs.length === 0 ? (
            <div className={styles.muted}>No documents.</div>
          ) : (
            <div className={styles.docsList}>
              {docsDrawerDocs.map((d) => (
                <button
                  key={d.id}
                  className={styles.docsItem}
                  data-active={
                    d.docType === 'notes'
                      ? d.id === notesDocId
                        ? '1'
                        : '0'
                      : d.docType === 'stories'
                        ? d.id === storiesDocId
                          ? '1'
                          : '0'
                        : d.id === moodboardDocId
                          ? '1'
                          : '0'
                  }
                  onClick={() => {
                    if (d.docType === 'notes') {
                      flushNotesAutosave();
                      notesDocIdRef.current = d.id;
                      setNotesDocId(d.id);
                    } else if (d.docType === 'stories') {
                      flushStoriesAutosave();
                      storiesDocIdRef.current = d.id;
                      setStoriesDocId(d.id);
                      setDocsLowerType('stories');
                    } else {
                      flushMoodboardAutosave();
                      moodboardDocIdRef.current = d.id;
                      setMoodboardDocId(d.id);
                      setDocsLowerType('moodboard');
                    }
                    onCloseLibraryDrawer();
                  }}
                  title={d.tags?.length ? d.tags.join(', ') : undefined}
                >
                  <div className={styles.docsItemTitle}>{d.title}</div>
                  <div className={styles.docsItemMeta}>
                    {docsDrawerScope === 'all' ? `${d.docType} • ` : null}
                    {new Date(d.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </LibraryDrawer>

      <div
        className={styles.layout}
        data-mode={isDocsOpen ? 'docs' : 'default'}
        ref={layoutRef}
        style={{ gridTemplateColumns: isDocsOpen ? characterGridDocs : characterGridDefault }}
      >
        <section className={styles.left}>
          <div className={styles.leftBody}>
              <MediaPane
                headerLeft={
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
                }
                enableViewerSlideshow={mediaMode === 'carousel'}
                autoStartSlideshow={mediaMode === 'carousel'}
                showCarouselToggleOnThumbs={mediaMode === 'photos'}
                autoOpenControlsOnSelect={mediaMode === 'photos'}
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

        <div
          className={styles.splitter}
          role="separator"
          aria-orientation="vertical"
          title="Resize panels"
          onPointerDown={isDocsOpen ? beginResizeCharacter3Left : beginResizeCharacter2}
          onPointerMove={onResizeCharacterMove}
          onPointerUp={endResizeCharacter}
          onPointerCancel={endResizeCharacter}
          onLostPointerCapture={endResizeCharacter}
        />

        {isDocsOpen ? (
          <>
            <section className={styles.middle}>
              <div className={styles.middleHeader}>
                <div className={styles.middleTitle}>Docs</div>
                <div className={styles.docsActionsRow}>
                  <button className={styles.btnSecondary} onClick={() => setIsDocsOpen(false)}>
                    Close
                  </button>
                </div>
              </div>

              <div className={styles.middleBody}>
                <div className={styles.docsStack}>
                  <div className={styles.docsPane}>
                    <div className={styles.docsPaneHeader}>
                      <div className={styles.docsPaneTitle}>Notes</div>
                      <div className={styles.docsActionsRow}>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            setDocsDrawerScope('notes');
                            onOpenLibraryDrawer();
                          }}
                        >
                          Library
                        </button>
                        <button className={styles.btnSecondary} onClick={() => void newNotesDoc()} disabled={isNotesSaving}>
                          New
                        </button>
                        <button className={styles.btnSecondary} onClick={() => void saveNotes()} disabled={!notesIsDirty || isNotesSaving}>
                          {isNotesSaving ? 'Saving…' : notesIsDirty ? 'Save' : 'Saved'}
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => void deleteNotesDoc()}
                          disabled={!notesDocId || isNotesSaving}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {notesError ? <div className={styles.error}>{notesError}</div> : null}

                    <div className={styles.docForm}>
                      <label className={styles.docLabel}>
                        Title
                        <input
                          value={notesDraftTitle}
                          onChange={(e) => setNotesDraftTitle(e.target.value)}
                          onBlur={() => flushNotesAutosave()}
                          placeholder="Untitled"
                        />
                      </label>
                      <label className={styles.docLabel}>
                        Tags
                        <input
                          value={notesDraftTagsText}
                          onChange={(e) => setNotesDraftTagsText(e.target.value)}
                          onBlur={() => flushNotesAutosave()}
                          placeholder="tag, tag2"
                        />
                      </label>
                    </div>

                    <textarea
                      className={styles.docTextFlex}
                      value={notesDraftContent}
                      onChange={(e) => setNotesDraftContent(e.target.value)}
                      onBlur={() => flushNotesAutosave()}
                      placeholder="Write a note…"
                    />
                  </div>

                  <div className={styles.docsPane}>
                    <div className={styles.docsPaneHeader}>
                      <div className={styles.docsTypeRow}>
                        <button
                          className={styles.tabBtn}
                          data-active={docsLowerType === 'stories' ? '1' : '0'}
                          onClick={() => {
                            flushMoodboardAutosave();
                            setDocsLowerType('stories');
                          }}
                        >
                          Stories
                        </button>
                        <button
                          className={styles.tabBtn}
                          data-active={docsLowerType === 'moodboard' ? '1' : '0'}
                          onClick={() => {
                            flushStoriesAutosave();
                            setDocsLowerType('moodboard');
                          }}
                        >
                          Moodboard
                        </button>
                      </div>

                      <div className={styles.docsActionsRow}>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            setDocsDrawerScope(docsLowerType);
                            onOpenLibraryDrawer();
                          }}
                        >
                          Library
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => void (docsLowerType === 'stories' ? newStoriesDoc() : newMoodboardDoc())}
                          disabled={docsLowerType === 'stories' ? isStoriesSaving : isMoodboardSaving}
                        >
                          New
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => void (docsLowerType === 'stories' ? saveStories() : saveMoodboard())}
                          disabled={
                            docsLowerType === 'stories'
                              ? !storiesIsDirty || isStoriesSaving
                              : !moodboardIsDirty || isMoodboardSaving
                          }
                        >
                          {docsLowerType === 'stories'
                            ? isStoriesSaving
                              ? 'Saving…'
                              : storiesIsDirty
                                ? 'Save'
                                : 'Saved'
                            : isMoodboardSaving
                              ? 'Saving…'
                              : moodboardIsDirty
                                ? 'Save'
                                : 'Saved'}
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => void (docsLowerType === 'stories' ? deleteStoriesDoc() : deleteMoodboardDoc())}
                          disabled={
                            docsLowerType === 'stories'
                              ? !storiesDocId || isStoriesSaving
                              : !moodboardDocId || isMoodboardSaving
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {docsLowerType === 'stories' ? (
                      <>
                        {storiesError ? <div className={styles.error}>{storiesError}</div> : null}

                        <div className={styles.docForm}>
                          <label className={styles.docLabel}>
                            Title
                            <input
                              value={storiesDraftTitle}
                              onChange={(e) => setStoriesDraftTitle(e.target.value)}
                              onBlur={() => flushStoriesAutosave()}
                              placeholder="Untitled"
                            />
                          </label>
                          <label className={styles.docLabel}>
                            Tags
                            <input
                              value={storiesDraftTagsText}
                              onChange={(e) => setStoriesDraftTagsText(e.target.value)}
                              onBlur={() => flushStoriesAutosave()}
                              placeholder="tag, tag2"
                            />
                          </label>
                        </div>

                        <textarea
                          className={styles.docTextFlex}
                          value={storiesDraftContent}
                          onChange={(e) => setStoriesDraftContent(e.target.value)}
                          onBlur={() => flushStoriesAutosave()}
                          placeholder="Write a story…"
                        />
                      </>
                    ) : (
                      <>
                        {moodboardError ? <div className={styles.error}>{moodboardError}</div> : null}

                        <div className={styles.docForm}>
                          <label className={styles.docLabel}>
                            Title
                            <input
                              value={moodboardDraftTitle}
                              onChange={(e) => setMoodboardDraftTitle(e.target.value)}
                              onBlur={() => flushMoodboardAutosave()}
                              placeholder="Untitled"
                            />
                          </label>
                          <label className={styles.docLabel}>
                            Tags
                            <input
                              value={moodboardDraftTagsText}
                              onChange={(e) => setMoodboardDraftTagsText(e.target.value)}
                              onBlur={() => flushMoodboardAutosave()}
                              placeholder="tag, tag2"
                            />
                          </label>
                        </div>

                        <div className={styles.moodboardBox}>
                          <MoodboardCanvas
                            key={moodboardDocId ?? 'moodboard'}
                            value={moodboardDraft}
                            onChange={setMoodboardDraft}
                            onRequestAddImage={() => {
                              setIsImagePickerOpen(true);
                              setImagePickerSource('character');
                            }}
                          />
                        </div>

                        {isImagePickerOpen ? (
                          <div className={styles.modalBackdrop} onClick={() => setIsImagePickerOpen(false)}>
                            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                              <div className={styles.modalHeader}>
                                <div className={styles.modalTitle}>Add image</div>
                                <button className={styles.btnSecondary} onClick={() => setIsImagePickerOpen(false)}>
                                  Close
                                </button>
                              </div>

                              <div className={styles.modalTabs}>
                                <button
                                  className={styles.tabBtn}
                                  data-active={imagePickerSource === 'character' ? '1' : '0'}
                                  onClick={() => setImagePickerSource('character')}
                                >
                                  This character
                                </button>
                                <button
                                  className={styles.tabBtn}
                                  data-active={imagePickerSource === 'global' ? '1' : '0'}
                                  onClick={() => setImagePickerSource('global')}
                                >
                                  Global carousel
                                </button>
                              </div>

                              <div className={styles.modalGrid}>
                                {(imagePickerSource === 'character' ? (character?.images ?? []) : globalPickerImages).map((img: any) => (
                                  <button
                                    key={img.id}
                                    className={styles.modalImgBtn}
                                    onClick={() => {
                                      addMoodboardImage(img.id);
                                      setIsImagePickerOpen(false);
                                    }}
                                    title={img.tags?.length ? img.tags.join(', ') : undefined}
                                  >
                                    <img className={styles.modalImg} src={`ckc://thumb/${encodeURIComponent(img.id)}`} alt="" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div
              className={styles.splitter}
              role="separator"
              aria-orientation="vertical"
              title="Resize panels"
              onPointerDown={beginResizeCharacter3Middle}
              onPointerMove={onResizeCharacterMove}
              onPointerUp={endResizeCharacter}
              onPointerCancel={endResizeCharacter}
              onLostPointerCapture={endResizeCharacter}
            />
          </>
        ) : null}

        <aside className={styles.right}>
          <div className={styles.header}>
            <div
              className={styles.headerLeft}
              data-drop-active={isHeaderDropActive ? '1' : '0'}
              onDragEnter={(e) => {
                if (!characterId || isImportingImages) return;
                e.preventDefault();
                setIsHeaderDropActive(true);
              }}
              onDragOver={(e) => {
                if (!characterId || isImportingImages) return;
                e.preventDefault();
                setIsHeaderDropActive(true);
              }}
              onDragLeave={() => setIsHeaderDropActive(false)}
              onDrop={(e) => {
                if (!characterId || isImportingImages) return;
                e.preventDefault();
                setIsHeaderDropActive(false);
                const files = Array.from(e.dataTransfer?.files ?? []);
                const filePaths = files
                  .map((f) => (f && typeof (f as any).path === 'string' ? String((f as any).path) : ''))
                  .filter(Boolean);
                void importImagesForCharacterFromPaths(filePaths);
              }}
              title="Drop image files here to import into this character"
            >
              <div className={styles.nameRow}>
                <div className={styles.name}>{character?.displayName ?? 'Character'}</div>
                {characterId ? (
                  <button
                    className={styles.idChip}
                    type="button"
                    onClick={copyCurrentCharacterId}
                    title={`Click to copy full Character ID: ${characterId}`}
                  >
                    {isCharacterIdCopied ? 'Copied!' : `ID: ${shortCharacterId(characterId)}`}
                  </button>
                ) : null}
              </div>
              <div className={styles.sub}>{isHeaderDropActive ? 'Drop to import images...' : 'Character Editor (rebuild)'}</div>
            </div>
            <div className={styles.headerRight}>
              {rightTab === 'sheet' ? (
                <button className={styles.btnSecondary} onClick={() => void saveSheet()} disabled={!isDirty || isSaving}>
                  {isSaving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
                </button>
              ) : null}
              <button
                className={styles.btnSecondary}
                onClick={() => void importImagesForCharacter()}
                disabled={!characterId || isImportingImages}
                title="Import images into this character"
              >
                {isImportingImages ? 'Importing...' : 'Import images...'}
              </button>
              <button className={styles.btnSecondary} onClick={onBack}>
                Library
              </button>
            </div>
          </div>

          <div className={styles.tabs}>
            <button className={styles.tabBtn} data-active={rightTab === 'sheet' ? '1' : '0'} onClick={() => setRightTab('sheet')}>
              Sheet
            </button>
            <button className={styles.tabBtn} data-active={rightTab === 'photos' ? '1' : '0'} onClick={() => setRightTab('photos')}>
              Photos
            </button>
            <button className={styles.tabBtn} data-active={isDocsOpen ? '1' : '0'} onClick={() => setIsDocsOpen((v) => !v)}>
              Notes
            </button>
            <button className={styles.tabBtn} data-active={rightTab === 'tools' ? '1' : '0'} onClick={() => setRightTab('tools')}>
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
              {rightTab === 'sheet' ? (
                <>
                  <div className={styles.sectionTitle}>Sheet</div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800 }}>Tags</span>
                      {(character.tags || [])
                        .filter((t) => t.type === 'manual')
                        .map((t) => t.text)
                        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                        .map((t) => (
                          <button
                            key={`manual-${t}`}
                            className={styles.btnSecondary}
                            style={{ padding: '4px 8px' }}
                            onClick={() => void removeManualTag(t)}
                            disabled={isTagSaving}
                            title="Remove manual tag"
                          >
                            {t} ×
                          </button>
                        ))}
                      {(character.tags || [])
                        .filter((t) => t.type === 'derived')
                        .map((t) => t.text)
                        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                        .map((t) => (
                          <span
                            key={`derived-${t}`}
                            style={{
                              padding: '4px 8px',
                              border: '1px dashed var(--glass-border)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.9rem',
                            }}
                            title="Derived tag (read-only)"
                          >
                            {t}
                          </span>
                        ))}
                      {(!character.tags || character.tags.length === 0) ? (
                        <span className={styles.muted}>(none)</span>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      <input
                        value={manualTagDraftText}
                        onChange={(e) => setManualTagDraftText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addManualTags();
                          }
                        }}
                        placeholder="tag"
                        list={tagsDatalistId}
                        style={{ width: 220 }}
                        disabled={isTagSaving}
                      />
                      <button
                        className={styles.btnSecondary}
                        onClick={() => void addManualTags()}
                        disabled={isTagSaving || tagsTextToArray(manualTagDraftText).length === 0}
                      >
                        Add
                      </button>
                      <button
                        className={styles.btnSecondary}
                        onClick={() => setManualTagDraftText('')}
                        disabled={isTagSaving || !manualTagDraftText}
                      >
                        Clear
                      </button>
                      <datalist id={tagsDatalistId}>
                        {allTags.map((t) => (
                          <option key={t} value={t} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {saveIssues?.length ? (
                    <div className={styles.issueBox}>
                      <div className={styles.issueTitle}>Validation issues</div>
                      <ul className={styles.issueList}>
                        {saveIssues.map((i, idx) => (
                          <li key={`${i.fieldId}-${idx}`}>
                            <span className={styles.issueSeverity} data-sev={i.severity}>
                              {i.severity}
                            </span>{' '}
                            <span className={styles.issueField}>{i.fieldId}</span>: {i.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {!templateAst ? (
                    <div className={styles.muted}>Loading template…</div>
                  ) : (
                    <SheetEditor
                      templateSections={templateAst.sections || []}
                      valuesById={draftValuesById}
                      onChange={(fieldId, value) => setDraftValuesById((prev) => ({ ...prev, [fieldId]: value }))}
                    />
                  )}
                </>
              ) : rightTab === 'photos' ? (
                <>
                  <div className={styles.sectionTitle}>Photos</div>
                  <div className={styles.muted}>Media lives in the left pane; this panel will hold photo metadata/edit tools.</div>
                </>
              ) : rightTab === 'tools' ? (
                <>
                  <div className={styles.sectionTitle}>Tools</div>
                  <div className={styles.smallNote}>Character icon is shown in the Library list. Focus sliders control the crop.</div>

                  <div className={styles.iconRow}>
                    <div className={styles.iconPreview}>
                      {iconDraftImageId ? (
                        <img
                          className={styles.iconImg}
                          src={`ckc://thumb/${encodeURIComponent(iconDraftImageId)}`}
                          alt=""
                          style={{
                            objectPosition: `${Math.round(clamp01(iconDraftFocusX) * 100)}% ${Math.round(
                              clamp01(iconDraftFocusY) * 100
                            )}%`,
                          }}
                        />
                      ) : (
                        <div className={styles.iconPlaceholder}>No icon</div>
                      )}
                    </div>

                    <div className={styles.iconControls}>
                      <div className={styles.iconControlRow}>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => void saveIcon()}
                          disabled={!character || isIconSaving || !iconIsDirty}
                        >
                          {isIconSaving ? 'Saving…' : iconIsDirty ? 'Save icon' : 'Icon saved'}
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => setIconDraftImageId(null)}
                          disabled={!character || isIconSaving || !iconDraftImageId}
                        >
                          Clear
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            setIconDraftFocusX(0.5);
                            setIconDraftFocusY(0.5);
                          }}
                          disabled={!character || isIconSaving}
                        >
                          Center
                        </button>
                      </div>

                      <div className={styles.iconControlRow}>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          Image{' '}
                          <select
                            value={iconDraftImageId ?? ''}
                            onChange={(e) => setIconDraftImageId(e.target.value ? e.target.value : null)}
                            disabled={!character || isIconSaving}
                          >
                            <option value="">(none)</option>
                            {(character?.images || []).map((img) => (
                              <option key={img.id} value={img.id}>
                                {fileNameFromRelativePath(img.relativePath) || img.id}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className={styles.iconControlRow}>
                        <div className={styles.iconSlider}>
                          <span>Focus X</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={String(Math.round(clamp01(iconDraftFocusX) * 100))}
                            onChange={(e) => setIconDraftFocusX((Number(e.target.value) || 0) / 100)}
                            disabled={!character || isIconSaving || !iconDraftImageId}
                          />
                          <code>{Math.round(clamp01(iconDraftFocusX) * 100)}%</code>
                        </div>

                        <div className={styles.iconSlider}>
                          <span>Focus Y</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={String(Math.round(clamp01(iconDraftFocusY) * 100))}
                            onChange={(e) => setIconDraftFocusY((Number(e.target.value) || 0) / 100)}
                            disabled={!character || isIconSaving || !iconDraftImageId}
                          />
                          <code>{Math.round(clamp01(iconDraftFocusY) * 100)}%</code>
                        </div>
                      </div>

                      {iconError ? (
                        <div className={styles.error} style={{ margin: '10px 0' }}>
                          {iconError}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div className={styles.sectionTitle}>Exports</div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Data folder:</span>
                      <code style={{ fontSize: '0.85rem' }}>{libraryRoot ?? '(unknown)'}</code>
                      <button
                        className={styles.btnSecondary}
                        disabled={!libraryRoot || isExporting}
                        onClick={() => {
                          if (!libraryRoot) return;
                          void window.ckc.openPath(libraryRoot);
                        }}
                      >
                        Open folder
                      </button>
                      <button
                        className={styles.btnSecondary}
                        disabled={isExporting}
                        onClick={async () => {
                          const next = await window.ckc.selectLibraryRoot();
                          if (!next) return;
                          setLibraryRoot(next);
                          onBack();
                        }}
                        title="Change the data folder (db, characters, exports)"
                      >
                        Change...
                      </button>
                      <button
                        className={styles.btnSecondary}
                        disabled={isExporting || !defaultLibraryRootInfo}
                        onClick={async () => {
                          if (!defaultLibraryRootInfo) return;
                          const next = await window.ckc.resetLibraryRootToDefault();
                          setLibraryRoot(next);
                          onBack();
                        }}
                        title={
                          defaultLibraryRootInfo?.isPortable
                            ? `Reset to portable default:\n${defaultLibraryRootInfo.defaultLibraryRoot}`
                            : `Reset to default:\n${defaultLibraryRootInfo?.defaultLibraryRoot ?? ''}`
                        }
                      >
                        Reset
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Output:</span>
                      <code style={{ fontSize: '0.85rem' }}>{exportDir || defaultExportsDir || '(character exports folder)'}</code>
                      <button className={styles.btnSecondary} onClick={() => void chooseCharacterExportDir()} disabled={isExporting}>
                        Choose folder...
                      </button>
                      {exportDir ? (
                        <button className={styles.btnSecondary} onClick={() => setExportDir(null)} disabled={isExporting}>
                          Default
                        </button>
                      ) : null}
                      <button
                        className={styles.btnSecondary}
                        disabled={!defaultExportsDir && !exportDir}
                        onClick={() => {
                          const target = exportDir || defaultExportsDir;
                          if (!target) return;
                          void window.ckc.openPath(target);
                        }}
                      >
                        Open folder
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                      <button
                        className={styles.btnSecondary}
                        disabled={isExporting || !characterId}
                        onClick={() => void exportCharacterBundle()}
                      >
                        Export bundle (txt/md/pdf)
                      </button>

                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        Preset{' '}
                        <select
                          value={selectedSpinOffId ?? ''}
                          onChange={(e) => setSelectedSpinOffId(e.target.value || null)}
                          disabled={!spinOffs || spinOffs.length === 0 || isExporting}
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
                        className={styles.btnSecondary}
                        disabled={isExporting || !characterId || !selectedSpinOffId}
                        onClick={() => void exportCharacterFieldPack()}
                      >
                        Export LLM pack
                      </button>

                      {lastExportPath ? (
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            void window.ckc.openPath(dirName(lastExportPath));
                          }}
                        >
                          Open last
                        </button>
                      ) : null}
                    </div>

                    <details style={{ marginTop: 10 }}>
                      <summary>LLM pack options</summary>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={packIncludeValues}
                            onChange={(e) => setPackIncludeValues(e.target.checked)}
                            disabled={isExporting}
                          />{' '}
                          Include values
                        </label>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={packEmptyOnly}
                            onChange={(e) => setPackEmptyOnly(e.target.checked)}
                            disabled={isExporting}
                          />{' '}
                          Empty only
                        </label>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => setPackSections(null)}
                          disabled={isExporting}
                          title="Reset to all sections"
                        >
                          All sections
                        </button>
                      </div>

                      {templateAst ? (
                        <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {(templateAst.sections || []).map((s) => {
                            const all = (templateAst.sections || []).map((x) => x.title);
                            const checked = packSections === null ? true : (packSections || []).includes(s.title);
                            return (
                              <label key={s.title} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const wantOn = e.target.checked;
                                    setPackSections((prev) => {
                                      const cur = prev === null ? all : prev || [];
                                      const next = wantOn
                                        ? Array.from(new Set([...cur, s.title]))
                                        : cur.filter((t) => t !== s.title);
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
                      ) : null}
                    </details>

                    {exportError ? (
                      <div className={styles.error} style={{ margin: '10px 0' }}>
                        {exportError}
                      </div>
                    ) : null}
                    {lastExportPath ? (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 6 }}>
                        Last export: <code>{lastExportPath}</code>
                      </div>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <SheetIngestMergeTools
                      characterId={characterId}
                      isSheetDirty={isDirty}
                      onCharacterRefreshed={(next) => {
                        setCharacter(next);
                        setDraftValuesById(next.valuesById || {});
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <SheetVersionTools
                      characterId={characterId}
                      isSheetDirty={isDirty}
                      onCharacterRefreshed={(next) => {
                        setCharacter(next);
                        setDraftValuesById(next.valuesById || {});
                      }}
                    />
                  </div>

                  <details style={{ marginTop: 18 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      Local model (experimental)
                    </summary>
                    <div style={{ marginTop: 10 }}>
                      <div className={styles.docForm}>
                        <label className={styles.docLabel}>
                          Base URL
                          <input
                            value={llmBaseUrl}
                            onChange={(e) => setLlmBaseUrl(e.target.value)}
                            placeholder="http://127.0.0.1:11434/v1"
                          />
                        </label>
                        <label className={styles.docLabel}>
                          Model
                          <input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} placeholder="model name" />
                        </label>
                        <label className={styles.docLabel}>
                          API key (optional)
                          <input
                            type="password"
                            value={llmApiKey}
                            onChange={(e) => setLlmApiKey(e.target.value)}
                            placeholder="(usually blank for local)"
                          />
                        </label>
                        <label className={styles.docLabel}>
                          Timeout (sec)
                          <input
                            type="number"
                            min={5}
                            max={7200}
                            step={5}
                            value={String(llmTimeoutSec)}
                            onChange={(e) => setLlmTimeoutSec(Number(e.target.value))}
                            placeholder="900"
                          />
                        </label>
                        <label className={styles.docLabel} style={{ gridColumn: '1 / -1' }}>
                          System prompt (optional)
                          <textarea
                            value={llmSystemPrompt}
                            onChange={(e) => setLlmSystemPrompt(e.target.value)}
                            placeholder="System prompt…"
                            rows={3}
                          />
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            setLlmError(null);
                            void persistLlmConfig().catch((err: unknown) =>
                              setLlmError(err instanceof Error ? err.message : String(err))
                            );
                          }}
                          disabled={isLlmBusy}
                        >
                          Save settings
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => void runLlm()}
                          disabled={isLlmBusy || !llmPrompt.trim() || !llmBaseUrl.trim() || !llmModel.trim()}
                        >
                          {isLlmBusy ? 'Running…' : 'Run prompt'}
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => {
                            setLlmPrompt('');
                            setLlmResponse('');
                            setLlmError(null);
                          }}
                          disabled={isLlmBusy}
                        >
                          Clear
                        </button>
                      </div>

                      <div className={styles.smallNote} style={{ marginTop: 10 }}>
                        OpenAI-compatible chat endpoint. Known defaults: Ollama `http://127.0.0.1:11434/v1`, LM Studio
                        `http://127.0.0.1:1234/v1`.
                      </div>

                      <textarea
                        className={styles.llmPrompt}
                        value={llmPrompt}
                        onChange={(e) => setLlmPrompt(e.target.value)}
                        placeholder="Prompt…"
                      />

                      {llmError ? (
                        <div className={styles.error} style={{ margin: '10px 0' }}>
                          {llmError}
                        </div>
                      ) : null}
                      {llmResponse ? <pre className={styles.llmResponse}>{llmResponse}</pre> : null}
                    </div>
                  </details>
                </>
              ) : (
                <>
                  <div className={styles.sectionTitle}>Notes</div>
                  <div className={styles.muted}>Use the Notes button to toggle the 3-panel docs mode.</div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

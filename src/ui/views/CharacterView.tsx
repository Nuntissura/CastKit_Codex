import React from 'react';
import { LibraryDrawer } from '../components/LibraryDrawer';
import { MediaPane } from '../components/MediaPane';
import { MoodboardCanvas, type MoodboardState } from '../components/MoodboardCanvas';
import { SheetEditor } from '../components/SheetEditor';
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
  const [tab, setTab] = React.useState<'sheet' | 'photos' | 'notes' | 'tools'>('sheet');
  const [mediaMode, setMediaMode] = React.useState<'carousel' | 'photos'>('carousel');

  const [templateAst, setTemplateAst] = React.useState<CKCTemplateAst | null>(null);
  const [draftValuesById, setDraftValuesById] = React.useState<Record<string, string>>({});
  const [saveIssues, setSaveIssues] = React.useState<Array<{ fieldId: string; severity: string; message: string }> | null>(null);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  const [docType, setDocType] = React.useState<CKCDocType>('notes');
  const [docQueryText, setDocQueryText] = React.useState<string>('');
  const [docs, setDocs] = React.useState<CKCDocListItem[] | null>(null);
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null);
  const [loadedDoc, setLoadedDoc] = React.useState<CKCDocDetail | null>(null);
  const [draftDocTitle, setDraftDocTitle] = React.useState<string>('');
  const [draftDocContent, setDraftDocContent] = React.useState<string>('');
  const [draftDocTagsText, setDraftDocTagsText] = React.useState<string>('');
  const [docError, setDocError] = React.useState<string | null>(null);
  const [isDocSaving, setIsDocSaving] = React.useState<boolean>(false);
  const [moodboard, setMoodboard] = React.useState<MoodboardState>(() => emptyMoodboard());

  const [isImagePickerOpen, setIsImagePickerOpen] = React.useState<boolean>(false);
  const [imagePickerSource, setImagePickerSource] = React.useState<'character' | 'global'>('character');
  const [globalPickerImages, setGlobalPickerImages] = React.useState<CKCGlobalImage[]>([]);

  React.useEffect(() => {
    if (!characterId) return;
    setCharacter(null);
    setError(null);
    setTemplateAst(null);
    setDraftValuesById({});
    setSaveIssues(null);

    window.ckc
      .getCharacter(characterId)
      .then((c) => setCharacter(c))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [characterId]);

  React.useEffect(() => {
    if (!character) return;
    setDraftValuesById(character.valuesById || {});
    void window.ckc.getTemplateDetail(character.templateId).then((detail) => setTemplateAst(detail?.ast ?? null));
  }, [character]);

  const reloadDocs = React.useCallback(() => {
    window.ckc
      .listDocs({ docType, queryText: docQueryText })
      .then((rows) => setDocs(rows))
      .catch((err: unknown) => setDocError(err instanceof Error ? err.message : String(err)));
  }, [docType, docQueryText]);

  React.useEffect(() => {
    if (tab !== 'notes' && !isLibraryDrawerOpen) return;
    reloadDocs();
  }, [tab, isLibraryDrawerOpen, reloadDocs]);

  React.useEffect(() => {
    // Reset selection when switching doc type.
    setSelectedDocId(null);
    setLoadedDoc(null);
    setDraftDocTitle('');
    setDraftDocContent('');
    setDraftDocTagsText('');
    setMoodboard(emptyMoodboard());
  }, [docType]);

  React.useEffect(() => {
    if (!selectedDocId) return;
    setDocError(null);
    window.ckc
      .getDoc({ docType, docId: selectedDocId })
      .then((doc) => {
        setLoadedDoc(doc);
        setDraftDocTitle(doc?.title ?? '');
        setDraftDocTagsText(tagsArrayToText(doc?.tags ?? []));

        if (docType === 'moodboard') {
          try {
            const parsed = JSON.parse(doc?.content ?? '{}');
            if (
              parsed &&
              typeof parsed === 'object' &&
              parsed.version === 1 &&
              Array.isArray(parsed.strokes) &&
              Array.isArray(parsed.images)
            ) {
              setMoodboard(parsed);
            } else {
              setMoodboard(emptyMoodboard());
            }
          } catch {
            setMoodboard(emptyMoodboard());
          }
          setDraftDocContent('');
        } else {
          setDraftDocContent(doc?.content ?? '');
          setMoodboard(emptyMoodboard());
        }
      })
      .catch((err: unknown) => setDocError(err instanceof Error ? err.message : String(err)));
  }, [selectedDocId, docType]);

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

  const docTags = React.useMemo(() => tagsTextToArray(draftDocTagsText), [draftDocTagsText]);

  const docIsDirty = React.useMemo(() => {
    const loadedTags = loadedDoc?.tags ?? [];
    const sameTags =
      loadedTags.length === docTags.length &&
      loadedTags.every((t) => docTags.includes(t)) &&
      docTags.every((t) => loadedTags.includes(t));

    if (docType === 'moodboard') {
      const currentJson = JSON.stringify(moodboard);
      const loadedJson = loadedDoc?.content ?? '';
      return String(draftDocTitle ?? '') !== String(loadedDoc?.title ?? '') || !sameTags || currentJson !== String(loadedJson ?? '');
    }

    return (
      String(draftDocTitle ?? '') !== String(loadedDoc?.title ?? '') ||
      String(draftDocContent ?? '') !== String(loadedDoc?.content ?? '') ||
      !sameTags
    );
  }, [docType, loadedDoc, draftDocTitle, draftDocContent, docTags, moodboard]);

  const saveDoc = async () => {
    setIsDocSaving(true);
    setDocError(null);
    try {
      const content = docType === 'moodboard' ? JSON.stringify(moodboard) : draftDocContent;
      const res = await window.ckc.upsertDoc({
        docType,
        docId: selectedDocId,
        title: draftDocTitle,
        content,
        tags: docTags,
      });

      const nextId = res?.docId || selectedDocId;
      if (nextId) setSelectedDocId(nextId);
      reloadDocs();
      if (nextId) {
        const fresh = await window.ckc.getDoc({ docType, docId: nextId });
        setLoadedDoc(fresh);
      }
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDocSaving(false);
    }
  };

  const newDoc = async () => {
    setIsDocSaving(true);
    setDocError(null);
    try {
      const res = await window.ckc.upsertDoc({
        docType,
        title: 'Untitled',
        content: docType === 'moodboard' ? JSON.stringify(emptyMoodboard()) : '',
        tags: [],
      });
      if (res?.docId) {
        setSelectedDocId(res.docId);
        reloadDocs();
        onCloseLibraryDrawer();
      }
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDocSaving(false);
    }
  };

  const deleteDoc = async () => {
    if (!selectedDocId) return;
    if (!confirm('Delete this document?')) return;
    setIsDocSaving(true);
    setDocError(null);
    try {
      await window.ckc.deleteDoc({ docType, docId: selectedDocId });
      setSelectedDocId(null);
      setLoadedDoc(null);
      setDraftDocTitle('');
      setDraftDocContent('');
      setDraftDocTagsText('');
      setMoodboard(emptyMoodboard());
      reloadDocs();
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDocSaving(false);
    }
  };

  const addMoodboardImage = (imageId: string) => {
    setMoodboard((prev) => ({
      ...prev,
      images: [
        ...(prev.images || []),
        {
          imageId,
          x: 0.5,
          y: 0.5,
          w: 0.55,
          h: 0.55,
        },
      ],
    }));
  };

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
                  data-active={docType === t ? '1' : '0'}
                  onClick={() => setDocType(t)}
                >
                  {t === 'notes' ? 'Notes' : t === 'stories' ? 'Stories' : 'Moodboard'}
                </button>
              ))}
            </div>
            <div className={styles.docsDrawerActions}>
              <button className={styles.btnSecondary} onClick={() => void newDoc()} disabled={isDocSaving}>
                New
              </button>
              <button className={styles.btnSecondary} onClick={onCloseLibraryDrawer}>
                Close
              </button>
            </div>
          </div>

          <label className={styles.docsSearch}>
            Search <input value={docQueryText} onChange={(e) => setDocQueryText(e.target.value)} placeholder="Title…" />
          </label>

          {docError ? <div className={styles.error}>{docError}</div> : null}
          {docs === null ? (
            <div className={styles.muted}>Loading…</div>
          ) : docs.length === 0 ? (
            <div className={styles.muted}>No documents.</div>
          ) : (
            <div className={styles.docsList}>
              {docs.map((d) => (
                <button
                  key={d.id}
                  className={styles.docsItem}
                  data-active={d.id === selectedDocId ? '1' : '0'}
                  onClick={() => {
                    setSelectedDocId(d.id);
                    onCloseLibraryDrawer();
                  }}
                  title={d.tags?.length ? d.tags.join(', ') : undefined}
                >
                  <div className={styles.docsItemTitle}>{d.title}</div>
                  <div className={styles.docsItemMeta}>{new Date(d.updatedAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </LibraryDrawer>

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
              <div className={styles.docsTypeRow}>
                {(['notes', 'stories', 'moodboard'] as const).map((t) => (
                  <button
                    key={t}
                    className={styles.tabBtn}
                    data-active={docType === t ? '1' : '0'}
                    onClick={() => setDocType(t)}
                  >
                    {t === 'notes' ? 'Notes' : t === 'stories' ? 'Stories' : 'Moodboard'}
                  </button>
                ))}
              </div>

              <div className={styles.docsActionsRow}>
                <button className={styles.btnSecondary} onClick={onOpenLibraryDrawer}>
                  Library
                </button>
                <button className={styles.btnSecondary} onClick={() => void newDoc()} disabled={isDocSaving}>
                  New
                </button>
                <button className={styles.btnSecondary} onClick={() => void saveDoc()} disabled={!docIsDirty || isDocSaving}>
                  {isDocSaving ? 'Saving…' : docIsDirty ? 'Save' : 'Saved'}
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => void deleteDoc()}
                  disabled={!selectedDocId || isDocSaving}
                >
                  Delete
                </button>
                <button className={styles.btnSecondary} onClick={() => setTab('sheet')}>
                  Close
                </button>
              </div>
            </div>

            <div className={styles.middleBody}>
              {docError ? <div className={styles.error}>{docError}</div> : null}

              <div className={styles.docForm}>
                <label className={styles.docLabel}>
                  Title <input value={draftDocTitle} onChange={(e) => setDraftDocTitle(e.target.value)} placeholder="Untitled" />
                </label>
                <label className={styles.docLabel}>
                  Tags{' '}
                  <input
                    value={draftDocTagsText}
                    onChange={(e) => setDraftDocTagsText(e.target.value)}
                    placeholder="tag, tag2"
                  />
                </label>
              </div>

              {docType === 'moodboard' ? (
                <>
                  <MoodboardCanvas
                    value={moodboard}
                    onChange={setMoodboard}
                    onRequestAddImage={() => {
                      setIsImagePickerOpen(true);
                      setImagePickerSource('character');
                    }}
                  />

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
              ) : (
                <textarea
                  className={styles.docText}
                  value={draftDocContent}
                  onChange={(e) => setDraftDocContent(e.target.value)}
                  placeholder={docType === 'notes' ? 'Write a note…' : 'Write a story…'}
                />
              )}
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
              {tab === 'sheet' ? (
                <button className={styles.btnSecondary} onClick={() => void saveSheet()} disabled={!isDirty || isSaving}>
                  {isSaving ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
                </button>
              ) : null}
              <button className={styles.btnSecondary} onClick={onBack}>
                Library
              </button>
            </div>
          </div>

          <div className={styles.tabs}>
            <button className={styles.tabBtn} data-active={tab === 'sheet' ? '1' : '0'} onClick={() => setTab('sheet')}>
              Sheet
            </button>
            <button className={styles.tabBtn} data-active={tab === 'photos' ? '1' : '0'} onClick={() => setTab('photos')}>
              Photos
            </button>
            <button className={styles.tabBtn} data-active={tab === 'notes' ? '1' : '0'} onClick={() => setTab('notes')}>
              Notes
            </button>
            <button className={styles.tabBtn} data-active={tab === 'tools' ? '1' : '0'} onClick={() => setTab('tools')}>
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
                  <div className={styles.sectionTitle}>Sheet</div>

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
    </>
  );
}


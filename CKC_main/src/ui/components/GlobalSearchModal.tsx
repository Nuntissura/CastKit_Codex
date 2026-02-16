import React from 'react';
import styles from './globalSearchModal.module.css';

type JumpTarget =
  | { kind: 'characterField'; characterId: string; fieldId: string | null; needle: string }
  | { kind: 'doc'; docType: CKCDocType; docId: string; needle: string }
  | { kind: 'image'; characterId: string; imageId: string; needle: string }
  | { kind: 'moodboardText'; docId: string; layerId: string | null; needle: string };

function splitSnippet(snippet: string): Array<{ text: string; isHit: boolean }> {
  const raw = String(snippet ?? '');
  const start = '[[[';
  const end = ']]]';
  const parts: Array<{ text: string; isHit: boolean }> = [];
  let i = 0;
  while (i < raw.length) {
    const s = raw.indexOf(start, i);
    if (s < 0) {
      parts.push({ text: raw.slice(i), isHit: false });
      break;
    }
    if (s > i) parts.push({ text: raw.slice(i, s), isHit: false });
    const e = raw.indexOf(end, s + start.length);
    if (e < 0) {
      parts.push({ text: raw.slice(s), isHit: false });
      break;
    }
    parts.push({ text: raw.slice(s + start.length, e), isHit: true });
    i = e + end.length;
  }
  return parts.filter((p) => p.text.length > 0);
}

function Snippet({ snippet }: { snippet: string }) {
  const parts = React.useMemo(() => splitSnippet(snippet), [snippet]);
  if (parts.length === 0) return null;
  return (
    <div className={styles.snippet}>
      {parts.map((p, idx) =>
        p.isHit ? (
          <span key={idx} className={styles.snippetHit}>
            {p.text}
          </span>
        ) : (
          <span key={idx}>{p.text}</span>
        )
      )}
    </div>
  );
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  currentCharacterId,
  onJump,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentCharacterId: string | null;
  onJump: (target: JumpTarget) => void;
}) {
  const [query, setQuery] = React.useState<string>('');
  const [scope, setScope] = React.useState<CKCGlobalSearchScope>('library');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CKCGlobalSearchResult | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const reqIdRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setBusy(false);
    setError(null);
    setResult(null);
    setScope(currentCharacterId ? 'character' : 'library');
  }, [currentCharacterId, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const q = String(query ?? '').trim();
    const nextScope: CKCGlobalSearchScope = scope === 'character' && !currentCharacterId ? 'library' : scope;
    if (nextScope !== scope) setScope(nextScope);

    if (!q) {
      setBusy(false);
      setError(null);
      setResult(null);
      return;
    }

    setBusy(true);
    setError(null);

    const myId = (reqIdRef.current += 1);
    const t = window.setTimeout(() => {
      window.ckc
        .globalSearch({ queryText: q, scope: nextScope, characterId: currentCharacterId })
        .then((res) => {
          if (reqIdRef.current !== myId) return;
          setResult(res);
        })
        .catch((err: unknown) => {
          if (reqIdRef.current !== myId) return;
          setError(err instanceof Error ? err.message : String(err));
          setResult(null);
        })
        .finally(() => {
          if (reqIdRef.current !== myId) return;
          setBusy(false);
        });
    }, 300);

    return () => window.clearTimeout(t);
  }, [currentCharacterId, isOpen, query, scope]);

  if (!isOpen) return null;

  const needle = String(result?.needle ?? '').trim() || String(query ?? '').trim();

  const jump = (target: JumpTarget) => {
    onJump(target);
    onClose();
  };

  const hits = result?.results ?? null;
  const hasAny =
    (hits?.characters?.length ?? 0) +
      (hits?.notes?.length ?? 0) +
      (hits?.stories?.length ?? 0) +
      (hits?.moodboards?.length ?? 0) +
      (hits?.images?.length ?? 0) >
    0;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search (supports "exact", AND/OR/NOT)…'
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
          />
          <div className={styles.scope}>
            <button
              className={styles.scopeBtn}
              data-active={scope === 'library' ? '1' : '0'}
              type="button"
              onClick={() => setScope('library')}
              title="Search the entire library"
            >
              Library
            </button>
            <button
              className={styles.scopeBtn}
              data-active={scope === 'character' ? '1' : '0'}
              type="button"
              onClick={() => setScope('character')}
              disabled={!currentCharacterId}
              title={currentCharacterId ? 'Search current character (sheet + images)' : 'Open a character to use this scope'}
            >
              Character
            </button>
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            Close
          </button>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.list}>
          {!query.trim() ? (
            <div className={styles.muted}>Type to search across sheets, docs, moodboards, and image metadata.</div>
          ) : busy ? (
            <div className={styles.muted}>Searching…</div>
          ) : !hasAny ? (
            <div className={styles.muted}>No matches.</div>
          ) : (
            <>
              {hits?.characters?.length ? (
                <div className={styles.group}>
                  <div className={styles.groupHeader}>Characters ({hits.characters.length})</div>
                  <div className={styles.groupBody}>
                    {hits.characters.map((h, idx) => {
                      const fieldId = h.fieldId === '__NAME__' ? null : h.fieldId;
                      return (
                        <button
                          key={`${h.characterId}:${h.fieldId}:${idx}`}
                          className={styles.hit}
                          type="button"
                          onClick={() => jump({ kind: 'characterField', characterId: h.characterId, fieldId, needle })}
                        >
                          <div className={styles.hitTop}>
                            <div className={styles.hitLabel}>{h.displayName || h.characterId}</div>
                            <div className={styles.hitHint}>{fieldId ? fieldId : 'Name'}</div>
                          </div>
                          <Snippet snippet={h.snippet} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {hits?.notes?.length ? (
                <div className={styles.group}>
                  <div className={styles.groupHeader}>Notes ({hits.notes.length})</div>
                  <div className={styles.groupBody}>
                    {hits.notes.map((h, idx) => (
                      <button
                        key={`${h.docId}:${idx}`}
                        className={styles.hit}
                        type="button"
                        onClick={() => jump({ kind: 'doc', docType: 'notes', docId: h.docId, needle })}
                      >
                        <div className={styles.hitTop}>
                          <div className={styles.hitLabel}>{h.title || '(untitled)'}</div>
                          <div className={styles.hitHint}>Notes</div>
                        </div>
                        <Snippet snippet={h.snippet} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {hits?.stories?.length ? (
                <div className={styles.group}>
                  <div className={styles.groupHeader}>Stories ({hits.stories.length})</div>
                  <div className={styles.groupBody}>
                    {hits.stories.map((h, idx) => (
                      <button
                        key={`${h.docId}:${idx}`}
                        className={styles.hit}
                        type="button"
                        onClick={() => jump({ kind: 'doc', docType: 'stories', docId: h.docId, needle })}
                      >
                        <div className={styles.hitTop}>
                          <div className={styles.hitLabel}>{h.title || '(untitled)'}</div>
                          <div className={styles.hitHint}>Stories</div>
                        </div>
                        <Snippet snippet={h.snippet} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {hits?.moodboards?.length ? (
                <div className={styles.group}>
                  <div className={styles.groupHeader}>Moodboards ({hits.moodboards.length})</div>
                  <div className={styles.groupBody}>
                    {hits.moodboards.map((h, idx) => {
                      const layerId = h.layerId && h.layerId !== '__TITLE__' ? h.layerId : null;
                      return (
                        <button
                          key={`${h.docId}:${h.layerId}:${idx}`}
                          className={styles.hit}
                          type="button"
                          onClick={() => jump({ kind: 'moodboardText', docId: h.docId, layerId, needle })}
                        >
                          <div className={styles.hitTop}>
                            <div className={styles.hitLabel}>{h.title || '(untitled)'}</div>
                            <div className={styles.hitHint}>Moodboard</div>
                          </div>
                          <Snippet snippet={h.snippet} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {hits?.images?.length ? (
                <div className={styles.group}>
                  <div className={styles.groupHeader}>Images ({hits.images.length})</div>
                  <div className={styles.groupBody}>
                    {hits.images.map((h, idx) => (
                      <button
                        key={`${h.imageId}:${idx}`}
                        className={styles.hit}
                        type="button"
                        onClick={() => jump({ kind: 'image', characterId: h.characterId, imageId: h.imageId, needle })}
                      >
                        <div className={styles.hitTop}>
                          <div className={styles.hitLabel}>{h.characterName || h.characterId}</div>
                          <div className={styles.hitHint}>Image</div>
                        </div>
                        <Snippet snippet={h.snippet} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


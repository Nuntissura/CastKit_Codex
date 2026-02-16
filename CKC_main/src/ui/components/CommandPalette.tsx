import React from 'react';
import styles from './commandPalette.module.css';

export type CommandPaletteRun =
  | { kind: 'openCharacter'; characterId: string }
  | { kind: 'openDoc'; docType: CKCDocType; docId: string }
  | { kind: 'filterTag'; tag: string }
  | { kind: 'openExports' }
  | { kind: 'openLibrary' }
  | { kind: 'openGlobalSearch' }
  | { kind: 'toggleMenu' };

type PaletteItem = {
  id: string;
  group: string;
  label: string;
  hint: string;
  searchText: string;
  run: CommandPaletteRun;
};

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyScoreToken(queryToken: string, hay: string): number | null {
  const q = norm(queryToken);
  const t = norm(hay);
  if (!q) return 0;
  if (!t) return null;

  const idx = t.indexOf(q);
  if (idx >= 0) return 250 - Math.min(200, idx) - Math.min(30, t.length - q.length);

  // subsequence match
  let ti = 0;
  let score = 0;
  let first = -1;
  let consecutive = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    const found = t.indexOf(ch, ti);
    if (found < 0) return null;
    if (first < 0) first = found;
    if (found === ti) consecutive += 1;
    else consecutive = 0;
    score += 10 + consecutive * 6 - Math.min(8, found - ti);
    ti = found + 1;
  }
  score += Math.max(0, 50 - Math.min(50, first));
  return score;
}

function fuzzyScore(query: string, hay: string): number | null {
  const tokens = norm(query)
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return 0;
  let sum = 0;
  for (const tok of tokens) {
    const s = fuzzyScoreToken(tok, hay);
    if (s == null) return null;
    sum += s;
  }
  return sum;
}

export function CommandPalette({
  isOpen,
  onClose,
  onRun,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRun: (cmd: CommandPaletteRun) => void;
}) {
  const [query, setQuery] = React.useState<string>('');
  const [activeIndex, setActiveIndex] = React.useState<number>(0);
  const [characters, setCharacters] = React.useState<CKCCharacterListItem[] | null>(null);
  const [docs, setDocs] = React.useState<CKCDocListItem[] | null>(null);
  const [tags, setTags] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    setError(null);
    setBusy(true);
    setCharacters(null);
    setDocs(null);
    setTags(null);

    void Promise.all([
      window.ckc.listCharacters({ queryText: '', tagFilters: [] }),
      Promise.all((['notes', 'stories', 'moodboard'] as const).map((t) => window.ckc.listDocs({ docType: t, queryText: '', tagFilters: [] }))).then(
        (lists) => ([] as CKCDocListItem[]).concat(...(lists || []))
      ),
      window.ckc.listAllTags(),
    ])
      .then(([chars, allDocs, allTags]) => {
        setCharacters(Array.isArray(chars) ? chars : []);
        const merged = Array.isArray(allDocs) ? allDocs : [];
        merged.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        setDocs(merged);
        setTags(Array.isArray(allTags) ? allTags : []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  const allItems = React.useMemo((): PaletteItem[] => {
    const out: PaletteItem[] = [];

    const actions: PaletteItem[] = [
      {
        id: 'action:open-library',
        group: 'Action',
        label: 'Open Library',
        hint: 'Go to Library view',
        searchText: 'open library home',
        run: { kind: 'openLibrary' },
      },
      {
        id: 'action:global-search',
        group: 'Action',
        label: 'Global Search',
        hint: 'Search content (Ctrl+Shift+F)',
        searchText: 'global search full text find',
        run: { kind: 'openGlobalSearch' },
      },
      {
        id: 'action:open-exports',
        group: 'Action',
        label: 'Open Exports',
        hint: 'Go to Export Hub',
        searchText: 'open exports export hub',
        run: { kind: 'openExports' },
      },
      {
        id: 'action:toggle-menu',
        group: 'Action',
        label: 'Toggle Menu',
        hint: 'Open/close left drawer',
        searchText: 'toggle menu drawer',
        run: { kind: 'toggleMenu' },
      },
    ];
    out.push(...actions);

    for (const c of characters || []) {
      const label = String(c.displayName || c.id).trim() || c.id;
      const hint = c.publicId ? `${c.publicId} • ${c.id}` : c.id;
      out.push({
        id: `character:${c.id}`,
        group: 'Character',
        label,
        hint,
        searchText: `${label} ${c.publicId || ''} ${c.id}`.trim(),
        run: { kind: 'openCharacter', characterId: c.id },
      });
    }

    for (const d of docs || []) {
      const label = String(d.title || '').trim() || '(untitled)';
      const hint = `${d.docType} • ${new Date(d.updatedAt).toLocaleString()}`;
      out.push({
        id: `doc:${d.docType}:${d.id}`,
        group: 'Doc',
        label,
        hint,
        searchText: `${label} ${d.docType} ${(d.tags || []).join(' ')} ${d.id}`.trim(),
        run: { kind: 'openDoc', docType: d.docType, docId: d.id },
      });
    }

    for (const t of tags || []) {
      const tag = String(t || '').trim();
      if (!tag) continue;
      out.push({
        id: `tag:${tag}`,
        group: 'Tag',
        label: tag,
        hint: 'Filter library by this tag',
        searchText: `tag ${tag}`,
        run: { kind: 'filterTag', tag },
      });
    }

    return out;
  }, [characters, docs, tags]);

  const results = React.useMemo(() => {
    const q = norm(query);
    const scored: Array<{ item: PaletteItem; score: number }> = [];
    for (const it of allItems) {
      const s = fuzzyScore(q, `${it.label} ${it.hint} ${it.searchText}`);
      if (s == null) continue;
      scored.push({ item: it, score: s });
    }
    scored.sort((a, b) => b.score - a.score || a.item.group.localeCompare(b.item.group) || a.item.label.localeCompare(b.item.label));
    return scored.slice(0, 120).map((x) => x.item);
  }, [allItems, query]);

  React.useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(0);
  }, [query, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (activeIndex < 0) setActiveIndex(0);
    else if (activeIndex >= results.length) setActiveIndex(Math.max(0, results.length - 1));
  }, [activeIndex, isOpen, results.length]);

  const runIndex = React.useCallback(
    (idx: number) => {
      const it = results[idx];
      if (!it) return;
      onRun(it.run);
    },
    [onRun, results]
  );

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
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
            placeholder="Type to search…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(results.length - 1, i + 1));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                runIndex(activeIndex);
              }
            }}
          />
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            Close
          </button>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.list} role="listbox" aria-label="Results">
          {busy && !characters && !docs && !tags ? (
            <div className={styles.muted}>Loading…</div>
          ) : results.length === 0 ? (
            <div className={styles.muted}>No matches.</div>
          ) : (
            results.map((it, idx) => (
              <button
                key={it.id}
                type="button"
                className={styles.item}
                data-active={idx === activeIndex ? '1' : '0'}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => runIndex(idx)}
                role="option"
                aria-selected={idx === activeIndex}
              >
                <div className={styles.group}>{it.group}</div>
                <div className={styles.main}>
                  <div className={styles.label}>{it.label}</div>
                  <div className={styles.hint}>{it.hint}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

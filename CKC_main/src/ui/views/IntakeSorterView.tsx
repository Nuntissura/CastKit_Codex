import React from 'react';
import styles from './intakeSorterView.module.css';

type IntakeImage = {
  path: string;
  fileName: string;
  bytes: number;
};

function formatBytes(bytes: number): string {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function IntakeSorterView({ onBack }: { onBack: () => void }) {
  const [sourceDir, setSourceDir] = React.useState('');
  const [mode, setMode] = React.useState<'folder' | 'linked'>('folder');
  const [characterId, setCharacterId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [tagsText, setTagsText] = React.useState('');
  const [images, setImages] = React.useState<IntakeImage[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const selected = images[selectedIndex] || null;

  const scan = React.useCallback(async () => {
    setBusy(true);
    setMessage('');
    try {
      const res = await (window as any).ckc.scanIntakeFolder({ sourceDir });
      const next = Array.isArray(res?.images) ? res.images : [];
      setImages(next);
      setSelectedIndex(0);
      setMessage(`Scanned ${next.length} image(s).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [sourceDir]);

  const pickFolder = React.useCallback(async () => {
    const picked = await (window as any).ckc.selectFolderDialog({ title: 'Select Intake Source Folder' });
    if (picked) setSourceDir(String(picked));
  }, []);

  const classify = React.useCallback(
    async (status: 'accepted' | 'pending' | 'rejected') => {
      if (!selected) return;
      setBusy(true);
      setMessage('');
      try {
        const tags = tagsText
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        await (window as any).ckc.classifyIntakeImage({
          sourcePath: selected.path,
          status,
          mode,
          characterId,
          notes,
          tags,
        });

        setImages((cur) => cur.filter((x) => x.path !== selected.path));
        setSelectedIndex((i) => Math.max(0, Math.min(i, images.length - 2)));
        setMessage(`${selected.fileName}: ${status}`);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [selected, mode, characterId, notes, tagsText, images.length]
  );

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button className={styles.button} onClick={onBack}>
          Back
        </button>
        <div>
          <div className={styles.title}>Image Intake Sorter</div>
          <div className={styles.subtitle}>Folder triage, or linked CKC profile import with pending review.</div>
        </div>
      </header>

      <section className={styles.controls}>
        <label className={styles.field}>
          <span>Source folder</span>
          <input value={sourceDir} onChange={(e) => setSourceDir(e.target.value)} placeholder="D:\\path\\to\\intake" />
        </label>
        <button className={styles.button} onClick={pickFolder} disabled={busy}>
          Pick
        </button>
        <button className={styles.button} onClick={scan} disabled={busy || !sourceDir.trim()}>
          Scan
        </button>
        <label className={styles.field}>
          <span>Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value === 'linked' ? 'linked' : 'folder')}>
            <option value="folder">Folder-only</option>
            <option value="linked">Linked CKC profile</option>
          </select>
        </label>
      </section>

      <main className={styles.body}>
        <aside className={styles.list}>
          {images.length === 0 ? (
            <div className={styles.empty}>No intake images scanned.</div>
          ) : (
            images.map((img, index) => (
              <button
                key={img.path}
                className={styles.row}
                data-active={index === selectedIndex ? '1' : '0'}
                onClick={() => setSelectedIndex(index)}
              >
                <span>{img.fileName}</span>
                <small>{formatBytes(img.bytes)}</small>
              </button>
            ))
          )}
        </aside>

        <section className={styles.detail}>
          {selected ? (
            <>
              <div className={styles.fileName}>{selected.fileName}</div>
              <div className={styles.path}>{selected.path}</div>

              {mode === 'linked' ? (
                <div className={styles.linked}>
                  <label className={styles.field}>
                    <span>Character ID</span>
                    <input value={characterId} onChange={(e) => setCharacterId(e.target.value)} placeholder="char_..." />
                  </label>
                  <label className={styles.field}>
                    <span>Notes</span>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </label>
                  <label className={styles.field}>
                    <span>Tags</span>
                    <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="tag1, tag2" />
                  </label>
                </div>
              ) : (
                <div className={styles.notice}>Folder-only mode moves originals and disables CKC notes/tags.</div>
              )}

              <div className={styles.actions}>
                <button className={styles.accept} onClick={() => classify('accepted')} disabled={busy || (mode === 'linked' && !characterId.trim())}>
                  Pass
                </button>
                <button className={styles.pending} onClick={() => classify('pending')} disabled={busy || (mode === 'linked' && !characterId.trim())}>
                  Pending
                </button>
                <button className={styles.reject} onClick={() => classify('rejected')} disabled={busy}>
                  Reject
                </button>
              </div>
            </>
          ) : (
            <div className={styles.empty}>Select an image to classify.</div>
          )}
          {message ? <div className={styles.message}>{message}</div> : null}
        </section>
      </main>
    </div>
  );
}

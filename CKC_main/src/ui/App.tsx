import React from 'react';
import { Drawer } from './components/Drawer';
import { CommandPalette, type CommandPaletteRun } from './components/CommandPalette';
import { LibraryView } from './views/LibraryView';
import { CharacterView } from './views/CharacterView';
import { ReferenceWindowView } from './views/ReferenceWindowView';
import { ExportHubView } from './views/ExportHubView';
import { useHotkeys } from './hooks/useHotkeys';
import styles from './styles/app.module.css';

type Page = 'library' | 'character' | 'exports';
type NonExportPage = 'library' | 'character';
type DrawerMode = 'none' | 'menu' | 'library';

type InitState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

function formatInitError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function App() {
  const isReferenceWindow = new URLSearchParams(window.location.search).get('ref') === '1';
  if (isReferenceWindow) return <ReferenceApp />;
  return <MainApp />;
}

function MainApp() {
  const [init, setInit] = React.useState<InitState>({ status: 'loading' });
  const [page, setPage] = React.useState<Page>('library');
  const [exportsReturnPage, setExportsReturnPage] = React.useState<NonExportPage>('library');
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = React.useState<string | null>(null);
  const [drawerMode, setDrawerMode] = React.useState<DrawerMode>('none');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState<boolean>(false);
  const [pendingOpenDoc, setPendingOpenDoc] = React.useState<{ docType: CKCDocType; docId: string } | null>(null);
  const [pendingLibraryTagFilter, setPendingLibraryTagFilter] = React.useState<string | null>(null);
  const [exportsContext, setExportsContext] = React.useState<{ characterId: string | null; moodboardDocId: string | null }>({
    characterId: null,
    moodboardDocId: null,
  });

  useHotkeys({
    onToggleMenu: () => setDrawerMode((m) => (m === 'menu' ? 'none' : 'menu')),
    onToggleCommandPalette: () => {
      setDrawerMode('none');
      setIsCommandPaletteOpen((v) => !v);
    },
    onCloseOverlays: () => {
      setDrawerMode('none');
      setIsCommandPaletteOpen(false);
    },
  });

  const runInit = React.useCallback(() => {
    setInit({ status: 'loading' });
    window.ckc
      .initialize()
      .then(() => setInit({ status: 'ready' }))
      .catch((err: unknown) => setInit({ status: 'error', message: formatInitError(err) }));
  }, []);

  React.useEffect(() => {
    runInit();
  }, [runInit]);

  if (init.status !== 'ready') {
    return (
      <div className={styles.root}>
        <div className={styles.loadingWrap}>
          <div className={styles.loadingTitle}>Loading library...</div>
          {init.status === 'error' ? (
            <>
              <div className={styles.loadingError}>{init.message}</div>
              <button className={styles.loadingButton} onClick={runInit}>
                Retry
              </button>
            </>
          ) : (
            <div className={styles.loadingHint}>If this takes long, the app may be waiting for a folder selection dialog.</div>
          )}
        </div>
      </div>
    );
  }

  const runCommandPalette = React.useCallback(
    (cmd: CommandPaletteRun) => {
      setIsCommandPaletteOpen(false);
      setDrawerMode('none');

      if (cmd.kind === 'toggleMenu') {
        setDrawerMode((m) => (m === 'menu' ? 'none' : 'menu'));
        return;
      }

      if (cmd.kind === 'openLibrary') {
        setPage('library');
        return;
      }

      if (cmd.kind === 'openExports') {
        const from: NonExportPage = page === 'character' ? 'character' : 'library';
        setExportsReturnPage(from);
        setExportsContext({
          characterId: from === 'character' ? selectedCharacterId : null,
          moodboardDocId: null,
        });
        setPage('exports');
        return;
      }

      if (cmd.kind === 'filterTag') {
        setPendingLibraryTagFilter(cmd.tag);
        setPage('library');
        return;
      }

      if (cmd.kind === 'openCharacter') {
        setSelectedCharacterId(cmd.characterId);
        setSelectedImageId(null);
        setPage('character');
        return;
      }

      if (cmd.kind === 'openDoc') {
        const request = { docType: cmd.docType, docId: cmd.docId };
        const openWithCharacter = (characterId: string) => {
          setSelectedCharacterId(characterId);
          setSelectedImageId(null);
          setPendingOpenDoc(request);
          setPage('character');
        };

        if (selectedCharacterId) {
          openWithCharacter(selectedCharacterId);
          return;
        }

        window.ckc
          .listCharacters({ queryText: '', tagFilters: [] })
          .then((chars) => {
            const first = Array.isArray(chars) ? chars[0]?.id : null;
            const id = String(first || '').trim();
            if (!id) {
              window.alert('No characters yet. Create a character first.');
              return;
            }
            openWithCharacter(id);
          })
          .catch((err: unknown) => window.alert(err instanceof Error ? err.message : String(err)));
        return;
      }
    },
    [page, selectedCharacterId]
  );

  return (
    <div className={styles.root}>
      <Drawer
        isOpen={drawerMode === 'menu'}
        onClose={() => setDrawerMode('none')}
        onNavigate={(nextPage) => {
          if (nextPage === 'exports') {
            const from: NonExportPage = page === 'character' ? 'character' : 'library';
            setExportsReturnPage(from);
            setExportsContext({
              characterId: from === 'character' ? selectedCharacterId : null,
              moodboardDocId: null,
            });
          }
          setPage(nextPage);
          setDrawerMode('none');
        }}
      />

      <div className={styles.topLeft}>
        <button
          className={styles.iconButton}
          onClick={() => setDrawerMode((m) => (m === 'menu' ? 'none' : 'menu'))}
          aria-label="Menu"
        >
          ☰
        </button>
      </div>

      <div className={styles.content}>
        {page === 'library' ? (
          <LibraryView
            commandPaletteTagFilter={pendingLibraryTagFilter}
            onCommandPaletteTagFilterHandled={() => setPendingLibraryTagFilter(null)}
            onOpenCharacter={(characterId, selectImageId) => {
              setSelectedCharacterId(characterId);
              setSelectedImageId(selectImageId ? String(selectImageId) : null);
              setPage('character');
            }}
            onOpenExports={() => {
              setExportsReturnPage('library');
              setExportsContext({ characterId: null, moodboardDocId: null });
              setPage('exports');
            }}
          />
        ) : page === 'character' ? (
          <CharacterView
            characterId={selectedCharacterId}
            onBack={() => setPage('library')}
            onNavigateCharacter={(nextId) => {
              setSelectedCharacterId(nextId);
              setSelectedImageId(null);
              setPage('character');
            }}
            selectImageId={selectedImageId}
            onSelectImageHandled={() => setSelectedImageId(null)}
            openDocRequest={pendingOpenDoc}
            onOpenDocRequestHandled={() => setPendingOpenDoc(null)}
            onOpenLibraryDrawer={() => setDrawerMode('library')}
            isLibraryDrawerOpen={drawerMode === 'library'}
            onCloseLibraryDrawer={() => setDrawerMode('none')}
            onOpenExports={(ctx) => {
              setExportsReturnPage('character');
              setExportsContext({
                characterId: ctx?.characterId ?? selectedCharacterId,
                moodboardDocId: ctx?.moodboardDocId ?? null,
              });
              setPage('exports');
            }}
          />
        ) : (
          <ExportHubView
            onBack={() => setPage(exportsReturnPage)}
            initialCharacterId={exportsContext.characterId}
            initialMoodboardDocId={exportsContext.moodboardDocId}
          />
        )}
      </div>

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} onRun={runCommandPalette} />
    </div>
  );
}

function ReferenceApp() {
  const [init, setInit] = React.useState<InitState>({ status: 'loading' });

  const runInit = React.useCallback(() => {
    setInit({ status: 'loading' });
    window.ckc
      .initialize()
      .then(() => setInit({ status: 'ready' }))
      .catch((err: unknown) => setInit({ status: 'error', message: formatInitError(err) }));
  }, []);

  React.useEffect(() => {
    runInit();
  }, [runInit]);

  if (init.status !== 'ready') {
    return (
      <div className={styles.root}>
        <div className={styles.content}>
          <div className={styles.loadingWrap}>
            <div className={styles.loadingTitle}>Loading library...</div>
            {init.status === 'error' ? (
              <>
                <div className={styles.loadingError}>{init.message}</div>
                <button className={styles.loadingButton} onClick={runInit}>
                  Retry
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <ReferenceWindowView />
      </div>
    </div>
  );
}

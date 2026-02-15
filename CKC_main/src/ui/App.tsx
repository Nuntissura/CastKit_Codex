import React from 'react';
import { Drawer } from './components/Drawer';
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
  const [exportsContext, setExportsContext] = React.useState<{ characterId: string | null; moodboardDocId: string | null }>({
    characterId: null,
    moodboardDocId: null,
  });

  useHotkeys({
    onToggleMenu: () => setDrawerMode((m) => (m === 'menu' ? 'none' : 'menu')),
    onCloseOverlays: () => setDrawerMode('none'),
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

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

export function App() {
  const isReferenceWindow = new URLSearchParams(window.location.search).get('ref') === '1';
  if (isReferenceWindow) return <ReferenceApp />;
  return <MainApp />;
}

function MainApp() {
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

  React.useEffect(() => {
    void window.ckc.initialize();
  }, []);

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
  React.useEffect(() => {
    void window.ckc.initialize();
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <ReferenceWindowView />
      </div>
    </div>
  );
}

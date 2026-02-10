import React from 'react';
import { Drawer } from './components/Drawer';
import { LibraryView } from './views/LibraryView';
import { CharacterView } from './views/CharacterView';
import { useHotkeys } from './hooks/useHotkeys';
import styles from './styles/app.module.css';

type Page = 'library' | 'character';

export function App() {
  const [page, setPage] = React.useState<Page>('library');
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState<boolean>(false);

  useHotkeys({
    onToggleMenu: () => setIsMenuOpen((v) => !v),
    onCloseOverlays: () => setIsMenuOpen(false),
  });

  React.useEffect(() => {
    void window.ckc.initialize();
  }, []);

  return (
    <div className={styles.root}>
      <Drawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={(nextPage) => {
          setPage(nextPage);
          setIsMenuOpen(false);
        }}
      />

      <div className={styles.topLeft}>
        <button className={styles.iconButton} onClick={() => setIsMenuOpen((v) => !v)} aria-label="Menu">
          ☰
        </button>
      </div>

      <div className={styles.content}>
        {page === 'library' ? (
          <LibraryView
            onOpenCharacter={(characterId) => {
              setSelectedCharacterId(characterId);
              setPage('character');
            }}
          />
        ) : (
          <CharacterView characterId={selectedCharacterId} onBack={() => setPage('library')} />
        )}
      </div>
    </div>
  );
}


import React from 'react';
import { Drawer } from './components/Drawer';
import { CommandPalette, type CommandPaletteRun } from './components/CommandPalette';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { LibraryView } from './views/LibraryView';
import { CharacterView } from './views/CharacterView';
import { ReferenceWindowView } from './views/ReferenceWindowView';
import { ExportHubView } from './views/ExportHubView';
import { IntakeSorterView } from './views/IntakeSorterView';
import { useHotkeys } from './hooks/useHotkeys';
import styles from './styles/app.module.css';

type Page = 'library' | 'character' | 'exports' | 'intake';
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
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = React.useState<boolean>(false);
  const [pendingOpenDoc, setPendingOpenDoc] = React.useState<{
    docType: CKCDocType;
    docId: string;
    focusNeedle?: string | null;
    moodboardLayerId?: string | null;
  } | null>(null);
  const [pendingFocusField, setPendingFocusField] = React.useState<{ characterId: string; fieldId: string | null } | null>(null);
  const [pendingLibraryTagFilter, setPendingLibraryTagFilter] = React.useState<string | null>(null);
  const [exportsContext, setExportsContext] = React.useState<{ characterId: string | null; moodboardDocId: string | null }>({
    characterId: null,
    moodboardDocId: null,
  });

  useHotkeys({
    onToggleMenu: () => setDrawerMode((m) => (m === 'menu' ? 'none' : 'menu')),
    onToggleCommandPalette: () => {
      setDrawerMode('none');
      setIsGlobalSearchOpen(false);
      setIsCommandPaletteOpen((v) => !v);
    },
    onToggleGlobalSearch: () => {
      setDrawerMode('none');
      setIsCommandPaletteOpen(false);
      setIsGlobalSearchOpen((v) => !v);
    },
    onCloseOverlays: () => {
      setDrawerMode('none');
      setIsCommandPaletteOpen(false);
      setIsGlobalSearchOpen(false);
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

  React.useEffect(() => {
    const ckc = (window as any).ckc;
    if (!ckc?.automationSetRendererState) return;
    void ckc.automationSetRendererState({
      route: page,
      selectedCharacterId,
      selectedImageId,
      drawerMode,
      overlays: {
        commandPalette: isCommandPaletteOpen,
        globalSearch: isGlobalSearchOpen,
      },
      visibleControls: {
        menuButton: true,
      },
    });
  }, [page, selectedCharacterId, selectedImageId, drawerMode, isCommandPaletteOpen, isGlobalSearchOpen]);

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

      if (cmd.kind === 'openGlobalSearch') {
        setIsGlobalSearchOpen(true);
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
        const request = { docType: cmd.docType, docId: cmd.docId, focusNeedle: null, moodboardLayerId: null };
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

  const openDocInCharacter = React.useCallback(
    (request: { docType: CKCDocType; docId: string; focusNeedle?: string | null; moodboardLayerId?: string | null }) => {
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
    },
    [selectedCharacterId]
  );

  React.useEffect(() => {
    const ckc = (window as any).ckc;
    if (!ckc?.onAutomationCommand || !ckc?.automationCommandResult) return;

    const off = ckc.onAutomationCommand(async (payload: any) => {
      const id = String(payload?.id || '');
      const command = String(payload?.command || '');
      const params = payload?.params && typeof payload.params === 'object' ? payload.params : {};

      try {
        let result: any = { ok: true };
        if (command === 'openLibrary') {
          setPage('library');
        } else if (command === 'openCharacter') {
          const characterId = String(params.characterId || '').trim();
          if (!characterId) throw new Error('characterId is required');
          setSelectedCharacterId(characterId);
          setSelectedImageId(null);
          setPendingOpenDoc(null);
          setPendingFocusField(null);
          setPage('character');
        } else if (command === 'openExports') {
          setExportsReturnPage(page === 'character' ? 'character' : 'library');
          setExportsContext({ characterId: selectedCharacterId, moodboardDocId: null });
          setPage('exports');
        } else if (command === 'openIntake') {
          setPage('intake');
        } else if (command === 'selectImage') {
          const imageId = String(params.imageId || '').trim();
          if (!imageId) throw new Error('imageId is required');
          setSelectedImageId(imageId);
          if (params.characterId) setSelectedCharacterId(String(params.characterId));
          setPage('character');
        } else if (command === 'openGlobalSearch') {
          setIsGlobalSearchOpen(true);
        } else if (command === 'toggleMenu') {
          setDrawerMode((m) => (m === 'menu' ? 'none' : 'menu'));
        } else if (command === 'closeOverlays') {
          setDrawerMode('none');
          setIsCommandPaletteOpen(false);
          setIsGlobalSearchOpen(false);
        } else if (command === 'getRendererState') {
          result = {
            route: page,
            selectedCharacterId,
            selectedImageId,
            drawerMode,
            overlays: {
              commandPalette: isCommandPaletteOpen,
              globalSearch: isGlobalSearchOpen,
            },
          };
        } else {
          throw new Error(`Unsupported renderer automation command: ${command}`);
        }

        await ckc.automationCommandResult({ id, ok: true, result });
      } catch (err) {
        await ckc.automationCommandResult({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });

    return () => {
      if (typeof off === 'function') off();
    };
  }, [page, selectedCharacterId, selectedImageId, drawerMode, isCommandPaletteOpen, isGlobalSearchOpen]);

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
            commandPaletteTagFilter={pendingLibraryTagFilter}
            onCommandPaletteTagFilterHandled={() => setPendingLibraryTagFilter(null)}
            onOpenCharacter={(characterId, selectImageId) => {
              setSelectedCharacterId(characterId);
              setSelectedImageId(selectImageId ? String(selectImageId) : null);
              setPendingFocusField(null);
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
              setPendingFocusField(null);
              setPage('character');
            }}
            onJumpToImage={(characterId, imageId) => {
              setSelectedCharacterId(characterId);
              setSelectedImageId(imageId);
              setPendingOpenDoc(null);
              setPendingFocusField(null);
              setPage('character');
            }}
            selectImageId={selectedImageId}
            onSelectImageHandled={() => setSelectedImageId(null)}
            openDocRequest={pendingOpenDoc}
            onOpenDocRequestHandled={() => setPendingOpenDoc(null)}
            focusFieldId={pendingFocusField?.characterId === selectedCharacterId ? pendingFocusField.fieldId : null}
            onFocusFieldHandled={() => setPendingFocusField(null)}
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
        ) : page === 'exports' ? (
          <ExportHubView
            onBack={() => setPage(exportsReturnPage)}
            initialCharacterId={exportsContext.characterId}
            initialMoodboardDocId={exportsContext.moodboardDocId}
          />
        ) : (
          <IntakeSorterView onBack={() => setPage('library')} />
        )}
      </div>

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} onRun={runCommandPalette} />

      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        currentCharacterId={page === 'character' ? selectedCharacterId : null}
        onJump={(target) => {
          if (target.kind === 'characterField') {
            setSelectedCharacterId(target.characterId);
            setSelectedImageId(null);
            setPendingOpenDoc(null);
            setPendingFocusField({ characterId: target.characterId, fieldId: target.fieldId });
            setPage('character');
            return;
          }

          if (target.kind === 'image') {
            setSelectedCharacterId(target.characterId);
            setSelectedImageId(target.imageId);
            setPendingOpenDoc(null);
            setPendingFocusField(null);
            setPage('character');
            return;
          }

          if (target.kind === 'doc') {
            openDocInCharacter({ docType: target.docType, docId: target.docId, focusNeedle: target.needle });
            return;
          }

          if (target.kind === 'moodboardText') {
            openDocInCharacter({ docType: 'moodboard', docId: target.docId, focusNeedle: target.needle, moodboardLayerId: target.layerId });
          }
        }}
      />
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

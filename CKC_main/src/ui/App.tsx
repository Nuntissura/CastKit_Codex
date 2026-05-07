import React from 'react';
import { Drawer } from './components/Drawer';
import { CommandPalette, type CommandPaletteRun } from './components/CommandPalette';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { HelpModal } from './components/HelpModal';
import { LibraryView } from './views/LibraryView';
import { CharacterView } from './views/CharacterView';
import { ReferenceWindowView } from './views/ReferenceWindowView';
import { ExportHubView } from './views/ExportHubView';
import { IntakeSorterView } from './views/IntakeSorterView';
import { PoseView } from './views/PoseView';
import { WorkflowView } from './views/WorkflowView';
import { useHotkeys } from './hooks/useHotkeys';
import styles from './styles/app.module.css';

type Page = 'library' | 'character' | 'exports' | 'intake' | 'pose' | 'workflow';
type NonExportPage = 'library' | 'character' | 'pose' | 'workflow';
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
  const [isHelpOpen, setIsHelpOpen] = React.useState<boolean>(false);
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
        const from: NonExportPage = page === 'character' || page === 'pose' || page === 'workflow' ? page : 'library';
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
          setExportsReturnPage(page === 'character' || page === 'pose' || page === 'workflow' ? page : 'library');
          setExportsContext({ characterId: selectedCharacterId, moodboardDocId: null });
          setPage('exports');
        } else if (command === 'openIntake') {
          setPage('intake');
        } else if (command === 'openPose') {
          const characterId = String(params.characterId || '').trim();
          const imageId = String(params.imageId || '').trim();
          if (characterId) setSelectedCharacterId(characterId);
          if (imageId) setSelectedImageId(imageId);
          setPage('pose');
        } else if (command === 'openWorkflow') {
          const characterId = String(params.characterId || '').trim();
          if (characterId) {
            setSelectedCharacterId(characterId);
            setSelectedImageId(null);
          }
          setPage('workflow');
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
        } else if (command === 'clickElement') {
          const selector = typeof params.selector === 'string' ? params.selector : '';
          if (!selector) throw new Error('clickElement: selector is required');
          const el = document.querySelector(selector) as HTMLElement | null;
          if (!el) throw new Error(`clickElement: no element matches selector ${selector}`);
          // WP-0103: dispatch the full event sequence a real user click
          // produces (pointer + mouse + click) so React 19 controlled
          // elements fire their onClick reliably. Strictly window-scoped
          // — no OS input, no focus steal beyond the dispatchEvent target.
          //
          // KNOWN GAP: in some React 19 controlled-button cases (notably
          // CharacterView's Save button), even this richer sequence does
          // not complete the React onClick handler chain. Native CDP
          // Input.dispatchMouseEvent (trusted events) also fails to
          // trigger the same handler. Investigation pending. For agent
          // tests of save flows, prefer backend window.ckc.saveCharacter
          // directly — it always works.
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy } as MouseEventInit;
          el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true }));
          el.dispatchEvent(new MouseEvent('mousedown', opts));
          try { (el as HTMLElement).focus({ preventScroll: true }); } catch { /* ignore focus failure */ }
          el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse', isPrimary: true }));
          el.dispatchEvent(new MouseEvent('mouseup', opts));
          el.dispatchEvent(new MouseEvent('click', opts));
          result = { ok: true, selector, tag: el.tagName.toLowerCase() };
        } else if (command === 'typeText') {
          const text = typeof params.text === 'string' ? params.text : '';
          const selector = typeof params.selector === 'string' ? params.selector : '';
          let el: HTMLElement | null = selector
            ? (document.querySelector(selector) as HTMLElement | null)
            : (document.activeElement as HTMLElement | null);
          if (!el) throw new Error(`typeText: no element matches selector ${selector || '(activeElement)'}`);
          if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !(el as HTMLElement).isContentEditable) {
            throw new Error(`typeText: element ${el.tagName.toLowerCase()} is not an input, textarea, or contenteditable`);
          }
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            // Native value setter so React/onChange listeners pick up the change.
            const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (!setter) throw new Error('typeText: cannot resolve native value setter');
            setter.call(el, String(text));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            // contenteditable
            (el as HTMLElement).innerText = String(text);
            el.dispatchEvent(new InputEvent('input', { bubbles: true, data: String(text), inputType: 'insertText' }));
          }
          result = { ok: true, selector: selector || null, length: text.length };
        } else if (command === 'getRendererUIState') {
          result = {
            route: page,
            initStatus: init.status,
            selectedCharacterId,
            selectedImageId,
            drawerMode,
            overlays: {
              commandPalette: isCommandPaletteOpen,
              globalSearch: isGlobalSearchOpen,
            },
            exports: {
              returnPage: exportsReturnPage,
              context: exportsContext,
            },
            pendingDoc: pendingOpenDoc,
            pendingFocusField,
            pendingLibraryTagFilter,
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
  }, [
    page,
    init.status,
    selectedCharacterId,
    selectedImageId,
    drawerMode,
    isCommandPaletteOpen,
    isGlobalSearchOpen,
    exportsReturnPage,
    exportsContext,
    pendingOpenDoc,
    pendingFocusField,
    pendingLibraryTagFilter,
  ]);

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
            const from: NonExportPage = page === 'character' || page === 'pose' || page === 'workflow' ? page : 'library';
            setExportsReturnPage(from);
            setExportsContext({
              characterId: from === 'character' ? selectedCharacterId : null,
              moodboardDocId: null,
            });
          }
          setPage(nextPage);
          setDrawerMode('none');
        }}
        onOpenHelp={() => {
          setDrawerMode('none');
          setIsHelpOpen(true);
        }}
      />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

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
        ) : page === 'pose' ? (
          <PoseView
            initialCharacterId={selectedCharacterId}
            initialImageId={selectedImageId}
            onSelectCharacter={(characterId) => {
              setSelectedCharacterId(characterId);
              setSelectedImageId(null);
            }}
            onSelectImage={(imageId) => setSelectedImageId(imageId)}
          />
        ) : page === 'workflow' ? (
          <WorkflowView
            initialCharacterId={selectedCharacterId}
            onSelectCharacter={(characterId) => {
              setSelectedCharacterId(characterId);
              setSelectedImageId(null);
            }}
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

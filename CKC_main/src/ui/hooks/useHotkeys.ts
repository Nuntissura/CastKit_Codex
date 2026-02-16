import React from 'react';

function isEditableActiveElement(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function useHotkeys({
  onToggleMenu,
  onToggleCommandPalette,
  onToggleGlobalSearch,
  onCloseOverlays,
}: {
  onToggleMenu: () => void;
  onToggleCommandPalette?: () => void;
  onToggleGlobalSearch?: () => void;
  onCloseOverlays: () => void;
}) {
  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        onCloseOverlays();
        return;
      }

      if (evt.ctrlKey && (evt.key === 'k' || evt.key === 'K')) {
        if (isEditableActiveElement()) return;
        evt.preventDefault();
        onToggleCommandPalette?.();
        return;
      }

      if (evt.ctrlKey && (evt.key === 'b' || evt.key === 'B')) {
        if (isEditableActiveElement()) return;
        evt.preventDefault();
        onToggleMenu();
      }

      if (evt.ctrlKey && evt.shiftKey && (evt.key === 'f' || evt.key === 'F')) {
        if (isEditableActiveElement()) return;
        evt.preventDefault();
        onToggleGlobalSearch?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleMenu, onToggleCommandPalette, onToggleGlobalSearch, onCloseOverlays]);
}

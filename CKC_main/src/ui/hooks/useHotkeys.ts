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
  onCloseOverlays,
}: {
  onToggleMenu: () => void;
  onCloseOverlays: () => void;
}) {
  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        onCloseOverlays();
        return;
      }

      if (evt.ctrlKey && (evt.key === 'b' || evt.key === 'B')) {
        if (isEditableActiveElement()) return;
        evt.preventDefault();
        onToggleMenu();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleMenu, onCloseOverlays]);
}

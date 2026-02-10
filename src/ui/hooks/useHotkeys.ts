import React from 'react';

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
        evt.preventDefault();
        onToggleMenu();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleMenu, onCloseOverlays]);
}


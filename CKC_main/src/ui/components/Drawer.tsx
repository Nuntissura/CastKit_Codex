import React from 'react';
import styles from './drawer.module.css';

type NavPage = 'library' | 'character' | 'exports';

export function Drawer({
  isOpen,
  onClose,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: NavPage) => void;
}) {
  return (
    <>
      <div className={styles.backdrop} data-open={isOpen ? '1' : '0'} onClick={onClose} />
      <aside className={styles.drawer} data-open={isOpen ? '1' : '0'}>
        <div className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandTitle}>CastKit Codex</div>
            <div className={styles.brandSubtitle}>TECHNICAL RECORD</div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>

        <nav className={styles.nav}>
          <button className={styles.navItem} onClick={() => onNavigate('library')}>
            Library
          </button>
          <button className={styles.navItem} onClick={() => onNavigate('character')}>
            Character
          </button>
          <button className={styles.navItem} onClick={() => onNavigate('exports')}>
            Exports
          </button>
        </nav>
      </aside>
    </>
  );
}

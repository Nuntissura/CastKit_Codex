import React from 'react';
import styles from './libraryDrawer.module.css';

export function LibraryDrawer({
  isOpen,
  title = 'Library',
  subtitle = 'Notes / Stories / Moodboard',
  onClose,
  children,
}: {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className={styles.backdrop} data-open={isOpen ? '1' : '0'} onClick={onClose} />
      <aside className={styles.drawer} data-open={isOpen ? '1' : '0'}>
        <div className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandTitle}>{title}</div>
            <div className={styles.brandSubtitle}>{subtitle}</div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close library drawer">
            ×
          </button>
        </div>

        <div className={styles.body}>{children}</div>
      </aside>
    </>
  );
}


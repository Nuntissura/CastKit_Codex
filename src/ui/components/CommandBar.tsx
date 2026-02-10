import React from 'react';
import styles from './commandBar.module.css';

export function CommandBar({
  isOpen,
  onToggle,
  label = 'Search / Filters',
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.root} data-open={isOpen ? '1' : '0'}>
      <div className={styles.row}>
        <button className={styles.toggle} onClick={onToggle} title={isOpen ? 'Hide' : 'Show'}>
          {label}
        </button>
        <div className={styles.content} data-open={isOpen ? '1' : '0'}>
          {children}
        </div>
      </div>
    </div>
  );
}

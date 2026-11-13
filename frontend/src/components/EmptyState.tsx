import type { FC, ReactNode } from 'react';

import styles from '../styles/EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export const EmptyState: FC<EmptyStateProps> = ({ title, message, icon, children }) => (
  <div className={styles.emptyState} role="status">
    <div className={styles.icon} aria-hidden="true">
      {icon ?? '📦'}
    </div>
    <h3 className={styles.title}>{title}</h3>
    {message ? <p className={styles.message}>{message}</p> : null}
    {children ? <div className={styles.actions}>{children}</div> : null}
  </div>
);

import type { FC } from 'react';

import styles from '../styles/Pagination.module.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}

function buildPageItems(current: number, total: number): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const items: (number | null)[] = [0];
  if (current > 2) {
    items.push(null);
  }
  for (let p = Math.max(1, current - 1); p <= Math.min(total - 2, current + 1); p += 1) {
    items.push(p);
  }
  if (current < total - 3) {
    items.push(null);
  }
  items.push(total - 1);
  return items;
}

export const Pagination: FC<PaginationProps> = ({
  page,
  totalPages,
  totalElements,
  onPageChange,
  ariaLabel = 'Paginación',
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const disabled = (target: number): boolean =>
    target < 0 || target >= totalPages || target === page;

  const handlePage = (target: number): void => {
    if (!disabled(target)) {
      onPageChange(target);
    }
  };

  return (
    <nav className={styles.pagination} aria-label={ariaLabel}>
      <button
        type="button"
        className={styles.button}
        onClick={() => handlePage(page - 1)}
        disabled={disabled(page - 1)}
        aria-label="Página anterior"
      >
        ← Anterior
      </button>

      <div className={styles.pages}>
        {buildPageItems(page, totalPages).map((item, index) =>
          item === null ? (
            <span key={`ellipsis-${index}`} className={styles.ellipsis} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={`page-${item}`}
              type="button"
              className={item === page ? `${styles.button} ${styles.buttonActive}` : styles.button}
              onClick={() => handlePage(item)}
              disabled={item === page}
              aria-current={item === page ? 'page' : undefined}
            >
              {item + 1}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        className={styles.button}
        onClick={() => handlePage(page + 1)}
        disabled={disabled(page + 1)}
        aria-label="Página siguiente"
      >
        Siguiente →
      </button>

      <span className={styles.summary}>
        {totalElements} {totalElements === 1 ? 'resultado' : 'resultados'}
      </span>
    </nav>
  );
};

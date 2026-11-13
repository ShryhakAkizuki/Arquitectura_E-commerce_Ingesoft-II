import { useEffect, useRef, useState, type FC } from 'react';

import { ApiError } from '../api/client';
import { listProducts } from '../api/products';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { ProductCard } from '../components/ProductCard';
import type { ProductPage } from '../types/product';

import styles from '../styles/CatalogPage.module.css';

const PAGE_SIZE = 10;

const SEARCH_DEBOUNCE_MS = 400;

export const CatalogPage: FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [data, setData] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setError(null);

    listProducts({ page, size: PAGE_SIZE, search: search || undefined })
      .then((result) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setData(result);
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setData(null);
        setError(
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un error inesperado al cargar el catálogo.',
        );
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
      });
  }, [page, search, reloadKey]);

  const handlePageChange = (target: number): void => {
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearSearch = (): void => {
    setSearchInput('');
    setSearch('');
    setPage(0);
  };

  return (
    <section className={styles.catalog}>
      <header className={styles.header}>
        <div>
          <h1>Catálogo</h1>
          <p className={styles.subtitle}>Navegue los productos disponibles en la tienda.</p>
        </div>
        <div className={styles.searchBox}>
          <label htmlFor="catalog-search" className={styles.visuallyHidden}>
            Buscar productos
          </label>
          <input
            id="catalog-search"
            type="search"
            placeholder="Buscar por nombre…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
      </header>

      {loading ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Cargando productos…</span>
        </div>
      ) : error !== null ? (
        <div className={styles.errorState} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      ) : data !== null && data.empty ? (
        <div className={styles.empty}>
          <EmptyState
            icon="🔍"
            title="No se encontraron productos"
            message={
              search !== ''
                ? `Ningún producto coincide con la búsqueda «${search}».`
                : 'Por el momento no hay productos disponibles.'
            }
          >
            {search !== '' ? (
              <button type="button" className={styles.actionButton} onClick={handleClearSearch}>
                Limpiar búsqueda
              </button>
            ) : null}
          </EmptyState>
        </div>
      ) : data !== null ? (
        <div className={styles.results}>
          <div className={styles.grid}>
            {data.content.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className={styles.pagination}>
            <Pagination
              page={data.number}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              onPageChange={handlePageChange}
              ariaLabel="Páginas del catálogo"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
};

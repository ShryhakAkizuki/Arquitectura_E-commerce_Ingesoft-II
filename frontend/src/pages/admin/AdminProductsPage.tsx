import { useEffect, useRef, useState, type FC } from 'react';

import {
  adminAdjustStock,
  adminCreateProduct,
  adminDeactivateProduct,
  adminListProducts,
  adminUpdateProduct,
} from '../../api/admin';
import { ApiError } from '../../api/client';
import { ProductForm } from '../../components/admin/ProductForm';
import { EmptyState } from '../../components/EmptyState';
import { Pagination } from '../../components/Pagination';
import type { AdminProductPage, ProductRequest, ProductResponse } from '../../types/product';

import styles from '../../styles/AdminProductsPage.module.css';

const PAGE_SIZE = 10;

const SEARCH_DEBOUNCE_MS = 400;

const SUCCESS_AUTO_DISMISS_MS = 4000;

type FormMode = 'list' | 'create' | 'edit';

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export const AdminProductsPage: FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [data, setData] = useState<AdminProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [mode, setMode] = useState<FormMode>('list');
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [stockErrors, setStockErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setLoadError(null);

    adminListProducts({ page, size: PAGE_SIZE, search: search || undefined })
      .then((result) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setData(result);
        setStockDrafts({});
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setData(null);
        setLoadError(
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un error inesperado al cargar los productos.',
        );
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
      });
  }, [page, search, reloadKey]);

  useEffect(() => {
    if (success === null) {
      return;
    }
    const timer = window.setTimeout(() => setSuccess(null), SUCCESS_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [success]);

  const reload = (): void => {
    setReloadKey((key) => key + 1);
  };

  const closeForm = (): void => {
    setMode('list');
    setEditingProduct(null);
  };

  const openCreate = (): void => {
    setEditingProduct(null);
    setMode('create');
    setActionError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = (product: ProductResponse): void => {
    setEditingProduct(product);
    setMode('edit');
    setActionError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyProductUpdate = (updated: ProductResponse): void => {
    setData((prev) =>
      prev === null
        ? prev
        : { ...prev, content: prev.content.map((p) => (p.id === updated.id ? updated : p)) },
    );
  };

  const clearStockDraft = (id: string): void => {
    setStockDrafts((prev) => {
      if (!(id in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setStockErrors((prev) => {
      if (prev[id] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleCreate = async (values: ProductRequest): Promise<void> => {
    setFormSubmitting(true);
    setActionError(null);
    setSuccess(null);
    try {
      await adminCreateProduct(values);
      setSuccess(`Producto «${values.name}» creado correctamente.`);
      closeForm();
      reload();
    } catch (err) {
      setActionError(errorMessage(err, 'Ocurrió un error inesperado al crear el producto.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdate = async (values: ProductRequest): Promise<void> => {
    const target = editingProduct;
    if (target === null) {
      return;
    }
    setFormSubmitting(true);
    setActionError(null);
    setSuccess(null);
    try {
      await adminUpdateProduct(target.id, values);
      setSuccess(`Producto «${values.name}» actualizado correctamente.`);
      closeForm();
      clearStockDraft(target.id);
      reload();
    } catch (err) {
      setActionError(errorMessage(err, 'Ocurrió un error inesperado al actualizar el producto.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStockChange = (id: string, value: string): void => {
    setStockDrafts((prev) => ({ ...prev, [id]: value }));
    setStockErrors((prev) => {
      if (prev[id] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveStock = (product: ProductResponse): void => {
    const raw = (stockDrafts[product.id] ?? String(product.stock)).trim();
    const value = Number(raw);
    let fieldError: string | undefined;
    if (!raw) {
      fieldError = 'El stock es obligatorio.';
    } else if (!Number.isInteger(value)) {
      fieldError = 'El stock debe ser un número entero.';
    } else if (value < 0) {
      fieldError = 'El stock no puede ser negativo.';
    }
    if (fieldError !== undefined) {
      setStockErrors((prev) => ({ ...prev, [product.id]: fieldError }));
      return;
    }

    setBusyId(product.id);
    setActionError(null);
    setSuccess(null);
    adminAdjustStock(product.id, { stock: value })
      .then((updated) => {
        applyProductUpdate(updated);
        clearStockDraft(updated.id);
        setSuccess(`Stock de «${updated.name}» actualizado a ${value}.`);
      })
      .catch((err: unknown) => {
        setActionError(errorMessage(err, 'Ocurrió un error inesperado al ajustar el stock.'));
      })
      .finally(() => {
        setBusyId(null);
      });
  };

  const handleDeactivate = (product: ProductResponse): void => {
    const confirmed = window.confirm(
      `¿Desactivar el producto «${product.name}»?\n\n` +
        'Quedará oculto del catálogo público. Esta acción no borra los datos (soft delete).',
    );
    if (!confirmed) {
      return;
    }

    setBusyId(product.id);
    setActionError(null);
    setSuccess(null);
    adminDeactivateProduct(product.id)
      .then((updated) => {
        applyProductUpdate(updated);
        setSuccess(`Producto «${updated.name}» desactivado.`);
      })
      .catch((err: unknown) => {
        setActionError(errorMessage(err, 'Ocurrió un error inesperado al desactivar el producto.'));
      })
      .finally(() => {
        setBusyId(null);
      });
  };

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
    <section className={styles.adminProducts}>
      <header className={styles.header}>
        <div>
          <h1>Productos</h1>
          <p className={styles.subtitle}>
            Gestione el catálogo: cree, edite, ajuste el stock y desactive productos.
          </p>
        </div>
        {mode === 'list' && (
          <div className={styles.headerActions}>
            <div className={styles.searchBox}>
              <label htmlFor="admin-products-search" className={styles.visuallyHidden}>
                Buscar productos
              </label>
              <input
                id="admin-products-search"
                type="search"
                placeholder="Buscar por nombre…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <button type="button" className={styles.newButton} onClick={openCreate}>
              + Nuevo producto
            </button>
          </div>
        )}
      </header>

      {actionError !== null && (
        <p className={styles.alert} role="alert">
          {actionError}
        </p>
      )}

      {success !== null && (
        <p className={styles.success} role="status">
          {success}
        </p>
      )}

      {mode !== 'list' ? (
        <div className={styles.formCard}>
          <h2>{mode === 'create' ? 'Crear producto' : 'Editar producto'}</h2>
          <ProductForm
            key={mode === 'edit' && editingProduct !== null ? `edit-${editingProduct.id}` : 'create'}
            initial={editingProduct}
            submitLabel={mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
            submitting={formSubmitting}
            onSubmit={mode === 'create' ? handleCreate : handleUpdate}
            onCancel={closeForm}
          />
        </div>
      ) : loading ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Cargando productos…</span>
        </div>
      ) : loadError !== null ? (
        <div className={styles.errorState} role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={reload}>
            Reintentar
          </button>
        </div>
      ) : data !== null && data.empty ? (
        <div className={styles.empty}>
          <EmptyState
            icon="📦"
            title="No se encontraron productos"
            message={
              search !== ''
                ? `Ningún producto coincide con la búsqueda «${search}».`
                : 'Aún no hay productos en el catálogo. Cree el primero con el botón «+ Nuevo producto».'
            }
          >
            {search !== '' && (
              <button type="button" className={styles.actionButton} onClick={handleClearSearch}>
                Limpiar búsqueda
              </button>
            )}
          </EmptyState>
        </div>
      ) : data !== null ? (
        <div className={styles.results}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Actualizado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((product) => {
                  const stockDraft = stockDrafts[product.id] ?? String(product.stock);
                  const stockChanged = stockDraft.trim() !== String(product.stock);
                  return (
                    <tr
                      key={product.id}
                      className={product.available ? undefined : styles.rowMuted}
                    >
                      <td>
                        <span className={styles.name}>{product.name}</span>
                        <span className={styles.description}>{product.description}</span>
                      </td>
                      <td className={styles.numeric}>{formatPrice(product.price)}</td>
                      <td>
                        <div className={styles.stockCell}>
                          <input
                            className={styles.stockInput}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            aria-label={`Stock de ${product.name}`}
                            value={stockDraft}
                            onChange={(event) => handleStockChange(product.id, event.target.value)}
                            disabled={busyId !== null}
                          />
                          <button
                            type="button"
                            className={styles.rowButton}
                            onClick={() => handleSaveStock(product)}
                            disabled={busyId !== null || !stockChanged}
                          >
                            Guardar
                          </button>
                          {stockErrors[product.id] !== undefined && (
                            <span className={styles.stockError} role="alert">
                              {stockErrors[product.id]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            product.available ? styles.badgeAvailable : styles.badgeInactive
                          }
                        >
                          {product.available ? 'Disponible' : 'Desactivado'}
                        </span>
                      </td>
                      <td>{formatUpdatedAt(product.updatedAt)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.rowButton}
                            onClick={() => openEdit(product)}
                            disabled={busyId !== null}
                          >
                            Editar
                          </button>
                          {product.available && (
                            <button
                              type="button"
                              className={`${styles.rowButton} ${styles.dangerButton}`}
                              onClick={() => handleDeactivate(product)}
                              disabled={busyId !== null}
                            >
                              Desactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <Pagination
              page={data.number}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              onPageChange={handlePageChange}
              ariaLabel="Páginas de productos del panel admin"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
};

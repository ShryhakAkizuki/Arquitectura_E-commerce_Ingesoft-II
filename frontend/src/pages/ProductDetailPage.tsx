import { useEffect, useRef, useState, type ChangeEvent, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getProduct } from '../api/products';
import { EmptyState } from '../components/EmptyState';
import { ProductCard } from '../components/ProductCard';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import type { ProductResponse } from '../types/product';

import styles from '../styles/ProductDetailPage.module.css';

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const ADD_FEEDBACK_MS = 2000;

function clampQuantity(value: number, max: number): number {
  const upper = Math.max(1, Math.trunc(max));
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(1, Math.trunc(value)), upper);
}

export const ProductDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { add } = useCart();

  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  /** Id del producto mostrado (descarta respuestas de adds obsoletas). */
  const productIdRef = useRef<string | null>(null);
  /** Temporizador del feedback de éxito (reinicable, evita fugas). */
  const addTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (id === undefined) {
      return;
    }
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setNotFound(false);
    setError(null);
    setProduct(null);
    productIdRef.current = null;
    setAdded(false);
    setAddError(null);

    getProduct(id)
      .then((result) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setProduct(result);
        productIdRef.current = result.id;
        setQuantity(1);
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un error inesperado al cargar el producto.',
        );
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
      });
  }, [id, reloadKey]);

  useEffect(() => () => {
    if (addTimerRef.current !== undefined) {
      window.clearTimeout(addTimerRef.current);
    }
  }, []);

  const authenticated = !authLoading && user !== null;
  const outOfStock = product !== null && product.stock <= 0;
  const maxQuantity = product !== null ? Math.max(1, product.stock) : 1;

  const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setQuantity(clampQuantity(event.target.valueAsNumber, maxQuantity));
    setAdded(false);
    setAddError(null);
  };

  const handleAddToCart = async (): Promise<void> => {
    if (product === null || adding || outOfStock) {
      return;
    }
    const targetId = product.id;
    const requestedQuantity = quantity;
    setAdding(true);
    setAddError(null);
    try {
      await add({ productId: targetId, quantity: requestedQuantity });
      if (productIdRef.current !== targetId) {
        return; // El producto cambió durante la petición: descartar respuesta.
      }
      setAdded(true);
      if (addTimerRef.current !== undefined) {
        window.clearTimeout(addTimerRef.current);
      }
      addTimerRef.current = window.setTimeout(() => {
        setAdded(false);
        addTimerRef.current = undefined;
      }, ADD_FEEDBACK_MS);
    } catch (err: unknown) {
      if (productIdRef.current !== targetId) {
        return;
      }
      setAddError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo agregar al carrito. Intente de nuevo.',
      );
    } finally {
      if (productIdRef.current === targetId) {
        setAdding(false);
      }
    }
  };

  if (loading) {
    return (
      <section className={styles.detail}>
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Cargando producto…</span>
        </div>
      </section>
    );
  }

  if (notFound) {
    return (
      <section className={styles.detail}>
        <EmptyState
          icon="📦"
          title="Producto no encontrado"
          message="El producto no existe o ya no está disponible."
        >
          <Link to="/" className={styles.actionButton}>
            Volver al catálogo
          </Link>
        </EmptyState>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section className={styles.detail}>
        <div className={styles.errorState} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (product === null) {
    return null;
  }

  return (
    <section className={styles.detail}>
      <Link to="/" className={styles.backLink}>
        ← Volver al catálogo
      </Link>

      <div className={styles.grid}>
        <ProductCard product={product} />

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Descripción</h2>
          <p className={styles.description}>{product.description}</p>
          <p className={styles.updatedAt}>
            Actualizado el {dateFormatter.format(new Date(product.updatedAt))}
          </p>

          <div className={styles.purchaseBox}>
            <div className={styles.quantityControl}>
              <label htmlFor="detail-quantity">Cantidad</label>
              <input
                id="detail-quantity"
                type="number"
                min={1}
                max={maxQuantity}
                value={quantity}
                disabled={outOfStock}
                onChange={handleQuantityChange}
              />
            </div>

            {authenticated ? (
              <button
                type="button"
                className={`${styles.addButton} ${added ? styles.added : ''}`}
                disabled={adding || outOfStock}
                onClick={() => void handleAddToCart()}
                title={outOfStock ? 'Producto sin stock' : 'Agregar al carrito'}
              >
                {adding ? 'Agregando…' : added ? 'Agregado ✓' : 'Agregar al carrito'}
              </button>
            ) : (
              <Link to="/login" className={styles.loginLink}>
                Iniciar sesión para agregar
              </Link>
            )}

            {addError !== null ? (
              <p className={styles.addError} role="alert">
                {addError}
              </p>
            ) : null}
          </div>

          {outOfStock ? (
            <p className={styles.outOfStockNote}>
              Este producto no tiene stock disponible por el momento.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

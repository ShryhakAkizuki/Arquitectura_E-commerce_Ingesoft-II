import { useEffect, useRef, useState, type FC } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import type { ProductResponse } from '../types/product';

import styles from '../styles/ProductCard.module.css';

const LOW_STOCK_THRESHOLD = 3;

/** Duración del feedback de éxito sobre el botón (ms). */
const ADD_FEEDBACK_MS = 2000;

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

interface ProductCardProps {
  product: ProductResponse;
}

export const ProductCard: FC<ProductCardProps> = ({ product }) => {
  const { user, loading } = useAuth();
  const { add } = useCart();

  const [imageFailed, setImageFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productIdRef = useRef(product.id);
  productIdRef.current = product.id;
  const feedbackTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setAdding(false);
    setAdded(false);
    setError(null);
    return () => {
      if (feedbackTimerRef.current !== undefined) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = undefined;
      }
    };
  }, [product.id]);

  const authenticated = !loading && user !== null;
  const outOfStock = product.stock <= 0;

  const stockBadge = outOfStock ? (
    <span className={`${styles.stock} ${styles.stockOut}`}>Agotado</span>
  ) : product.stock <= LOW_STOCK_THRESHOLD ? (
    <span className={`${styles.stock} ${styles.stockLow}`}>Quedan {product.stock}</span>
  ) : (
    <span className={styles.stock}>En stock</span>
  );

  const handleAddToCart = async (): Promise<void> => {
    const targetId = product.id;
    if (adding || outOfStock) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await add({ productId: targetId, quantity: 1 });
      if (productIdRef.current !== targetId) {
        return; // El producto cambió durante la petición: descartar respuesta.
      }
      setAdded(true);
      if (feedbackTimerRef.current !== undefined) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      feedbackTimerRef.current = window.setTimeout(() => {
        setAdded(false);
        feedbackTimerRef.current = undefined;
      }, ADD_FEEDBACK_MS);
    } catch (err: unknown) {
      if (productIdRef.current !== targetId) {
        return;
      }

      setError(
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

  return (
    <article className={styles.card}>
      <Link to={`/product/${product.id}`} className={styles.media} tabIndex={-1} aria-hidden="true">
        {product.imageUrl && !imageFailed ? (
          <img
            className={styles.image}
            src={product.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className={styles.imagePlaceholder} aria-hidden="true">
            🖥️
          </span>
        )}
      </Link>

      <div className={styles.body}>
        <h3 className={styles.name}>
          <Link to={`/product/${product.id}`}>{product.name}</Link>
        </h3>

        <p className={styles.description}>{product.description}</p>

        <div className={styles.meta}>
          <span className={styles.price}>{formatPrice(product.price)}</span>
          {stockBadge}
        </div>

        <div className={styles.footer}>
          {authenticated ? (
            <>
              <button
                type="button"
                className={`${styles.addButton} ${added ? styles.added : ''}`}
                disabled={adding || outOfStock}
                onClick={() => void handleAddToCart()}
                title={outOfStock ? 'Producto sin stock' : 'Agregar al carrito'}
              >
                {adding ? 'Agregando…' : added ? 'Agregado ✓' : 'Agregar al carrito'}
              </button>

              {error !== null ? (
                <p className={styles.addError} role="alert">
                  {error}
                </p>
              ) : null}
            </>
          ) : (
            <Link to="/login" className={styles.loginLink}>
              Iniciar sesión para agregar
            </Link>
          )}
        </div>
      </div>
    </article>
  );
};

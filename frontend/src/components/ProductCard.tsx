import { useState, type FC } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import type { ProductResponse } from '../types/product';

import styles from '../styles/ProductCard.module.css';

const LOW_STOCK_THRESHOLD = 3;

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

  onAddToCart?: (product: ProductResponse) => void;
}

export const ProductCard: FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const { user, loading } = useAuth();
  const [imageFailed, setImageFailed] = useState(false);

  const authenticated = !loading && user !== null;
  const outOfStock = product.stock <= 0;
  const canAdd = authenticated && !outOfStock && typeof onAddToCart === 'function';

  const stockBadge = outOfStock ? (
    <span className={`${styles.stock} ${styles.stockOut}`}>Agotado</span>
  ) : product.stock <= LOW_STOCK_THRESHOLD ? (
    <span className={`${styles.stock} ${styles.stockLow}`}>Quedan {product.stock}</span>
  ) : (
    <span className={styles.stock}>En stock</span>
  );

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
            <button
              type="button"
              className={styles.addButton}
              disabled={!canAdd}
              onClick={() => onAddToCart?.(product)}
              title={outOfStock ? 'Producto sin stock' : 'Agregar al carrito'}
            >
              Agregar al carrito
            </button>
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

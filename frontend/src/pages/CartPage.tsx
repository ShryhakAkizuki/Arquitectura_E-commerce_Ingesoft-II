import { useState, type FC } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { EmptyState } from '../components/EmptyState';
import { QuantitySelector } from '../components/QuantitySelector';
import { useCart } from '../hooks/useCart';
import type { CartItemResponse } from '../types/cart';

import styles from '../styles/CartPage.module.css';

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

interface ItemError {
  message: string;
}

export const CartPage: FC = () => {
  const { items, subtotal, itemCount, loading, error, update, remove, refresh } = useCart();

  const [itemErrors, setItemErrors] = useState<Record<string, ItemError>>({});
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});

  const markPending = (itemId: string, pending: boolean): void => {
    setPendingIds((current) => ({ ...current, [itemId]: pending }));
  };

  const setItemError = (itemId: string, message: string | null): void => {
    setItemErrors((current) => {
      const next = { ...current };
      if (message === null) {
        delete next[itemId];
      } else {
        next[itemId] = { message };
      }
      return next;
    });
  };

  const handleQuantityChange = (item: CartItemResponse, quantity: number): void => {
    if (quantity === item.quantity) {
      return; // Sin cambio real: no se dispara la petición.
    }
    markPending(item.id, true);
    setItemError(item.id, null);
    update(item.id, { quantity })
      .then(() => {
      })
      .catch((err: unknown) => {
        setItemError(
          item.id,
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un error inesperado al actualizar el carrito.',
        );
      })
      .finally(() => {
        markPending(item.id, false);
      });
  };

  const handleRemove = (item: CartItemResponse): void => {
    markPending(item.id, true);
    setItemError(item.id, null);
    remove(item.id)
      .catch((err: unknown) => {
        setItemError(
          item.id,
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un error inesperado al quitar el ítem.',
        );
      })
      .finally(() => {
        markPending(item.id, false);
      });
  };

  const handleRetryLoad = (): void => {
    refresh();
  };

  return (
    <section className={styles.cart}>
      <header className={styles.header}>
        <div>
          <h1>Mi carrito</h1>
          {itemCount > 0 ? (
            <p className={styles.subtitle}>
              {itemCount} {itemCount === 1 ? 'producto' : 'productos'} en tu carrito.
            </p>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Cargando carrito…</span>
        </div>
      ) : error !== null ? (
        <div className={styles.errorState} role="alert">
          <p>{error}</p>
          <button type="button" onClick={handleRetryLoad}>
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            icon="🛒"
            title="Tu carrito está vacío"
            message="Agrega productos del catálogo para comenzar tu compra."
          >
            <Link to="/" className={styles.actionButton}>
              Explorar catálogo
            </Link>
          </EmptyState>
        </div>
      ) : (
        <div className={styles.layout}>
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={styles.item}>
                <Link to={`/product/${item.productId}`} className={styles.itemMedia} tabIndex={-1}>
                  {item.imageUrl ? (
                    <img className={styles.itemImage} src={item.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className={styles.itemImagePlaceholder} aria-hidden="true">
                      🖥️
                    </span>
                  )}
                </Link>

                <div className={styles.itemBody}>
                  <div className={styles.itemHeaderRow}>
                    <h3 className={styles.itemName}>
                      <Link to={`/product/${item.productId}`}>{item.productName}</Link>
                    </h3>
                    <span className={styles.itemUnitPrice}>{formatPrice(item.unitPrice)} c/u</span>
                  </div>

                  <div className={styles.itemControls}>
                    <QuantitySelector
                      id={`cart-quantity-${item.id}`}
                      label={`Cantidad de ${item.productName}`}
                      value={item.quantity}
                      min={1}
                      busy={Boolean(pendingIds[item.id])}
                      onChange={(quantity) => handleQuantityChange(item, quantity)}
                    />
                    <span className={styles.itemLineTotal}>{formatPrice(item.lineTotal)}</span>
                    <button
                      type="button"
                      className={styles.removeButton}
                      disabled={Boolean(pendingIds[item.id])}
                      onClick={() => handleRemove(item)}
                    >
                      Quitar
                    </button>
                  </div>

                  {itemErrors[item.id] !== undefined ? (
                    <p className={styles.itemError} role="alert">
                      {itemErrors[item.id].message}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <aside className={styles.summary} aria-label="Resumen del pedido">
            <h2 className={styles.summaryTitle}>Resumen</h2>
            <dl className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>Envío</dt>
                <dd className={styles.summaryMuted}>Se calcula al finalizar la compra</dd>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <dt>Total (sin envío)</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
            </dl>

            <Link to="/checkout" className={styles.checkoutButton}>
              Ir a checkout
            </Link>
            <Link to="/" className={styles.continueLink}>
              ← Seguir comprando
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
};

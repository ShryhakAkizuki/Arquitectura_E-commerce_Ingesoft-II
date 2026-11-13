import { useEffect, useRef, useState, type FC } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { myOrders } from '../api/orders';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import type { OrderPage } from '../types/order';

import styles from '../styles/MyOrdersPage.module.css';

const PAGE_SIZE = 10;

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return dateFormatter.format(date);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export const MyOrdersPage: FC = () => {
  const [page, setPage] = useState(0);

  const [data, setData] = useState<OrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setError(null);

    myOrders({ page, size: PAGE_SIZE })
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
        setError(errorMessage(err, 'Ocurrió un error inesperado al cargar tus órdenes.'));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
      });
  }, [page, reloadKey]);

  const handlePageChange = (target: number): void => {
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className={styles.orders}>
      <header className={styles.header}>
        <div>
          <h1>Mis órdenes</h1>
          <p className={styles.subtitle}>
            Consulta el estado y el detalle de tus compras en la tienda.
          </p>
        </div>
      </header>

      {loading ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Cargando tus órdenes…</span>
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
            icon="🧾"
            title="Aún no tienes órdenes"
            message="Cuando realices tu primera compra, aparecerá aquí."
          >
            <Link to="/" className={styles.actionButton}>
              Explorar catálogo
            </Link>
          </EmptyState>
        </div>
      ) : data !== null ? (
        <>
          <ul className={styles.list}>
            {data.content.map((order) => (
              <li key={order.id} className={styles.item}>
                <div className={styles.itemMeta}>
                  <span className={styles.orderNumber}>{order.orderNumber}</span>
                  <span className={styles.orderDate}>{formatDate(order.createdAt)}</span>
                </div>

                <div className={styles.itemItems}>
                  {order.items.map((item) => (
                    <span key={item.productId} className={styles.orderItem}>
                      {item.quantity} × {item.productName}
                    </span>
                  ))}
                </div>

                <div className={styles.itemFooter}>
                  <StatusBadge status={order.status} />
                  <span className={styles.orderTotal}>{formatPrice(order.total)}</span>
                  <Link to={`/orders/${order.id}`} className={styles.detailLink}>
                    Ver detalle →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.pagination}>
            <Pagination
              page={data.number}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              onPageChange={handlePageChange}
              ariaLabel="Paginación de mis órdenes"
            />
          </div>
        </>
      ) : null}
    </section>
  );
};

import { useEffect, useRef, useState, type FC } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { myOrderDetail } from '../api/orders';
import { StatusBadge } from '../components/StatusBadge';
import type { OrderDetailResponse, PaymentStatus } from '../types/order';

import styles from '../styles/OrderDetailPage.module.css';

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

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  FAILED: 'Fallido',
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export const OrderDetailPage: FC = () => {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (id === undefined) {
      setLoading(false);
      return;
    }

    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setError(null);
    setNotFound(false);

    myOrderDetail(id)
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
        setNotFound(err instanceof ApiError && err.code === 'ORDER_NOT_FOUND');
        setError(errorMessage(err, 'Ocurrió un error inesperado al cargar la orden.'));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
      });
  }, [id, reloadKey]);

  const handleRetry = (): void => {
    setReloadKey((key) => key + 1);
  };

  if (id === undefined) {
    return (
      <section className={styles.detail}>
        <div className={styles.errorState} role="alert">
          <p>La ruta de la orden no es válida.</p>
          <Link to="/orders" className={styles.backLink}>
            ← Volver a mis órdenes
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.detail}>
      <Link to="/orders" className={styles.backLink}>
        ← Volver a mis órdenes
      </Link>
      {loading ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Cargando la orden…</span>
        </div>
      ) : error !== null ? (
          <div className={styles.errorState} role="alert">
            <p>{error}</p>
            {notFound ? (
              <Link to="/orders" className={styles.actionButton}>
                Volver a mis órdenes
              </Link>
            ) : (
              <button type="button" onClick={handleRetry}>
                Reintentar
              </button>
            )}
          </div>
        ) : data !== null ? (
          <>
            <div className={styles.titleRow}>
              <div>
                <h1>Orden {data.orderNumber}</h1>
                <p className={styles.subtitle}>
                  Realizada el {formatDate(data.createdAt)}
                </p>
              </div>
              <StatusBadge status={data.status} />
            </div>

            <div className={styles.cards}>
              <section className={styles.card}>
                <h2>Ítems</h2>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col" className={styles.numeric}>
                        Precio unitario
                      </th>
                      <th scope="col" className={styles.numeric}>
                        Cantidad
                      </th>
                      <th scope="col" className={styles.numeric}>
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.productId}>
                        <td>{item.productName}</td>
                        <td className={styles.numeric}>{formatPrice(item.unitPrice)}</td>
                        <td className={styles.numeric}>{item.quantity}</td>
                        <td className={styles.numeric}>{formatPrice(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <dl className={styles.totals}>
                  <div className={styles.totalRow}>
                    <dt>Subtotal</dt>
                    <dd>{formatPrice(data.subtotal)}</dd>
                  </div>
                  <div className={styles.totalRow}>
                    <dt>Envío</dt>
                    <dd>{formatPrice(data.shipping)}</dd>
                  </div>
                  <div className={`${styles.totalRow} ${styles.totalGrand}`}>
                    <dt>Total</dt>
                    <dd>{formatPrice(data.total)}</dd>
                  </div>
                </dl>
              </section>

              <section className={styles.card}>
                <h2>Dirección de envío</h2>
                <p className={styles.address}>{data.shippingAddress}</p>
              </section>

              <section className={styles.card}>
                <h2>Pago</h2>
                {data.payment !== null ? (
                  <dl className={styles.paymentInfo}>
                    <div className={styles.paymentRow}>
                      <dt>Estado</dt>
                      <dd>
                        <span
                          className={
                            data.payment.status === 'CONFIRMED'
                              ? styles.paymentOk
                              : data.payment.status === 'FAILED'
                                ? styles.paymentFailed
                                : styles.paymentPending
                          }
                        >
                          {PAYMENT_STATUS_LABELS[data.payment.status]}
                        </span>
                      </dd>
                    </div>
                    <div className={styles.paymentRow}>
                      <dt>Método</dt>
                      <dd>{data.payment.method}</dd>
                    </div>
                    <div className={styles.paymentRow}>
                      <dt>Transacción</dt>
                      <dd>{data.payment.transactionId ?? '—'}</dd>
                    </div>
                    <div className={styles.paymentRow}>
                      <dt>Procesado</dt>
                      <dd>{formatDate(data.payment.processedAt)}</dd>
                    </div>
                    {data.payment.failureReason !== null ? (
                      <div className={styles.paymentRow}>
                        <dt>Motivo de rechazo</dt>
                        <dd className={styles.paymentFailed}>
                          {data.payment.failureReason}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className={styles.address}>Sin registro de pago todavía.</p>
                )}
              </section>
            </div>
          </>
        ) : null}
    </section>
  );
};

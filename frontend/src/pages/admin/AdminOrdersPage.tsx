import { useEffect, useRef, useState, type FC } from 'react';

import { adminListOrders, adminUpdateOrderStatus } from '../../api/admin';
import { ApiError } from '../../api/client';
import { EmptyState } from '../../components/EmptyState';
import { Pagination } from '../../components/Pagination';
import { StatusBadge } from '../../components/StatusBadge';
import type { AdminOrderPage, OrderResponse, OrderStatus } from '../../types/order';

import styles from '../../styles/AdminOrdersPage.module.css';

const PAGE_SIZE = 10;

const SUCCESS_AUTO_DISMISS_MS = 4000;

type StatusFilter = OrderStatus | 'ALL';

const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente de pago' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'SHIPPED', label: 'Enviada' },
  { value: 'DELIVERED', label: 'Entregada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

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

function formatItems(order: OrderResponse): string {
  return order.items.map((item) => `${item.quantity} × ${item.productName}`).join(', ');
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

interface TransitionAction {
  to: OrderStatus;
  label: string;
  confirmMessage: string;
  successMessage: string;
  danger: boolean;
}

/**
 * Transiciones válidas según la máquina de estados de la orden (§3.1):
 * PENDING → CANCELLED; PAID → SHIPPED | CANCELLED; SHIPPED → DELIVERED.
 * El stock solo se restituye en PAID → CANCELLED.
 */
function getActions(order: OrderResponse): TransitionAction[] {
  switch (order.status) {
    case 'PENDING':
      return [
        {
          to: 'CANCELLED',
          label: 'Cancelar',
          danger: true,
          confirmMessage: `¿Cancelar la orden ${order.orderNumber}? Esta acción no se puede deshacer.`,
          successMessage: `La orden ${order.orderNumber} fue cancelada.`,
        },
      ];
    case 'PAID':
      return [
        {
          to: 'SHIPPED',
          label: 'Enviar',
          danger: false,
          confirmMessage: `¿Marcar la orden ${order.orderNumber} como enviada?`,
          successMessage: `La orden ${order.orderNumber} fue marcada como enviada.`,
        },
        {
          to: 'CANCELLED',
          label: 'Cancelar',
          danger: true,
          confirmMessage: `¿Cancelar la orden ${order.orderNumber}? El stock de sus productos será restituido.`,
          successMessage: `La orden ${order.orderNumber} fue cancelada y el stock restituido.`,
        },
      ];
    case 'SHIPPED':
      return [
        {
          to: 'DELIVERED',
          label: 'Entregar',
          danger: false,
          confirmMessage: `¿Confirmar la entrega de la orden ${order.orderNumber}?`,
          successMessage: `La orden ${order.orderNumber} fue marcada como entregada.`,
        },
      ];
    default:
      return [];
  }
}

export const AdminOrdersPage: FC = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(0);

  const [data, setData] = useState<AdminOrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setLoadError(null);

    adminListOrders({
      page,
      size: PAGE_SIZE,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    })
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
        setLoadError(errorMessage(err, 'Ocurrió un error inesperado al cargar las órdenes.'));
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
      });
  }, [page, statusFilter, reloadKey]);

  useEffect(() => {
    if (success === null) {
      return;
    }
    const timer = window.setTimeout(() => setSuccess(null), SUCCESS_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [success]);

  const handlePageChange = (target: number): void => {
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (value: string): void => {
    setStatusFilter(value as StatusFilter);
    setPage(0);
  };

  const handleTransition = (order: OrderResponse, action: TransitionAction): void => {
    if (busyId !== null) {
      return;
    }
    if (!window.confirm(action.confirmMessage)) {
      return;
    }

    setBusyId(order.id);
    setActionError(null);
    setSuccess(null);

    adminUpdateOrderStatus(order.id, { status: action.to })
      .then((updated) => {
        setData((prev) =>
          prev === null
            ? prev
            : {
                ...prev,
                content: prev.content.map((item) =>
                  item.id === updated.id ? { ...item, status: updated.status } : item,
                ),
              },
        );
        setSuccess(action.successMessage);
      })
      .catch((err: unknown) => {
        setActionError(errorMessage(err, 'No fue posible actualizar el estado de la orden.'));
      })
      .finally(() => {
        setBusyId(null);
      });
  };

  return (
    <section className={styles.adminOrders}>
      <header className={styles.header}>
        <div>
          <h1>Órdenes</h1>
          <p className={styles.subtitle}>
            Gestiona el estado de las órdenes: enviar, entregar o cancelar.
          </p>
        </div>
        <div className={styles.filterBox}>
          <label htmlFor="status-filter">Filtrar por estado</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => handleFilterChange(event.target.value)}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {actionError !== null ? (
        <p className={styles.alert} role="alert">
          {actionError}
        </p>
      ) : null}
      {success !== null ? (
        <p className={styles.success} role="status">
          {success}
        </p>
      ) : null}

      {loading ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Cargando órdenes…</span>
        </div>
      ) : loadError !== null ? (
        <div className={styles.errorState} role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Reintentar
          </button>
        </div>
      ) : data !== null && data.empty ? (
        <div className={styles.empty}>
          <EmptyState
            icon="🧾"
            title={statusFilter === 'ALL' ? 'No hay órdenes' : 'Sin órdenes en este estado'}
            message={
              statusFilter === 'ALL'
                ? 'Cuando los clientes realicen compras, aparecerán aquí.'
                : 'Prueba con otro filtro de estado.'
            }
          />
        </div>
      ) : data !== null ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((order) => {
                  const actions = getActions(order);
                  return (
                    <tr key={order.id}>
                      <td>
                        <span className={styles.orderNumber}>{order.orderNumber}</span>
                        <span className={styles.orderDate}>{formatDate(order.createdAt)}</span>
                      </td>
                      <td>
                        <span className={styles.itemsCell} title={formatItems(order)}>
                          {formatItems(order)}
                        </span>
                      </td>
                      <td className={styles.numeric}>{formatPrice(order.total)}</td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td>
                        {actions.length > 0 ? (
                          <div className={styles.rowActions}>
                            {actions.map((action) => (
                              <button
                                key={action.to}
                                type="button"
                                className={
                                  action.danger
                                    ? `${styles.rowButton} ${styles.dangerButton}`
                                    : styles.rowButton
                                }
                                disabled={busyId !== null}
                                onClick={() => handleTransition(order, action)}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className={styles.noActions}>—</span>
                        )}
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
              ariaLabel="Paginación de órdenes"
            />
          </div>
        </>
      ) : null}
    </section>
  );
};

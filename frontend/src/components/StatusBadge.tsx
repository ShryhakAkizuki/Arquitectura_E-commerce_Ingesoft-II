import type { FC } from 'react';

import type { OrderStatus } from '../types/order';

import styles from '../styles/StatusBadge.module.css';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendiente de pago',
  PAID: 'Pagada',
  SHIPPED: 'Enviada',
  DELIVERED: 'Entregada',
  CANCELLED: 'Cancelada',
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING: styles.statusPending,
  PAID: styles.statusPaid,
  SHIPPED: styles.statusShipped,
  DELIVERED: styles.statusDelivered,
  CANCELLED: styles.statusCancelled,
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export const StatusBadge: FC<StatusBadgeProps> = ({ status }) => (
  <span className={`${styles.badge} ${STATUS_CLASSES[status]}`} title={STATUS_LABELS[status]}>
    {STATUS_LABELS[status]}
  </span>
);

import type { Page, PageParams } from './api';

/** Estados de la orden y transiciones válidas. */
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

/** Estados del pago (enums/PaymentStatus.java). */
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

/** Datos de pago enviados al checkout (dto/request/PaymentData.java). */
export interface PaymentData {
  method: string;
  cardNumber: string;
  cardholderName?: string | null;
}

/** Finalizar compra (POST /api/checkout). */
export interface CheckoutRequest {
  shippingAddress: string;
  payment: PaymentData;
}

/** Ítem de una orden; denormaliza nombre y precio (decisión §3). */
export interface OrderItemResponse {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** Orden devuelta al finalizar el checkout (dto/response/OrderResponse.java). */
export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
  shippingAddress: string;
  createdAt: string;
  items: OrderItemResponse[];
}

/** Estado del pago asociado a una orden (PaymentResponse de OrderDetailResponse). */
export interface OrderPaymentResponse {
  status: PaymentStatus;
  method: string;
  transactionId: string | null;
  failureReason: string | null;
  processedAt: string;
}

/**
 * Detalle de la orden para su propietario
 */
export interface OrderDetailResponse extends Omit<OrderResponse, 'items'> {
  items: OrderItemResponse[];
  payment: OrderPaymentResponse | null;
}

/** Cambiar estado de una orden (PATCH /api/admin/orders/{id}/status). */
export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

/** Respuesta paginada de `GET /api/orders/mine`. */
export type OrderPage = Page<OrderResponse>;

/** Filtro de la vista admin de órdenes (GET /api/admin/orders). */
export interface AdminOrderListParams extends PageParams {
  status?: OrderStatus;
}

/** Respuesta paginada de `GET /api/admin/orders`. */
export type AdminOrderPage = Page<OrderResponse>;

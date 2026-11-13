import { client } from './client';

import type {
  AdminOrderListParams,
  AdminOrderPage,
  OrderDetailResponse,
  UpdateOrderStatusRequest,
} from '../types/order';
import type {
  AdjustStockRequest,
  AdminProductPage,
  ProductRequest,
  ProductResponse,
  ProductSearchParams,
} from '../types/product';

/** Listado de productos del admin: incluye desactivados (paginado). */
export async function adminListProducts(params: ProductSearchParams = {}): Promise<AdminProductPage> {
  const { data } = await client.get<AdminProductPage>('/admin/products', { params });
  return data;
}

/** Crea un producto (201). Validaciones de precio/stock en el backend. */
export async function adminCreateProduct(request: ProductRequest): Promise<ProductResponse> {
  const { data } = await client.post<ProductResponse>('/admin/products', request);
  return data;
}

/** Actualiza un producto existente (404 `PRODUCT_NOT_FOUND` si no existe). */
export async function adminUpdateProduct(id: string, request: ProductRequest): Promise<ProductResponse> {
  const { data } = await client.put<ProductResponse>(`/admin/products/${id}`, request);
  return data;
}

/** Desactiva un producto (soft delete: `available = false`). */
export async function adminDeactivateProduct(id: string): Promise<ProductResponse> {
  const { data } = await client.delete<ProductResponse>(`/admin/products/${id}`);
  return data;
}

/** Ajuste absoluto de stock (≥ 0). */
export async function adminAdjustStock(id: string, request: AdjustStockRequest): Promise<ProductResponse> {
  const { data } = await client.patch<ProductResponse>(`/admin/products/${id}/stock`, request);
  return data;
}

/** Órdenes del admin, con filtro opcional por estado (paginado). */
export async function adminListOrders(params: AdminOrderListParams = {}): Promise<AdminOrderPage> {
  const { data } = await client.get<AdminOrderPage>('/admin/orders', { params });
  return data;
}

/** Detalle de una orden (ítems + estado del pago). 404 `ORDER_NOT_FOUND` si no existe. */
export async function adminOrderDetail(id: string): Promise<OrderDetailResponse> {
  const { data } = await client.get<OrderDetailResponse>(`/admin/orders/${id}`);
  return data;
}

/**
 * Avanza el estado de una orden según las transiciones válidas
 */
export async function adminUpdateOrderStatus(
  id: string,
  request: UpdateOrderStatusRequest,
): Promise<OrderDetailResponse> {
  const { data } = await client.patch<OrderDetailResponse>(`/admin/orders/${id}/status`, request);
  return data;
}

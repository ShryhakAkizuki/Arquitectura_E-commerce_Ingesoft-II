import { client } from './client';

import type { PageParams } from '../types/api';
import type { OrderDetailResponse, OrderPage } from '../types/order';

/**
 * Órdenes del usuario autenticado, paginadas.
 * Solo devuelve las órdenes propias (el backend filtra por el token).
 */
export async function myOrders(params: PageParams = {}): Promise<OrderPage> {
  const { data } = await client.get<OrderPage>('/orders/mine', { params });
  return data;
}

/**
 * Detalle de una orden propia: ítems, totales, dirección, estados.
 * 404 `ORDER_NOT_FOUND` si no existe o no es del usuario autenticado.
 */
export async function myOrderDetail(id: string): Promise<OrderDetailResponse> {
  const { data } = await client.get<OrderDetailResponse>(`/orders/mine/${id}`);
  return data;
}

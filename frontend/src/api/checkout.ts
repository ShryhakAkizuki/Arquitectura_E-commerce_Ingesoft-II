import { client } from './client';

import type { CheckoutRequest, OrderResponse } from '../types/order';

/**
 * Finaliza la compra del carrito del usuario autenticado.
 * El backend valida stock bajo bloqueo de fila, crea la orden y procesa el pago.
 */
export async function checkout(request: CheckoutRequest): Promise<OrderResponse> {
  const { data } = await client.post<OrderResponse>('/checkout', request);
  return data;
}

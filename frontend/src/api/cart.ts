import { client } from './client';

import type { AddCartItemRequest, CartResponse, UpdateCartItemRequest } from '../types/cart';

/** Carrito del usuario autenticado (se crea vacío si no existe). */
export async function getCart(): Promise<CartResponse> {
  const { data } = await client.get<CartResponse>('/cart');
  return data;
}

/**
 * Agrega un producto al carrito (suma cantidades si ya estaba).
 * 409 `INSUFFICIENT_STOCK` si cantidad solicitada + existente > stock.
 */
export async function addCartItem(request: AddCartItemRequest): Promise<CartResponse> {
  const { data } = await client.post<CartResponse>('/cart/items', request);
  return data;
}

/** Cambia la cantidad de un ítem; misma validación de stock que {@link addCartItem}. */
export async function updateCartItem(itemId: string, request: UpdateCartItemRequest): Promise<CartResponse> {
  const { data } = await client.patch<CartResponse>(`/cart/items/${itemId}`, request);
  return data;
}

/** Elimina un ítem del carrito. */
export async function removeCartItem(itemId: string): Promise<CartResponse> {
  const { data } = await client.delete<CartResponse>(`/cart/items/${itemId}`);
  return data;
}

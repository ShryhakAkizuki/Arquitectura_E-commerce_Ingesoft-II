/** Ítem del carrito (dto/response/CartItemResponse.java). */
export interface CartItemResponse {
  /** Id del ítem de carrito (se usa en PATCH/DELETE). */
  id: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** Carrito completo del usuario (dto/response/CartResponse.java). */
export interface CartResponse {
  id: string;
  items: CartItemResponse[];
  subtotal: number;
}

/** Agregar producto al carrito (POST /api/cart/items). */
export interface AddCartItemRequest {
  productId: string;
  quantity: number;
}

/** Cambiar cantidad de un ítem (PATCH /api/cart/items/{itemId}). */
export interface UpdateCartItemRequest {
  quantity: number;
}

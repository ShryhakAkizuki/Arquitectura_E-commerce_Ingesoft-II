import { client } from './client';

import type { ProductPage, ProductResponse, ProductSearchParams } from '../types/product';

/**
 * Catálogo paginado (público): solo productos `available`.
 * `page`/`size`/`search`/`sort` según el contrato de `GET /api/products`.
 */
export async function listProducts(params: ProductSearchParams = {}): Promise<ProductPage> {
  const { data } = await client.get<ProductPage>('/products', { params });
  return data;
}

/**
 * Detalle de un producto (público).
 * 404 `PRODUCT_NOT_FOUND` si no existe o está desactivado.
 */
export async function getProduct(id: string): Promise<ProductResponse> {
  const { data } = await client.get<ProductResponse>(`/products/${id}`);
  return data;
}

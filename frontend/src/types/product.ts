import type { Page, PageParams } from './api';

/** Vista de producto del catálogo (dto/response/ProductResponse.java). */
export interface ProductResponse {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  available: boolean;
  updatedAt: string;
}

/**
 * Crear (POST) o actualizar (PUT) un producto — uso admin
 * (dto/request/ProductRequest.java).
 */
export interface ProductRequest {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
}

/** Ajuste absoluto de stock (PATCH /api/admin/products/{id}/stock). */
export interface AdjustStockRequest {
  stock: number;
}

/** Parámetros de la búsqueda del catálogo público (GET /api/products). */
export interface ProductSearchParams extends PageParams {
  search?: string;
  sort?: string;
}

/** Respuesta paginada de `GET /api/products`. */
export type ProductPage = Page<ProductResponse>;

/** Respuesta paginada de `GET /api/admin/products`. */
export type AdminProductPage = Page<ProductResponse>;

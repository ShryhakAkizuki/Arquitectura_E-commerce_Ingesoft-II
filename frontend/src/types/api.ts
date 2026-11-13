/** Formato de error estándar de todo el backend. */
export interface ApiError {
  /** Código HTTP (400, 401, 402, 403, 404, 409, 500...). */
  status: number;
  /** Código de negocio del error (ver {@link ErrorCode}). */
  code: string;
  /** Mensaje textual, pensado para mostrarse tal cual en la UI. */
  message: string;
  /** Instante ISO-8601 en que se generó el error. */
  timestamp: string;
}

/** Códigos de negocio del backend (exception/ErrorCode.java). */
export type ErrorCode =
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'PRODUCT_NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'CART_EMPTY'
  | 'PAYMENT_DECLINED'
  | 'ORDER_NOT_FOUND'
  | 'FORBIDDEN'
  | 'ORDER_STATUS_INVALID'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

/** `Sort` de Spring Data (serializado dentro de `Page`). */
export interface PageSort {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

/** `Pageable` de Spring Data (serializado dentro de `Page`). */
export interface Pageable {
  pageNumber: number;
  pageSize: number;
  sort: PageSort;
  offset: number;
  paged: boolean;
  unpaged: boolean;
}


export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
  sort: PageSort;
  pageable: Pageable;
}

/** Parámetros comunes de los endpoints paginados del backend. */
export interface PageParams {
  /** Página, 0-indexed (default 0 en el backend). */
  page?: number;
  /** Tamaño de página (default definido por el backend). */
  size?: number;
}

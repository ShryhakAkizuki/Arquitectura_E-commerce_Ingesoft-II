import axios, { AxiosError, type AxiosInstance } from 'axios';

import type { ApiError as ApiErrorShape } from '../types/api';

/** Clave de localStorage donde `AuthContext` persiste el JWT. */
export const TOKEN_STORAGE_KEY = 'shop_token';

/**
 * Error tipado que toda la UI puede capturar.
 *
 * Espejo de `exception/ApiError.java`: expone `code` y `message` listos
 * para mostrarse textualmente en pantalla.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly timestamp: string;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.status = shape.status;
    this.code = shape.code;
    this.timestamp = shape.timestamp;
  }
}

/**
 * Instancia única de Axios.
 * `VITE_API_URL` se define en `frontend/.env.local` con default local.
 */
export const client: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
});

/** Lee el JWT de localStorage (`null` si no hay sesión). */
export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Borra el JWT de localStorage. */
export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage no disponible (modo privado/SSR): no hay nada que limpiar.
  }
}

/**
 * Interceptor de request: inyecta el token de sesión.
 * Si no hay token, la petición sigue sin header.
 */
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Verifica si un cuerpo de respuesta tiene la forma exacta de `ApiError`. */
function isApiErrorShape(data: unknown): data is ApiErrorShape {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.status === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.timestamp === 'string'
  );
}

/**
 * Normaliza el cuerpo de error del backend a {@link ApiError}.
 */
function normalizeApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;

  if (error.response && isApiErrorShape(error.response.data)) {
    return new ApiError(error.response.data);
  }

  if (status === 401) {
    // Sin token válido (backend: `UNAUTHORIZED` en `AuthenticationException`).
    return new ApiError({
      status,
      code: 'UNAUTHORIZED',
      message: 'Sesión no válida. Inicie sesión para continuar.',
      timestamp: new Date().toISOString(),
    });
  }

  if (status === 403) {
    // Sin token válido (backend: `FORBIDDEN` en `AccessDeniedException`).
    return new ApiError({
      status,
      code: 'FORBIDDEN',
      message: 'Acceso denegado: no tiene permisos para esta acción.',
      timestamp: new Date().toISOString(),
    });
  }

  if (!error.response) {
    // Sin respuesta (red caída, CORS, timeout, backend abajo).
    return new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'No se pudo conectar con el servidor. Verifique su conexión.',
      timestamp: new Date().toISOString(),
    });
  }

  return new ApiError({
    status,
    code: 'INTERNAL_ERROR',
    message: `Error inesperado del servidor (HTTP ${status}).`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Interceptor de response
 */
client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(
        new ApiError({
          status: 0,
          code: 'INTERNAL_ERROR',
          message: 'Ocurrió un error inesperado en la aplicación.',
          timestamp: new Date().toISOString(),
        }),
      );
    }

    const isLoginCall =
      error.config?.method === 'post' && error.config?.url === '/auth/login';
    if (error.response?.status === 401 && !isLoginCall) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(normalizeApiError(error));
  },
);

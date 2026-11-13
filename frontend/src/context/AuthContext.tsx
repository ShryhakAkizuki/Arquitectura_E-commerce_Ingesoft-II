/**
 * F-0.4 — AuthContext: sesión global (JWT + perfil) (§7.2 de arquitectura.md).
 *
 * Única fuente de verdad de la sesión en el frontend (DRY, §8):
 * - Persiste el JWT (clave `TOKEN_STORAGE_KEY` de `api/client.ts`) y el perfil
 *   en localStorage.
 * - Al montar: si hay token, lo valida con `GET /users/me`; ante 401 limpia la
 *   sesión (el interceptor de `api/client.ts` además redirige a `/login`).
 * - Expone `user`, `loading`, `login` y `logout` (consumo vía `useAuth`, F-0.4).
 *
 * El perfil cacheado permite pintar la UI sin esperar la red; el resultado de
 * `GET /users/me` siempre prevalece porque es el perfil vigente en el backend.
 */
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';

import { getMe, login as loginApi } from '../api/auth';
import { ApiError, TOKEN_STORAGE_KEY, clearToken, getToken } from '../api/client';
import type { LoginRequest, LoginResponse, UserResponse } from '../types/auth';

/** Clave de localStorage donde se cachea el perfil del usuario. */
export const PROFILE_STORAGE_KEY = 'shop_profile';

/** Sesión global expuesta por el proveedor. */
export interface AuthContextValue {
  /** Perfil del usuario autenticado; `null` si no hay sesión. */
  user: UserResponse | null;
  /** `true` mientras se valida el token persistido al montar (`GET /users/me`). */
  loading: boolean;
  /** Inicia sesión (`POST /auth/login`) y persiste JWT + perfil. */
  login: (request: LoginRequest) => Promise<LoginResponse>;
  /** Cierra la sesión: limpia JWT, perfil cacheado y estado en memoria. */
  logout: () => void;
}

/**
 * Contexto interno; el acceso público es siempre vía `useAuth` (hooks/useAuth.ts).
 * Contexto y proveedor viven juntos (patrón estándar de React).
 */
// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

/** Guarda el JWT (misma clave que inyecta el interceptor de `api/client.ts`). */
function storeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage no disponible (modo privado): la sesión vive solo en memoria.
  }
}

/** Guarda el perfil cacheado (pintura instantánea; el backend prevalece). */
function storeProfile(profile: UserResponse): void {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Sin persistencia no pasa nada: el estado en memoria sigue vigente.
  }
}

/** Borra el perfil cacheado. */
function removeStoredProfile(): void {
  try {
    window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
}

/** Verifica que un valor cacheado tenga la forma de `UserResponse` (anti-corrupción). */
function isUserResponse(value: unknown): value is UserResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string' &&
    (candidate.role === 'USER' || candidate.role === 'ADMIN')
  );
}

/** Lee el perfil cacheado; `null` si no existe o está corrupto. */
function readStoredProfile(): UserResponse | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isUserResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Proveedor de la sesión global (se monta en `src/main.tsx`).
 * Consume la capa de datos única (`api/auth.ts`), nunca Axios directamente.
 */
export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);


  useEffect(() => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Pintura inicial con el perfil cacheado (si existe) mientras se valida.
    setUser(readStoredProfile());

    let cancelled = false;
    getMe()
      .then((fresh) => {
        if (cancelled) {
          return;
        }
        setUser(fresh);
        storeProfile(fresh);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          clearToken();
          removeStoredProfile();
          setUser(null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Inicia sesión y persiste la nueva sesión (JWT + perfil). */
  const login = useCallback(async (request: LoginRequest): Promise<LoginResponse> => {
    const response = await loginApi(request);
    storeToken(response.token);
    storeProfile(response.user);
    setUser(response.user);
    return response;
  }, []);

  /** Cierra la sesión: limpia persistencia y estado en memoria. */
  const logout = useCallback(() => {
    clearToken();
    removeStoredProfile();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

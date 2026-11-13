import type { FC, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  /** Ruta protegida a renderizar si existe sesión válida. */
  children: ReactNode;
}

/** Estado de carga mientras se valida el token persistido (`GET /users/me`). */
const SessionLoading: FC = () => (
  <main className="page" aria-busy="true">
    <p>Cargando sesión…</p>
  </main>
);

/**
 * Protege rutas que requieren sesión (carrito, checkout, perfil, órdenes)..
 */
export const ProtectedRoute: FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <SessionLoading />;
  }

  if (user === null) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
};

import type { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { ProtectedRoute } from './ProtectedRoute';

interface AdminRouteProps {
  /** Ruta admin a renderizar si la sesión tiene rol `ADMIN`. */
  children: ReactNode;
}

/** Pantalla 403 para sesiones autenticadas sin rol ADMIN (denegación explícita). */
const AccessDenied: FC = () => (
  <main className="page" role="alert">
    <h1>403 — Acceso denegado</h1>
    <p className="page__description">
      Esta sección es exclusiva para administradores. Inicie sesión con una
      cuenta de administrador para continuar.
    </p>
    <p>
      <Link to="/">Volver al catálogo</Link>
    </p>
  </main>
);

/**
 * Protege rutas admin: exige sesión válida Y rol `ADMIN`.
 */
export const AdminRoute: FC<AdminRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    // Misma semántica que ProtectedRoute: no decidir la navegación hasta
    // validar el token persistido (evita destello de 403 en admins).
    return <ProtectedRoute>{children}</ProtectedRoute>;
  }

  if (user !== null && user.role !== 'ADMIN') {
    return <AccessDenied />;
  }

  // user === null → ProtectedRoute redirige a /login; ADMIN → renderiza.
  return <ProtectedRoute>{children}</ProtectedRoute>;
};

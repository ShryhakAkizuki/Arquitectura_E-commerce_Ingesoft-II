import { useEffect, useState, type FC } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { getCart } from '../api/cart';
import { useAuth } from '../hooks/useAuth';

import styles from '../styles/Navbar.module.css';

/** Clase del NavLink según estado activo/inactivo (evita duplicar estilos). */
function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.link} ${styles.linkActive}` : styles.link;
}

export const Navbar: FC = () => {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState<number | null>(null);

  // `loading` → no pintar ninguna
  // rama de sesión: evita el "destello" de enlaces equivocados al recargar.
  const authenticated = !loading && user !== null;
  const anonymous = !loading && user === null;

  useEffect(() => {
    if (!authenticated) {
      setCartCount(null);
      return;
    }
    let cancelled = false;
    getCart()
      .then((cart) => {
        if (!cancelled) {
          setCartCount(cart.items.reduce((sum, item) => sum + item.quantity, 0));
        }
      })
      .catch(() => {
        // Backend caído o sesión inválida: la insignia se oculta, sin bloquear la UI.
        if (!cancelled) {
          setCartCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated, location.pathname]);

  /** Cierra la sesión y vuelve al catálogo (pública). */
  const handleLogout = (): void => {
    logout();
    navigate('/');
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          IngShop
        </Link>

        <nav className={styles.nav} aria-label="Navegación principal">
          <NavLink to="/" end className={navLinkClass}>
            Catálogo
          </NavLink>
          {authenticated && (
            <>
              <NavLink to="/cart" className={navLinkClass}>
                Carrito
                {cartCount !== null && cartCount > 0 && (
                  <span className={styles.badge} aria-hidden="true">
                    {cartCount}
                  </span>
                )}
              </NavLink>
              <NavLink to="/orders" className={navLinkClass}>
                Mis órdenes
              </NavLink>
              <NavLink to="/profile" className={navLinkClass}>
                Perfil
              </NavLink>
              {user.role === 'ADMIN' && (
                <NavLink to="/admin/products" className={navLinkClass}>
                  Panel admin
                </NavLink>
              )}
            </>
          )}
        </nav>

        {authenticated && (
          <div className={styles.session}>
            <button type="button" className={styles.logout} onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        )}

        {anonymous && (
          <div className={styles.guest}>
            <NavLink to="/login" className={navLinkClass}>
              Iniciar sesión
            </NavLink>
            <Link to="/register" className={styles.register}>
              Registrarse
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

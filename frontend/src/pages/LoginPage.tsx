import { useState, type FC, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';

import styles from '../styles/LoginPage.module.css';

/** Validación simple de email en cliente. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginFormState {
  email: string;
  password: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMPTY_FORM: LoginFormState = { email: '', password: '' };

/** Valida el formulario en cliente y devuelve los errores por campo. */
function validate(form: LoginFormState): FieldErrors {
  const errors: FieldErrors = {};
  const email = form.email.trim();
  if (!email) {
    errors.email = 'El email es obligatorio.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'El email no tiene un formato válido.';
  }
  if (!form.password) {
    errors.password = 'La contraseña es obligatoria.';
  }
  return errors;
}

/** Destino según rol tras un login exitoso. */
function homeForRole(role: 'USER' | 'ADMIN'): string {
  return role === 'ADMIN' ? '/admin/products' : '/';
}

export const LoginPage: FC = () => {
  const navigate = useNavigate();
  const { user, loading, login } = useAuth();

  const [form, setForm] = useState<LoginFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ya autenticado: la página redirige a la home correspondiente al rol.
  if (!loading && user !== null) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    setServerError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await login({ email: form.email.trim(), password: form.password });
      navigate(homeForRole(response.user.role), { replace: true });
    } catch (error) {
      // El mensaje del backend se muestra tal cual.
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'Ocurrió un error inesperado. Inténtelo de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.loginPage}>
      <div className={styles.card}>
        <h1>Iniciar sesión</h1>
        <p className={styles.subtitle}>
          Acceda a su cuenta para comprar y gestionar sus órdenes.
        </p>

        {serverError !== null && (
          <p className={styles.alert} role="alert">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              aria-invalid={fieldErrors.email !== undefined}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              placeholder="usuario@ejemplo.com"
            />
            {fieldErrors.email !== undefined && (
              <span className={styles.fieldError} id="login-email-error">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              aria-invalid={fieldErrors.password !== undefined}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              placeholder="••••••••"
            />
            {fieldErrors.password !== undefined && (
              <span className={styles.fieldError} id="login-password-error">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Iniciando sesión…' : 'Ingresar'}
          </button>
        </form>

        <p className={styles.registerHint}>
          ¿No tiene cuenta? <Link to="/register">Regístrese aquí</Link>
        </p>

        <div className={styles.demoBox}>
          <p className={styles.demoTitle}>Cuentas demo (seed):</p>
          <p>
            Administrador: <code>admin@demo.com</code> / <code>Admin123!</code>
          </p>
          <p>
            Usuario: <code>user@demo.com</code> / <code>User123!</code>
          </p>
        </div>
      </div>
    </section>
  );
};

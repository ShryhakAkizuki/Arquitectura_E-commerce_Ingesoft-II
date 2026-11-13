import { useState, type FC, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { register } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';

import styles from '../styles/RegisterPage.module.css';

/** Validación simple de email en cliente. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Límites espejo del `RegisterRequest` del backend (Bean Validation). */
const NAME_MAX = 100;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

interface RegisterFormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMPTY_FORM: RegisterFormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

/** Valida el formulario en cliente y devuelve los errores por campo. */
function validate(form: RegisterFormState): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  if (!name) {
    errors.name = 'El nombre es obligatorio.';
  } else if (name.length > NAME_MAX) {
    errors.name = `El nombre no puede exceder los ${NAME_MAX} caracteres.`;
  }
  if (!email) {
    errors.email = 'El email es obligatorio.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'El email no tiene un formato válido.';
  }
  if (!form.password) {
    errors.password = 'La contraseña es obligatoria.';
  } else if (
    form.password.length < PASSWORD_MIN ||
    form.password.length > PASSWORD_MAX
  ) {
    errors.password = `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`;
  }
  if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }
  return errors;
}

export const RegisterPage: FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [form, setForm] = useState<RegisterFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ya autenticado: la página redirige (el registro no aplica a una sesión).
  if (!loading && user !== null) {
    return <Navigate to="/" replace />;
  }

  const setField = (field: keyof RegisterFormState, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
      // R1: POST /api/auth/register (201); email repetido → 409
      // EMAIL_ALREADY_REGISTERED, mostrado textualmente desde el backend.
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/login', {
        replace: true,
        state: { registeredEmail: form.email.trim() },
      });
    } catch (error) {
      // El mensaje del backend se muestra tal cual,
      // incluido el 409 `EMAIL_ALREADY_REGISTERED`.
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
    <section className={styles.registerPage}>
      <div className={styles.card}>
        <h1>Crear cuenta</h1>
        <p className={styles.subtitle}>
          Regístrese para comprar, guardar su carrito y seguir sus órdenes.
        </p>

        {serverError !== null && (
          <p className={styles.alert} role="alert">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="register-name">Nombre</label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              maxLength={NAME_MAX}
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              aria-invalid={fieldErrors.name !== undefined}
              aria-describedby={fieldErrors.name ? 'register-name-error' : undefined}
              placeholder="Nombre y apellido"
            />
            {fieldErrors.name !== undefined && (
              <span className={styles.fieldError} id="register-name-error">
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              aria-invalid={fieldErrors.email !== undefined}
              aria-describedby={
                fieldErrors.email ? 'register-email-error' : undefined
              }
              placeholder="usuario@ejemplo.com"
            />
            {fieldErrors.email !== undefined && (
              <span className={styles.fieldError} id="register-email-error">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="register-password">Contraseña</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setField('password', event.target.value)}
              aria-invalid={fieldErrors.password !== undefined}
              aria-describedby={
                fieldErrors.password
                  ? 'register-password-error register-password-hint'
                  : 'register-password-hint'
              }
              placeholder="Mínimo 8 caracteres"
            />
            <span className={styles.hint} id="register-password-hint">
              Entre {PASSWORD_MIN} y {PASSWORD_MAX} caracteres.
            </span>
            {fieldErrors.password !== undefined && (
              <span
                className={styles.fieldError}
                id="register-password-error"
              >
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="register-confirm">Confirmar contraseña</label>
            <input
              id="register-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => setField('confirmPassword', event.target.value)}
              aria-invalid={fieldErrors.confirmPassword !== undefined}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? 'register-confirm-error'
                  : undefined
              }
              placeholder="Repita la contraseña"
            />
            {fieldErrors.confirmPassword !== undefined && (
              <span
                className={styles.fieldError}
                id="register-confirm-error"
              >
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Creando cuenta…' : 'Registrarme'}
          </button>
        </form>

        <p className={styles.loginHint}>
          ¿Ya tiene cuenta? <Link to="/login">Inicie sesión</Link>
        </p>
      </div>
    </section>
  );
};

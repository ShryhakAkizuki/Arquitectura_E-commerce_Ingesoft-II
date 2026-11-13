import { useEffect, useState, type FC, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { updateProfile } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { UserResponse } from '../types/auth';

import styles from '../styles/ProfilePage.module.css';

/** Validación simple de email en cliente (el backend re-valida, §4). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Límites espejo del `UpdateProfileRequest` del backend (Bean Validation). */
const NAME_MAX = 100;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

/** Retardo para que el aviso de "email actualizado" sea legible antes del redirecionamiento. */
const EMAIL_CHANGE_REDIRECT_MS = 2000;

interface ProfileFormState {
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

/** Formulario inicial precargado con el perfil vigente (contraseñas vacías). */
function buildInitialForm(user: UserResponse | null): ProfileFormState {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    confirmPassword: '',
  };
}

/** Valida el formulario en cliente y devuelve los errores por campo. */
function validate(form: ProfileFormState): FieldErrors {
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
  if (
    form.password.length > 0 &&
    (form.password.length < PASSWORD_MIN || form.password.length > PASSWORD_MAX)
  ) {
    errors.password = `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`;
  }
  if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }
  return errors;
}

/** Formatea la fecha de alta a la fecha local (defensivo ante valores inesperados). */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const ProfilePage: FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [form, setForm] = useState<ProfileFormState>(() => buildInitialForm(user));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** `true` cuando el email cambió y la sesión debe cerrarse para reautenticar. */
  const [pendingReauth, setPendingReauth] = useState(false);

  // Email cambiado: el JWT (subject = email anterior) ya no autentica en el
  // backend; se cierra la sesión y se vuelve a /login tras un breve retardo.
  useEffect(() => {
    if (!pendingReauth) {
      return;
    }
    const timer = window.setTimeout(() => {
      logout();
      navigate('/login', { replace: true });
    }, EMAIL_CHANGE_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [pendingReauth, logout, navigate]);

  // La página vive tras <ProtectedRoute> ; si aun así no hay usuario
  if (user === null) {
    return null;
  }

  const setField = (field: keyof ProfileFormState, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    setServerError(null);
    setSuccess(null);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      // R1: PUT /api/users/me; contraseña vacía → null (no se modifica).
      // Email duplicado → 409 EMAIL_ALREADY_REGISTERED (mostrado textualmente).
      const updated = await updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.length > 0 ? form.password : null,
      });

      setForm({
        name: updated.name,
        email: updated.email,
        password: '',
        confirmPassword: '',
      });

      if (updated.email !== user.email) {
        setSuccess(
          'Su email fue actualizado. Por seguridad se cierra la sesión: inicie sesión de nuevo con el nuevo email.',
        );
        setPendingReauth(true);
      } else {
        setSuccess('Perfil actualizado correctamente.');
      }
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
    <section className={styles.profilePage}>
      <div className={styles.card}>
        <h1>Mi perfil</h1>
        <p className={styles.subtitle}>Revise y actualice los datos de su cuenta.</p>

        <dl className={styles.info}>
          <div className={styles.infoRow}>
            <dt>Rol</dt>
            <dd>{user.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</dd>
          </div>
          <div className={styles.infoRow}>
            <dt>Miembro desde</dt>
            <dd>{formatCreatedAt(user.createdAt)}</dd>
          </div>
        </dl>

        {serverError !== null && (
          <p className={styles.alert} role="alert">
            {serverError}
          </p>
        )}

        {success !== null && (
          <p className={styles.success} role="status">
            {success}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="profile-name">Nombre</label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              maxLength={NAME_MAX}
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              aria-invalid={fieldErrors.name !== undefined}
              aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
            />
            {fieldErrors.name !== undefined && (
              <span className={styles.fieldError} id="profile-name-error">
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              aria-invalid={fieldErrors.email !== undefined}
              aria-describedby={fieldErrors.email ? 'profile-email-error' : undefined}
            />
            {fieldErrors.email !== undefined && (
              <span className={styles.fieldError} id="profile-email-error">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="profile-password">Nueva contraseña</label>
            <input
              id="profile-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setField('password', event.target.value)}
              aria-invalid={fieldErrors.password !== undefined}
              aria-describedby={
                fieldErrors.password
                  ? 'profile-password-error profile-password-hint'
                  : 'profile-password-hint'
              }
            />
            <span className={styles.hint} id="profile-password-hint">
              Opcional: entre {PASSWORD_MIN} y {PASSWORD_MAX} caracteres. Déjala en
              blanco para no cambiarla.
            </span>
            {fieldErrors.password !== undefined && (
              <span className={styles.fieldError} id="profile-password-error">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="profile-confirm">Confirmar nueva contraseña</label>
            <input
              id="profile-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => setField('confirmPassword', event.target.value)}
              aria-invalid={fieldErrors.confirmPassword !== undefined}
              aria-describedby={
                fieldErrors.confirmPassword ? 'profile-confirm-error' : undefined
              }
            />
            {fieldErrors.confirmPassword !== undefined && (
              <span className={styles.fieldError} id="profile-confirm-error">
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={submitting || pendingReauth}
          >
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </section>
  );
};

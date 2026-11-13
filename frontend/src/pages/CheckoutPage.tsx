import { useState, type FC, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { checkout } from '../api/checkout';
import { ApiError } from '../api/client';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import type { OrderResponse } from '../types/order';

import styles from '../styles/CheckoutPage.module.css';

const SHIPPING_FEE = 5000;

const ADDRESS_MAX = 255;
const METHOD_MAX = 30;
const CARD_MAX = 25;
const CARDHOLDER_MAX = 100;
const CARD_MIN_DIGITS = 13;
const CARD_MAX_DIGITS = 19;

const PAYMENT_METHODS = [
  { value: 'Visa', label: 'Visa' },
  { value: 'Mastercard', label: 'Mastercard' },
  { value: 'PSE', label: 'PSE' },
];

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

interface CheckoutFormState {
  shippingAddress: string;
  method: string;
  cardNumber: string;
  cardholderName: string;
}

interface FieldErrors {
  shippingAddress?: string;
  method?: string;
  cardNumber?: string;
  cardholderName?: string;
}

interface DeclinedPayment {
  message: string;
  orderNumber: string | null;
}

const INITIAL_FORM: CheckoutFormState = {
  shippingAddress: '',
  method: 'Visa',
  cardNumber: '',
  cardholderName: '',
};

function validate(form: CheckoutFormState): FieldErrors {
  const errors: FieldErrors = {};

  const address = form.shippingAddress.trim();
  if (!address) {
    errors.shippingAddress = 'La dirección de envío es obligatoria.';
  } else if (address.length > ADDRESS_MAX) {
    errors.shippingAddress = `La dirección no puede exceder los ${ADDRESS_MAX} caracteres.`;
  }

  if (!form.method) {
    errors.method = 'El método de pago es obligatorio.';
  } else if (form.method.length > METHOD_MAX) {
    errors.method = `El método de pago no puede exceder los ${METHOD_MAX} caracteres.`;
  }

  const digits = form.cardNumber.replace(/\D/g, '');
  if (!digits) {
    errors.cardNumber = 'El número de tarjeta es obligatorio.';
  } else if (digits.length < CARD_MIN_DIGITS || digits.length > CARD_MAX_DIGITS) {
    errors.cardNumber = `El número de tarjeta debe tener entre ${CARD_MIN_DIGITS} y ${CARD_MAX_DIGITS} dígitos.`;
  } else if (form.cardNumber.length > CARD_MAX) {
    errors.cardNumber = `El número de tarjeta no puede exceder los ${CARD_MAX} caracteres.`;
  }

  if (form.cardholderName.trim().length > CARDHOLDER_MAX) {
    errors.cardholderName = `El nombre del titular no puede exceder los ${CARDHOLDER_MAX} caracteres.`;
  }

  return errors;
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, CARD_MAX_DIGITS);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function extractDeclinedOrderNumber(message: string): string | null {
  const match = message.match(/ORD-[A-Z0-9]{4,}/i);
  return match !== null ? match[0] : null;
}

export const CheckoutPage: FC = () => {
  const { user } = useAuth();
  const { items, subtotal, loading, error, refresh } = useCart();

  const [form, setForm] = useState<CheckoutFormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [decline, setDecline] = useState<DeclinedPayment | null>(null);

  if (user === null) {
    return null;
  }

  const total = subtotal + SHIPPING_FEE;

  const setField = (field: keyof CheckoutFormState, value: string): void => {
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

    setDecline(null);
    setSubmitting(true);
    try {
      const created = await checkout({
        shippingAddress: form.shippingAddress.trim(),
        payment: {
          method: form.method,
          cardNumber: form.cardNumber,
          cardholderName: form.cardholderName.trim() || null,
        },
      });
      setOrder(created);
      refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error inesperado. Inténtelo de nuevo.';
      if (err instanceof ApiError && err.code === 'PAYMENT_DECLINED') {
        setDecline({ message, orderNumber: extractDeclinedOrderNumber(message) });
      } else {
        setServerError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = (): void => {
    setDecline(null);
    setServerError(null);
    setFieldErrors({});
  };

  if (decline !== null) {
    return (
      <section className={styles.checkout}>
        <div className={styles.declinePanel} role="alert">
          <div className={styles.declineIcon} aria-hidden="true">
            ⚠️
          </div>
          <h1>No se pudo procesar el pago</h1>
          <p className={styles.declineMessage}>{decline.message}</p>
          {decline.orderNumber !== null && (
            <p className={styles.declineOrderNumber}>
              Orden <strong>{decline.orderNumber}</strong> · estado{' '}
              <strong>PENDING</strong>: el stock no se ha descontado y puede
              completar el pago reintentando con otra tarjeta.
            </p>
          )}
          <div className={styles.declineActions}>
            <button type="button" className={styles.primaryButton} onClick={handleRetry}>
              Reintentar el pago
            </button>
            <Link to="/" className={styles.secondaryLink}>
              Volver al catálogo
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (order !== null) {
    return (
      <section className={styles.checkout}>
        <div className={styles.successPanel} role="status">
          <div className={styles.successIcon} aria-hidden="true">
            ✅
          </div>
          <h1>Compra realizada</h1>
          <p className={styles.successText}>
            Su orden <strong>{order.orderNumber}</strong> fue creada y el pago quedó confirmado.
          </p>
          <p className={styles.successTotal}>
            Total pagado: <strong>{formatPrice(order.total)}</strong>
          </p>
          <div className={styles.successActions}>
            <Link to="/orders" className={styles.primaryButton}>
              Ver mis órdenes
            </Link>
            <Link to="/" className={styles.secondaryLink}>
              Seguir comprando
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.checkout}>
      <header className={styles.header}>
        <div>
          <h1>Finalizar compra</h1>
          <p className={styles.subtitle}>
            Ingresa tu dirección de envío y los datos de pago para confirmar el pedido.
          </p>
        </div>
      </header>

      {loading ? (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Cargando carrito…</span>
        </div>
      ) : error !== null ? (
        <div className={styles.errorState} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => refresh()}>
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            icon="🛒"
            title="Tu carrito está vacío"
            message="Agrega productos del catálogo para poder finalizar la compra."
          >
            <Link to="/" className={styles.actionButton}>
              Explorar catálogo
            </Link>
          </EmptyState>
        </div>
      ) : (
        <div className={styles.layout}>
          <form className={styles.formColumn} onSubmit={handleSubmit} noValidate>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>1 · Dirección de envío</h2>

              <div className={styles.field}>
                <label htmlFor="checkout-address">Dirección</label>
                <textarea
                  id="checkout-address"
                  rows={3}
                  maxLength={ADDRESS_MAX}
                  placeholder="Calle, número, barrio, ciudad"
                  value={form.shippingAddress}
                  onChange={(event) => setField('shippingAddress', event.target.value)}
                  aria-invalid={fieldErrors.shippingAddress !== undefined}
                  aria-describedby={
                    fieldErrors.shippingAddress ? 'checkout-address-error' : undefined
                  }
                />
                {fieldErrors.shippingAddress !== undefined && (
                  <span className={styles.fieldError} id="checkout-address-error">
                    {fieldErrors.shippingAddress}
                  </span>
                )}
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>2 · Pago</h2>

              <div className={styles.field}>
                <label htmlFor="checkout-method">Método</label>
                <select
                  id="checkout-method"
                  value={form.method}
                  onChange={(event) => setField('method', event.target.value)}
                  aria-invalid={fieldErrors.method !== undefined}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.method !== undefined && (
                  <span className={styles.fieldError}>{fieldErrors.method}</span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="checkout-card">Número de tarjeta</label>
                <input
                  id="checkout-card"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  value={form.cardNumber}
                  onChange={(event) => setField('cardNumber', formatCardNumber(event.target.value))}
                  aria-invalid={fieldErrors.cardNumber !== undefined}
                  aria-describedby={
                    fieldErrors.cardNumber ? 'checkout-card-error' : 'checkout-card-hint'
                  }
                />
                {fieldErrors.cardNumber !== undefined ? (
                  <span className={styles.fieldError} id="checkout-card-error">
                    {fieldErrors.cardNumber}
                  </span>
                ) : (
                  <span className={styles.hint} id="checkout-card-hint">
                    Demo: las tarjetas terminadas en 0002 son rechazadas por la pasarela
                    simulada (§6).
                  </span>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="checkout-cardholder">Nombre del titular</label>
                <input
                  id="checkout-cardholder"
                  type="text"
                  autoComplete="cc-name"
                  maxLength={CARDHOLDER_MAX}
                  placeholder="Nombre tal como aparece en la tarjeta"
                  value={form.cardholderName}
                  onChange={(event) => setField('cardholderName', event.target.value)}
                  aria-invalid={fieldErrors.cardholderName !== undefined}
                />
                {fieldErrors.cardholderName !== undefined && (
                  <span className={styles.fieldError}>{fieldErrors.cardholderName}</span>
                )}
              </div>
            </section>

            {serverError !== null && (
              <p className={styles.alert} role="alert">
                {serverError}
              </p>
            )}

            <button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Procesando pago…
                </>
              ) : decline !== null ? (
                <>Reintentar · Pagar {formatPrice(total)}</>
              ) : (
                <>Pagar {formatPrice(total)}</>
              )}
            </button>

            <Link to="/cart" className={styles.backLink}>
              ← Volver al carrito
            </Link>
          </form>

          <aside className={styles.summary} aria-label="Resumen del pedido">
            <h2 className={styles.summaryTitle}>Resumen del pedido</h2>

            <ul className={styles.summaryItems}>
              {items.map((item) => (
                <li key={item.id} className={styles.summaryItem}>
                  <span className={styles.summaryItemName}>
                    {item.productName} <em>× {item.quantity}</em>
                  </span>
                  <span>{formatPrice(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <dl className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>Envío</dt>
                <dd>{formatPrice(SHIPPING_FEE)}</dd>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <dt>Total</dt>
                <dd>{formatPrice(total)}</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </section>
  );
};

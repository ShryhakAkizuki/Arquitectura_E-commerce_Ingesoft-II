import { useState, type FC, type FormEvent } from 'react';

import type { ProductRequest } from '../../types/product';

import styles from '../../styles/ProductForm.module.css';

const NAME_MAX = 150;
const DESCRIPTION_MAX = 2000;
const IMAGE_URL_MAX = 500;

interface ProductFormState {
  name: string;
  description: string;
  price: string;
  stock: string;
  imageUrl: string;
}

interface FieldErrors {
  name?: string;
  description?: string;
  price?: string;
  stock?: string;
  imageUrl?: string;
}

interface ProductFormProps {
  initial: ProductRequest | null;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: ProductRequest) => void;
  onCancel?: () => void;
}

function buildInitialState(initial: ProductRequest | null): ProductFormState {
  return {
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    price: initial !== null ? String(initial.price) : '',
    stock: initial !== null ? String(initial.stock) : '',
    imageUrl: initial?.imageUrl ?? '',
  };
}

/** Valida el formulario en cliente y devuelve los errores por campo. */
function validate(form: ProductFormState): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  const description = form.description.trim();

  if (!name) {
    errors.name = 'El nombre es obligatorio.';
  } else if (name.length > NAME_MAX) {
    errors.name = `El nombre no puede exceder los ${NAME_MAX} caracteres.`;
  }
  if (!description) {
    errors.description = 'La descripción es obligatoria.';
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `La descripción no puede exceder los ${DESCRIPTION_MAX} caracteres.`;
  }

  const priceRaw = form.price.trim();
  const price = Number(priceRaw);
  if (!priceRaw) {
    errors.price = 'El precio es obligatorio.';
  } else if (Number.isNaN(price)) {
    errors.price = 'El precio debe ser un número.';
  } else if (price <= 0) {
    errors.price = 'El precio debe ser mayor que cero.';
  }

  const stockRaw = form.stock.trim();
  const stock = Number(stockRaw);
  if (!stockRaw) {
    errors.stock = 'El stock es obligatorio.';
  } else if (!Number.isInteger(stock)) {
    errors.stock = 'El stock debe ser un número entero.';
  } else if (stock < 0) {
    errors.stock = 'El stock no puede ser negativo.';
  }

  const imageUrl = form.imageUrl.trim();
  if (imageUrl.length > IMAGE_URL_MAX) {
    errors.imageUrl = `La URL de imagen no puede exceder los ${IMAGE_URL_MAX} caracteres.`;
  }

  return errors;
}

export const ProductForm: FC<ProductFormProps> = ({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}) => {
  const [form, setForm] = useState<ProductFormState>(() => buildInitialState(initial));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const setField = (field: keyof ProductFormState, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    const imageUrl = form.imageUrl.trim();
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price.trim()),
      stock: Number(form.stock.trim()),
      imageUrl: imageUrl === '' ? null : imageUrl,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="product-name">Nombre</label>
        <input
          id="product-name"
          type="text"
          maxLength={NAME_MAX}
          value={form.name}
          onChange={(event) => setField('name', event.target.value)}
          aria-invalid={fieldErrors.name !== undefined}
          aria-describedby={fieldErrors.name ? 'product-name-error' : undefined}
        />
        {fieldErrors.name !== undefined && (
          <span className={styles.fieldError} id="product-name-error">
            {fieldErrors.name}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="product-description">Descripción</label>
        <textarea
          id="product-description"
          rows={4}
          maxLength={DESCRIPTION_MAX}
          value={form.description}
          onChange={(event) => setField('description', event.target.value)}
          aria-invalid={fieldErrors.description !== undefined}
          aria-describedby={fieldErrors.description ? 'product-description-error' : undefined}
        />
        {fieldErrors.description !== undefined && (
          <span className={styles.fieldError} id="product-description-error">
            {fieldErrors.description}
          </span>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="product-price">Precio (COP)</label>
          <input
            id="product-price"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={form.price}
            onChange={(event) => setField('price', event.target.value)}
            aria-invalid={fieldErrors.price !== undefined}
            aria-describedby={fieldErrors.price ? 'product-price-error' : undefined}
          />
          {fieldErrors.price !== undefined && (
            <span className={styles.fieldError} id="product-price-error">
              {fieldErrors.price}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="product-stock">Stock</label>
          <input
            id="product-stock"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={form.stock}
            onChange={(event) => setField('stock', event.target.value)}
            aria-invalid={fieldErrors.stock !== undefined}
            aria-describedby={fieldErrors.stock ? 'product-stock-error' : undefined}
          />
          {fieldErrors.stock !== undefined && (
            <span className={styles.fieldError} id="product-stock-error">
              {fieldErrors.stock}
            </span>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="product-image">URL de imagen</label>
        <input
          id="product-image"
          type="url"
          placeholder="https://…"
          value={form.imageUrl}
          onChange={(event) => setField('imageUrl', event.target.value)}
          aria-invalid={fieldErrors.imageUrl !== undefined}
          aria-describedby={
            fieldErrors.imageUrl ? 'product-image-error product-image-hint' : 'product-image-hint'
          }
        />
        <span className={styles.hint} id="product-image-hint">
          Opcional: máximo {IMAGE_URL_MAX} caracteres. Déjala en blanco para quitarla.
        </span>
        {fieldErrors.imageUrl !== undefined && (
          <span className={styles.fieldError} id="product-image-error">
            {fieldErrors.imageUrl}
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? 'Guardando…' : submitLabel}
        </button>
        {onCancel !== undefined && (
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
};

import type { ChangeEvent, FC } from 'react';

import styles from '../styles/QuantitySelector.module.css';

interface QuantitySelectorProps {
  value: number;
  min?: number;
  max?: number;
  busy?: boolean;
  id: string;
  label: string;

  onChange: (quantity: number) => void;
}

function clampQuantity(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(min, Math.trunc(value)), max);
}

export const QuantitySelector: FC<QuantitySelectorProps> = ({
  value,
  min = 1,
  max,
  busy = false,
  id,
  label,
  onChange,
}) => {
  const upper = max === undefined ? Number.MAX_SAFE_INTEGER : Math.max(min, max);
  const step = (delta: number): void => {
    onChange(clampQuantity(value + delta, min, upper));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(clampQuantity(event.target.valueAsNumber, min, upper));
  };

  return (
    <div className={styles.selector}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.controls} role="group" aria-label={label}>
        <button
          type="button"
          className={styles.button}
          aria-label="Disminuir cantidad"
          disabled={busy || value <= min}
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          id={id}
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={min}
          max={upper}
          value={value}
          disabled={busy}
          onChange={handleChange}
          aria-label={label}
        />
        <button
          type="button"
          className={styles.button}
          aria-label="Aumentar cantidad"
          disabled={busy || value >= upper}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
    </div>
  );
};

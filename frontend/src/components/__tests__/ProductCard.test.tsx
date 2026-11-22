import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import type { AuthContextValue } from '../../context/AuthContext';
import type { CartContextValue } from '../../context/CartContext';
import type { ProductResponse } from '../../types/product';
import type { UserResponse } from '../../types/auth';

import { ProductCard } from '../ProductCard';

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useCart', () => ({ useCart: vi.fn() }));

const useAuthMock = vi.mocked(useAuth);
const useCartMock = vi.mocked(useCart);

const demoUser: UserResponse = {
  id: 'user-1',
  name: 'Usuario Demo',
  email: 'user@demo.com',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00Z',
};

const product: ProductResponse = {
  id: 'prod-1',
  name: 'Teclado mecánico 87',
  description: 'Switches red, layout TKL, cable USB-C.',
  price: 250000,
  stock: 10,
  imageUrl: null,
  available: true,
  updatedAt: '2026-01-01T00:00:00Z',
};

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return { user: null, loading: false, login: vi.fn(), logout: vi.fn(), ...overrides };
}

function cartValue(overrides: Partial<CartContextValue> = {}): CartContextValue {
  return {
    items: [],
    subtotal: 0,
    itemCount: 0,
    loading: false,
    error: null,
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
}

function renderCard(target: ProductResponse = product): void {
  render(
    <MemoryRouter>
      <ProductCard product={target} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProductCard', () => {
  it('muestra los datos del producto (nombre, descripción, precio y stock)', () => {
    useAuthMock.mockReturnValue(authValue());
    useCartMock.mockReturnValue(cartValue());

    renderCard();

    expect(screen.getByRole('heading', { name: 'Teclado mecánico 87' })).toBeInTheDocument();
    expect(screen.getByText('Switches red, layout TKL, cable USB-C.')).toBeInTheDocument();
    expect(screen.getByText(/250\.000/)).toBeInTheDocument();
    expect(screen.getByText('En stock')).toBeInTheDocument();
  });

  it('sin sesión muestra el enlace a login en lugar del botón de agregar', () => {
    useAuthMock.mockReturnValue(authValue());
    useCartMock.mockReturnValue(cartValue());

    renderCard();

    expect(screen.queryByRole('button', { name: /agregar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión para agregar' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('al hacer clic en "Agregar al carrito" dispara la acción con cantidad 1', async () => {
    const cart = cartValue();
    useAuthMock.mockReturnValue(authValue({ user: demoUser }));
    useCartMock.mockReturnValue(cart);

    const agent = userEvent.setup();
    renderCard();

    await agent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));

    expect(cart.add).toHaveBeenCalledWith({ productId: 'prod-1', quantity: 1 });
    expect(await screen.findByRole('button', { name: 'Agregado ✓' })).toBeInTheDocument();
  });

  it('muestra el error textual del backend si el carrito rechaza por stock', async () => {
    const cart = cartValue();
    const message =
      "El producto 'Teclado mecánico 87' no tiene suficiente stock (disponible: 2, solicitado: 5)";
    vi.mocked(cart.add).mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'INSUFFICIENT_STOCK',
        message,
        timestamp: '2026-01-02T12:00:00Z',
      }),
    );
    useAuthMock.mockReturnValue(authValue({ user: demoUser }));
    useCartMock.mockReturnValue(cart);

    const agent = userEvent.setup();
    renderCard();

    await agent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Agregar al carrito' })).toBeEnabled();
  });

  it('con stock agotado el botón queda deshabilitado', () => {
    const outOfStock: ProductResponse = { ...product, stock: 0 };
    useAuthMock.mockReturnValue(authValue({ user: demoUser }));
    useCartMock.mockReturnValue(cartValue());

    renderCard(outOfStock);

    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar al carrito' })).toBeDisabled();
  });
});

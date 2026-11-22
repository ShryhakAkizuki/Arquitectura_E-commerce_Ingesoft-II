import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkout } from '../../api/checkout';
import { ApiError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import type { AuthContextValue } from '../../context/AuthContext';
import type { CartContextValue } from '../../context/CartContext';
import type { CartItemResponse } from '../../types/cart';
import type { OrderResponse } from '../../types/order';
import type { UserResponse } from '../../types/auth';

import { CheckoutPage } from '../CheckoutPage';

vi.mock('../../api/checkout', () => ({
  checkout: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../hooks/useCart', () => ({ useCart: vi.fn() }));

const checkoutMock = vi.mocked(checkout);
const useAuthMock = vi.mocked(useAuth);
const useCartMock = vi.mocked(useCart);

const demoUser: UserResponse = {
  id: 'user-1',
  name: 'Usuario Demo',
  email: 'user@demo.com',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00Z',
};

const item: CartItemResponse = {
  id: 'cart-item-1',
  productId: 'prod-1',
  productName: 'Teclado mecánico 87',
  imageUrl: null,
  unitPrice: 250000,
  quantity: 1,
  lineTotal: 250000,
};

const successOrder: OrderResponse = {
  id: 'order-1',
  orderNumber: 'ORD-1A2B3C4D',
  status: 'PAID',
  subtotal: 250000,
  shipping: 5000,
  total: 255000,
  shippingAddress: 'Calle 1 # 2-3, Bogotá',
  createdAt: '2026-01-02T12:00:00Z',
  items: [{ productId: 'prod-1', productName: item.productName, unitPrice: 250000, quantity: 1, lineTotal: 250000 }],
};

function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return { user: null, loading: false, login: vi.fn(), logout: vi.fn(), ...overrides };
}

function cartValue(overrides: Partial<CartContextValue> = {}): CartContextValue {
  return {
    items: [item],
    subtotal: 250000,
    itemCount: 1,
    loading: false,
    error: null,
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
}

function renderPage(): void {
  render(
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>,
  );
}

async function fillValidForm(agent: ReturnType<typeof userEvent.setup>): Promise<void> {
  await agent.type(screen.getByRole('textbox', { name: 'Dirección' }), 'Calle 1 # 2-3, Bogotá');
  await agent.clear(screen.getByRole('textbox', { name: /número de tarjeta/i }));
  await agent.type(screen.getByRole('textbox', { name: /número de tarjeta/i }), '4242424242424242');
  await agent.type(
    screen.getByRole('textbox', { name: /nombre del titular/i }),
    'USUARIO DEMO',
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue(authValue({ user: demoUser }));
  useCartMock.mockReturnValue(cartValue());
});

describe('CheckoutPage', () => {
  it('con formulario inválido bloquea el envío y no llama a la API', async () => {

    checkoutMock.mockResolvedValue(successOrder);
    renderPage();

    const agent = userEvent.setup();

    await agent.click(screen.getByRole('button', { name: /pagar/i }));

    expect(await screen.findByText('La dirección de envío es obligatoria.')).toBeInTheDocument();
    expect(
      await screen.findByText(/El número de tarjeta es obligatorio/),
    ).toBeInTheDocument();
    expect(checkoutMock).not.toHaveBeenCalled();
  });

  it('con pago rechazado muestra el motivo, la orden PENDING y permite reintentar', async () => {

    const message =
      'El pago fue rechazado. La orden ORD-1A2B3C4D quedó PENDING; reintente el pago con ese número de orden.';
    checkoutMock.mockRejectedValue(
      new ApiError({
        status: 402,
        code: 'PAYMENT_DECLINED',
        message,
        timestamp: '2026-01-02T12:00:00Z',
      }),
    );
    renderPage();

    const agent = userEvent.setup();

    await fillValidForm(agent);
    await agent.click(screen.getByRole('button', { name: /pagar/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('No se pudo procesar el pago')).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText('ORD-1A2B3C4D')).toBeInTheDocument();
    expect(screen.getByText('PENDING', { exact: true })).toBeInTheDocument();

    await agent.click(screen.getByRole('button', { name: 'Reintentar el pago' }));

    expect(await screen.findByRole('button', { name: /pagar/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Dirección' })).toHaveValue('Calle 1 # 2-3, Bogotá');
  });

  it('con éxito muestra el número de orden y el enlace a mis órdenes', async () => {
    checkoutMock.mockResolvedValue(successOrder);
    renderPage();

    const agent = userEvent.setup();

    await fillValidForm(agent);
    await agent.click(screen.getByRole('button', { name: /pagar/i }));

    expect(await screen.findByText('Compra realizada')).toBeInTheDocument();
    expect(screen.getByText('ORD-1A2B3C4D')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mis órdenes' })).toHaveAttribute('href', '/orders');
    expect(checkoutMock).toHaveBeenCalledTimes(1);
  });
});

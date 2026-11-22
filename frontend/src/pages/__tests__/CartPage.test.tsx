import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/client';
import { useCart } from '../../hooks/useCart';
import type { CartContextValue } from '../../context/CartContext';
import type { CartItemResponse } from '../../types/cart';

import { CartPage } from '../CartPage';

vi.mock('../../hooks/useCart', () => ({ useCart: vi.fn() }));

const useCartMock = vi.mocked(useCart);

const item: CartItemResponse = {
  id: 'cart-item-1',
  productId: 'prod-1',
  productName: 'Teclado mecánico 87',
  imageUrl: null,
  unitPrice: 250000,
  quantity: 1,
  lineTotal: 250000,
};

function cartValue(overrides: Partial<CartContextValue> = {}): CartContextValue {
  return {
    items: [item],
    subtotal: 250000,
    itemCount: 1,
    loading: false,
    error: null,
    add: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn(),
    ...overrides,
  };
}

function renderPage(cart: CartContextValue): void {
  useCartMock.mockReturnValue(cart);
  render(
    <MemoryRouter>
      <CartPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CartPage (ítem de carrito)', () => {
  it('muestra el ítem, su precio unitario y el subtotal', () => {
    renderPage(cartValue());

    expect(screen.getByRole('heading', { name: 'Mi carrito' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teclado mecánico 87' })).toHaveAttribute(
      'href',
      '/product/prod-1',
    );
    expect(screen.getByText('Resumen')).toBeInTheDocument();
    expect(screen.getAllByText(/250\.000/).length).toBeGreaterThanOrEqual(3);
  });

  it('cambiar la cantidad con "+" dispara la acción de actualizar contra el ítem', async () => {

    const cart = cartValue();
    renderPage(cart);

    const agent = userEvent.setup();

    await agent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));

    expect(cart.update).toHaveBeenCalledWith('cart-item-1', { quantity: 2 });
  });

  it('escribir la cantidad en el campo dispara la acción de actualizar', async () => {

    const cart = cartValue();
    renderPage(cart);

    const quantityInput = screen.getByRole('spinbutton', {
      name: 'Cantidad de Teclado mecánico 87',
    });
    fireEvent.change(quantityInput, { target: { value: '3' } });

    expect(cart.update).toHaveBeenCalledWith('cart-item-1', { quantity: 3 });
  });

  it('muestra el error textual del backend si el cambio de cantidad se rechaza', async () => {

    const cart = cartValue();
    const message =
      "El producto 'Teclado mecánico 87' no tiene suficiente stock (disponible: 1, solicitado: 2)";
    vi.mocked(cart.update).mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'INSUFFICIENT_STOCK',
        message,
        timestamp: '2026-01-02T12:00:00Z',
      }),
    );
    renderPage(cart);

    const agent = userEvent.setup();

    await agent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('con carrito vacío muestra el estado vacío', () => {

    renderPage(cartValue({ items: [], subtotal: 0, itemCount: 0 }));

    expect(screen.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar catálogo' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});

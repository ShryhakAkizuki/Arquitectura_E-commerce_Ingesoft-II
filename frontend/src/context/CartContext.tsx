import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';

import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
} from '../api/cart';
import { ApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type {
  AddCartItemRequest,
  CartItemResponse,
  CartResponse,
  UpdateCartItemRequest,
} from '../types/cart';

export interface CartContextValue {
  items: CartItemResponse[];
  subtotal: number;
  itemCount: number;
  loading: boolean;
  error: string | null;

  add: (request: AddCartItemRequest) => Promise<void>;
  update: (itemId: string, request: UpdateCartItemRequest) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  refresh: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: FC<CartProviderProps> = ({ children }) => {
  const { user } = useAuth();

  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  const loadCart = useCallback((): void => {
    const requestId = (requestIdRef.current += 1);
    setLoading(true);
    setError(null);

    getCart()
      .then((result) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setCart(result);
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setCart(null);
        setError(
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un error inesperado al cargar el carrito.',
        );
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user === null) {
      requestIdRef.current += 1;
      setCart(null);
      setError(null);
      setLoading(false);
      return;
    }
    loadCart();
  }, [user, loadCart]);

  const add = useCallback((request: AddCartItemRequest): Promise<void> => {
    return addCartItem(request).then((result) => {
      setCart(result);
    });
  }, []);

  const update = useCallback(
    (itemId: string, request: UpdateCartItemRequest): Promise<void> => {
      return updateCartItem(itemId, request).then((result) => {
        setCart(result);
      });
    },
    [],
  );

  const remove = useCallback((itemId: string): Promise<void> => {
    return removeCartItem(itemId).then((result) => {
      setCart(result);
    });
  }, []);

  const items = useMemo<CartItemResponse[]>(() => cart?.items ?? [], [cart]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      subtotal: cart?.subtotal ?? 0,
      itemCount,
      loading,
      error,
      add,
      update,
      remove,
      refresh: loadCart,
    }),
    [items, cart, itemCount, loading, error, add, update, remove, loadCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

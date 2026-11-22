import { useContext } from 'react';

import { CartContext, type CartContextValue } from '../context/CartContext';

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context === null) {
    throw new Error('useCart debe usarse dentro de <CartProvider>.');
  }
  return context;
}

import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '../context/AuthContext';

/** Sesión global: `user`, `loading`, `login` y `logout`. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider> (F-0.4, ver src/main.tsx).');
  }
  return context;
}

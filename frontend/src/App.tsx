import type { FC } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AdminRoute } from './components/AdminRoute';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { CatalogPage } from './pages/CatalogPage';
import { LoginPage } from './pages/LoginPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

const PlaceholderPage: FC<PlaceholderPageProps> = ({ title, description }) => (
  <section className="page">
    <h1>{title}</h1>
    <p className="page__description">{description}</p>
  </section>
);

const App: FC = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<CatalogPage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route
        path="/cart"
        element={<PlaceholderPage title="Carrito" description="Edición de cantidades y totales." />}
      />
      <Route
        path="/checkout"
        element={
          <PlaceholderPage title="Checkout" description="Dirección de envío, pago y resultado." />
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={<PlaceholderPage title="Mis órdenes" description="Listado de órdenes del usuario." />}
      />
      <Route
        path="/orders/:id"
        element={
          <PlaceholderPage title="Detalle de orden" description="Ítems, totales y estados." />
        }
      />
      <Route
        path="/admin/products"
        element={
          <AdminRoute>
            <AdminProductsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <PlaceholderPage title="Panel admin · Órdenes" description="Gestión de estados de órdenes." />
        }
      />
      <Route
        path="*"
        element={
          <PlaceholderPage title="404 — Página no encontrada" description="Ruta no definida." />
        }
      />
    </Route>
  </Routes>
);

export default App;

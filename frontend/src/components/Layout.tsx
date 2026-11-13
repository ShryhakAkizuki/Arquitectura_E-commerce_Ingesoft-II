import type { FC } from 'react';
import { Outlet } from 'react-router-dom';

import { Navbar } from './Navbar';

import styles from '../styles/Layout.module.css';

export const Layout: FC = () => (
  <div className={styles.layout}>
    <a className={styles.skipLink} href="#main-content">
      Saltar al contenido
    </a>
    <Navbar />
    <main id="main-content" className={styles.main}>
      <Outlet />
    </main>
    <footer className={styles.footer}>
      IngShop — Práctica técnica de arquitectura · Ingesoft II
    </footer>
  </div>
);

-- =============================================================================
-- Flyway V2: datos demo deterministicos (seed)
--
-- -----------------------------------------------------------------------------
-- CREDENCIALES DEMO:
--   Administrador:  admin@demo.com  / Admin123!
--   Usuario:        user@demo.com   / User123!
--
-- `password_hash` inserta el hash BCrypt PRECOMPUTADO como constante. El hash 
-- se genera una sola vez con el mismo encoder del backend (Spring Security 
-- BCryptPasswordEncoder, fuerza 10) y se verifica con matches() antes de incorporarse 
-- a este script:
--   Admin123! -> $2a$10$gtLfBrrajcJHki.Pd7BqHeF2wcdOTkhrgVH9bk.4n6TtVeLdE0u8i
--   User123!  -> $2a$10$8IVXNJDQNzaH0Kd.BURgfOxSi9HTy.K0q7aUxkaIcAEeDbfMjGKNC
-- Ser constantes hace el seed DETERMINISTICO y reproducible en cualquier
-- maquina.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS (R1): 1 administrador + 1 usuario demo
-- -----------------------------------------------------------------------------
INSERT INTO users (id, name, email, password_hash, role, active, created_at) VALUES
    ('00000000-0000-0000-0000-000000000001',
     'Administrador Demo',
     'admin@demo.com',
     '$2a$10$gtLfBrrajcJHki.Pd7BqHeF2wcdOTkhrgVH9bk.4n6TtVeLdE0u8i',
     'ADMIN',
     TRUE,
     CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000002',
     'Usuario Demo',
     'user@demo.com',
     '$2a$10$8IVXNJDQNzaH0Kd.BURgfOxSi9HTy.K0q7aUxkaIcAEeDbfMjGKNC',
     'USER',
     TRUE,
     CURRENT_TIMESTAMP);

-- -----------------------------------------------------------------------------
-- PRODUCTS (R5): 8 productos de ejemplo con precio (COP) y stock coherentes.
-- -----------------------------------------------------------------------------
INSERT INTO products (id, name, description, price, stock, image_url, available, updated_at) VALUES
    ('00000000-0000-0000-0000-000000000101',
     'Laptop ProBook 14"',
     'Laptop ProBook 14" con 16 GB de RAM, SSD de 512 GB y procesador de 13a generacion. Ideal para trabajo y estudio.',
     2599900.00,
     10,
     '/img/productos/laptop-probook.webp',
     TRUE,
     CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000102',
     'Teclado Mecanico RGB',
     'Teclado mecanico con switches rojos, retroiluminacion RGB por tecla y disposicion en espanol (LATAM).',
     189900.00,
     25,
     '/img/productos/teclado-mecanico.webp',
     TRUE,
     CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000103',
     'Mouse Gamer 12000 DPI',
     'Mouse gamer inalambrico con DPI ajustable hasta 12000, 7 botones programables y bateria de 70 horas.',
     99900.00,
     40,
     '/img/productos/mouse-gamer.webp',
     TRUE,
     CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000104',
     'Monitor 27" 144Hz',
     'Monitor IPS de 27" con 144 Hz, 1 ms, resolucion 1080p y salidas HDMI y DisplayPort.',
     749900.00,
     8,
     '/img/productos/monitor-27.webp',
     TRUE,
     CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000105',
     'Cable USB-C 100W',
     'Cable USB-C trenzado con carga de 100W y transferencia de datos a 10 Gbps. Longitud 2 m. (STOCK BAJO: demo de INSUFFICIENT_STOCK)',
     29900.00,
     2,
     '/img/productos/cable-usbc.webp',
     TRUE,
     CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000106',
     'Audifonos Bluetooth 5.3',
     'Audifonos inalambricos over-ear con cancelacion de ruido, 30 horas de bateria y micron integrado.',
     149900.00,
     15,
     '/img/productos/audifonos-bt.webp',
     TRUE,
     CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000107',
     'SSD NVMe 1TB',
     'Unidad SSD interna NVMe M.2 de 1 TB con 3500 MB/s de lectura secuencial.',
     259900.00,
     20,
     '/img/productos/ssd-1tb.webp',
     TRUE,
     CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000108',
     'Hub USB 3.0 4 Puertos',
     'Hub USB 3.0 de aluminio con 4 puertos a 5 Gbps, boton de encendido y cable desmontable de 15 cm.',
     49900.00,
     5,
     '/img/productos/hub-usb3.webp',
     TRUE,
     CURRENT_TIMESTAMP);

-- =============================================================================
-- Flyway V1: esquema completo y versionado
--
-- Notas de portabilidad: el perfil "h2" reutiliza estas MISMAS migraciones sobre
-- H2 (MODE=PostgreSQL), por lo que este script se escribe con sintaxis válida en 
-- PostgreSQL y en H2:
--   * Los enums de dominio se modelan como VARCHAR + CHECK: H2 no soporta 
--     "CREATE TYPE ... AS ENUM" y la restricción CHECK aplica el mismo dominio 
--     en ambos motores.
--   * "timestamptz" se escribe como TIMESTAMP WITH TIME ZONE (SQL
--     estándar, equivalente en ambos motores).
--   * Los UUID los genera la aplicacion (JPA) y no tienen DEFAULT a nivel de
--     BD; V2__seed.sql inserta UUIDs explicitos para los datos demo.
--   * Los identificadores van en minusculas y sin comillas (la URL del perfil
--     h2 usa DATABASE_TO_LOWER=TRUE, mismo comportamiento que PostgreSQL).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS (R1)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id            UUID                         NOT NULL,
    name          VARCHAR(100)                 NOT NULL,
    email         VARCHAR(255)                 NOT NULL,
    password_hash VARCHAR(255)                 NOT NULL,
    role          VARCHAR(20)                  NOT NULL,
    active        BOOLEAN                      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP WITH TIME ZONE     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('USER', 'ADMIN'))
);

-- -----------------------------------------------------------------------------
-- PRODUCTS (R5)
-- -----------------------------------------------------------------------------
CREATE TABLE products (
    id          UUID                         NOT NULL,
    name        VARCHAR(150)                 NOT NULL,
    description VARCHAR(2000)                NOT NULL,
    price       NUMERIC(12,2)                NOT NULL,
    stock       INT                          NOT NULL,
    image_url   VARCHAR(500)                 NULL,
    available   BOOLEAN                      NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMP WITH TIME ZONE     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_products PRIMARY KEY (id),
    CONSTRAINT chk_products_price CHECK (price >= 0),
    CONSTRAINT chk_products_stock CHECK (stock >= 0)
);

-- -----------------------------------------------------------------------------
-- CARTS (R3)
-- -----------------------------------------------------------------------------
CREATE TABLE carts (
    id      UUID NOT NULL,
    user_id UUID NOT NULL,
    CONSTRAINT pk_carts PRIMARY KEY (id),
    CONSTRAINT uq_carts_user_id UNIQUE (user_id),
    CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- CART_ITEMS (R3)
-- -----------------------------------------------------------------------------
CREATE TABLE cart_items (
    id         UUID          NOT NULL,
    cart_id    UUID          NOT NULL,
    product_id UUID          NOT NULL,
    quantity   INT           NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    CONSTRAINT pk_cart_items PRIMARY KEY (id),
    CONSTRAINT uq_cart_items_cart_product UNIQUE (cart_id, product_id),
    CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0),
    CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- ORDERS (R2, R3)
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
    id               UUID                         NOT NULL,
    user_id          UUID                         NOT NULL,
    order_number     VARCHAR(40)                  NOT NULL,
    status           VARCHAR(20)                  NOT NULL,
    subtotal         NUMERIC(12,2)                NOT NULL,
    shipping         NUMERIC(12,2)                NOT NULL,
    total            NUMERIC(12,2)                NOT NULL,
    shipping_address VARCHAR(255)                 NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_orders PRIMARY KEY (id),
    CONSTRAINT uq_orders_order_number UNIQUE (order_number),
    CONSTRAINT chk_orders_status CHECK (status IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- ORDER_ITEMS (R2, R3)
-- -----------------------------------------------------------------------------
CREATE TABLE order_items (
    id           UUID          NOT NULL,
    order_id     UUID          NOT NULL,
    product_id   UUID          NOT NULL,
    product_name VARCHAR(150)  NOT NULL,
    unit_price   NUMERIC(12,2) NOT NULL,
    quantity     INT           NOT NULL,
    CONSTRAINT pk_order_items PRIMARY KEY (id),
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- PAYMENTS (R4)
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
    id             UUID                         NOT NULL,
    order_id       UUID                         NOT NULL,
    status         VARCHAR(20)                  NOT NULL,
    provider       VARCHAR(50)                  NOT NULL,
    method         VARCHAR(50)                  NOT NULL,
    transaction_id VARCHAR(64)                  NULL,
    amount         NUMERIC(12,2)                NOT NULL,
    failure_reason VARCHAR(255)                 NULL,
    processed_at   TIMESTAMP WITH TIME ZONE     NULL,
    CONSTRAINT pk_payments PRIMARY KEY (id),
    CONSTRAINT uq_payments_order_id UNIQUE (order_id),
    CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

-- =============================================================================
-- Indices para las consultas frecuentes
-- =============================================================================
CREATE INDEX idx_orders_user_id      ON orders (user_id);
CREATE INDEX idx_orders_status       ON orders (status);
CREATE INDEX idx_products_available  ON products (available);
-- Index auxiliar (fuera de la lista de §3): cargar el carrito consulta
-- siempre cart_items por cart_id.
CREATE INDEX idx_cart_items_cart_id  ON cart_items (cart_id);

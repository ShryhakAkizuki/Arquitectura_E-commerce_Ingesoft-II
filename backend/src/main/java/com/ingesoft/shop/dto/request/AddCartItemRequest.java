package com.ingesoft.shop.dto.request;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Petición para agregar un producto al carrito (POST /api/cart/items)
 */
public record AddCartItemRequest(
        @NotNull(message = "El id del producto es obligatorio")
        UUID productId,
        @NotNull(message = "La cantidad es obligatoria")
        @Positive(message = "La cantidad debe ser mayor que cero")
        Integer quantity) {
}

package com.ingesoft.shop.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Petición para cambiar la cantidad de un ítem del carrito (PATCH /api/cart/items/{itemId})
 */
public record UpdateCartItemRequest(
        @NotNull(message = "La cantidad es obligatoria")
        @Positive(message = "La cantidad debe ser mayor que cero")
        Integer quantity) {
}

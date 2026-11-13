package com.ingesoft.shop.dto.request;

import com.ingesoft.shop.enums.OrderStatus;

import jakarta.validation.constraints.NotNull;

/**
 * Petición para cambiar el estado de una orden
 */
public record UpdateOrderStatusRequest(
        @NotNull(message = "El nuevo estado es obligatorio")
        OrderStatus status) {
}

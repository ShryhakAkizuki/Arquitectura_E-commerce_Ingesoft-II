package com.ingesoft.shop.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Cuerpo de la peticion de checkout
 */
public record CheckoutRequest(
        @NotBlank(message = "La direccion de envio es obligatoria")
        @Size(max = 255, message = "La direccion de envio no puede superar 255 caracteres")
        String shippingAddress,
        @NotNull(message = "Los datos de pago son obligatorios")
        @Valid
        PaymentData payment) {
}

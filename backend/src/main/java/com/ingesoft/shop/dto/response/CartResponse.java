package com.ingesoft.shop.dto.response;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.ingesoft.shop.entity.Cart;

/**
 * Vista completa del carrito del usuario
 */
public record CartResponse(
        UUID id,
        List<CartItemResponse> items,
        BigDecimal subtotal) {

    public static CartResponse from(Cart cart) {
        return new CartResponse(cart.getId(),
                cart.getItems().stream().map(CartItemResponse::from).toList(),
                cart.getSubtotal());
    }
}

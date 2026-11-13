package com.ingesoft.shop.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

import com.ingesoft.shop.entity.CartItem;
import com.ingesoft.shop.entity.Product;

/**
 * Vista de un ítem de carrito para el cliente
 */
public record CartItemResponse(
        UUID id,
        UUID productId,
        String productName,
        String imageUrl,
        BigDecimal unitPrice,
        int quantity,
        BigDecimal lineTotal) {

    public static CartItemResponse from(CartItem item) {
        Product product = item.getProduct();
        return new CartItemResponse(item.getId(), product.getId(), product.getName(),
                product.getImageUrl(), item.getUnitPrice(), item.getQuantity(), item.lineTotal());
    }
}

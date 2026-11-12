package com.ingesoft.shop.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.ingesoft.shop.entity.Order;
import com.ingesoft.shop.entity.OrderItem;
import com.ingesoft.shop.enums.OrderStatus;

/**
 * Vista de la orden devuelta al finalizar el checkout
 */
public record OrderResponse(
        UUID id,
        String orderNumber,
        OrderStatus status,
        BigDecimal subtotal,
        BigDecimal shipping,
        BigDecimal total,
        String shippingAddress,
        OffsetDateTime createdAt,
        List<ItemResponse> items) {

    public static OrderResponse from(Order order) {
        List<ItemResponse> items = order.getItems().stream()
                .map(ItemResponse::from)
                .toList();
        return new OrderResponse(order.getId(), order.getOrderNumber(), order.getStatus(),
                order.getSubtotal(), order.getShipping(), order.getTotal(),
                order.getShippingAddress(), order.getCreatedAt(), items);
    }

    public record ItemResponse(
            UUID productId,
            String productName,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal) {

        public static ItemResponse from(OrderItem item) {
            return new ItemResponse(item.getProduct().getId(), item.getProductName(),
                    item.getUnitPrice(), item.getQuantity(), item.lineTotal());
        }
    }
}

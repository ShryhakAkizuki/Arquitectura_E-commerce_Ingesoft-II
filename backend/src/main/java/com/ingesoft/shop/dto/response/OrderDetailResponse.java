package com.ingesoft.shop.dto.response;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.ingesoft.shop.entity.Order;
import com.ingesoft.shop.entity.Payment;
import com.ingesoft.shop.enums.OrderStatus;
import com.ingesoft.shop.enums.PaymentStatus;

/**
 * Detalle de la orden para el propio usuario: incluye ítems y estado del pago
 */
public record OrderDetailResponse(
        UUID id,
        String orderNumber,
        OrderStatus status,
        BigDecimal subtotal,
        BigDecimal shipping,
        BigDecimal total,
        String shippingAddress,
        OffsetDateTime createdAt,
        List<OrderResponse.ItemResponse> items,
        PaymentResponse payment) {

    public static OrderDetailResponse from(Order order, Payment payment) {
        List<OrderResponse.ItemResponse> items = order.getItems().stream()
                .map(OrderResponse.ItemResponse::from)
                .toList();
        return new OrderDetailResponse(order.getId(), order.getOrderNumber(), order.getStatus(),
                order.getSubtotal(), order.getShipping(), order.getTotal(),
                order.getShippingAddress(), order.getCreatedAt(), items,
                payment == null ? null : PaymentResponse.from(payment));
    }

    /**
     * Estado del pago de la orden
     */
    public record PaymentResponse(
            PaymentStatus status,
            String method,
            String transactionId,
            String failureReason,
            OffsetDateTime processedAt) {

        public static PaymentResponse from(Payment payment) {
            return new PaymentResponse(payment.getStatus(), payment.getMethod(),
                    payment.getTransactionId(), payment.getFailureReason(),
                    payment.getProcessedAt());
        }
    }
}

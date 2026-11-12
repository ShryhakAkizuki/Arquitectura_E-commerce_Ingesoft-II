package com.ingesoft.shop.service.impl;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ingesoft.shop.dto.request.UpdateOrderStatusRequest;
import com.ingesoft.shop.dto.response.OrderDetailResponse;
import com.ingesoft.shop.dto.response.OrderResponse;
import com.ingesoft.shop.entity.Order;
import com.ingesoft.shop.entity.Payment;
import com.ingesoft.shop.enums.OrderStatus;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.OrderRepository;
import com.ingesoft.shop.repository.PaymentRepository;
import com.ingesoft.shop.service.IOrderAdminService;

/**
 * Implementación de {@link IOrderAdminService}: listado con filtro por
 * estado y transiciones de estado de las órdenes
 */
@Service
public class OrderAdminServiceImpl implements IOrderAdminService {

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;

    public OrderAdminServiceImpl(OrderRepository orderRepository, PaymentRepository paymentRepository) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<OrderResponse> list(OrderStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Order> orders = status == null
                ? orderRepository.findAllByOrderByCreatedAtDesc(pageable)
                : orderRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
        return orders.map(OrderResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderDetailResponse detail(UUID id) {
        Order order = findOrder(id);
        Payment payment = paymentRepository.findByOrderId(id).orElse(null);
        return OrderDetailResponse.from(order, payment);
    }

    @Override
    @Transactional
    public OrderDetailResponse updateStatus(UUID id, UpdateOrderStatusRequest request) {
        Order order = findOrder(id);
        OrderStatus current = order.getStatus();
        OrderStatus newStatus = request.status();
        validateTransition(current, newStatus);
        order.changeStatus(newStatus);
        if (newStatus == OrderStatus.CANCELLED && current == OrderStatus.PAID) {
            restoreStock(order);
        }
        Payment payment = paymentRepository.findByOrderId(id).orElse(null);
        return OrderDetailResponse.from(order, payment);
    }

    private void validateTransition(OrderStatus from, OrderStatus to) {
        boolean valid = switch (from) {
            case PENDING -> to == OrderStatus.CANCELLED;
            case PAID -> to == OrderStatus.SHIPPED || to == OrderStatus.CANCELLED;
            case SHIPPED -> to == OrderStatus.DELIVERED;
            default -> false;
        };
        if (!valid) {
            throw new BusinessException(ErrorCode.ORDER_STATUS_INVALID,
                    String.format("Transición de estado no permitida: %s → %s", from, to));
        }
    }

    private void restoreStock(Order order) {
        order.getItems().forEach(item -> item.getProduct()
                .setStock(item.getProduct().getStock() + item.getQuantity()));
    }

    private Order findOrder(UUID id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND,
                        "La orden " + id + " no existe"));
    }
}

package com.ingesoft.shop.service.impl;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ingesoft.shop.dto.response.OrderDetailResponse;
import com.ingesoft.shop.dto.response.OrderResponse;
import com.ingesoft.shop.entity.Order;
import com.ingesoft.shop.entity.Payment;
import com.ingesoft.shop.entity.User;
import com.ingesoft.shop.exception.BusinessException;
import com.ingesoft.shop.exception.ErrorCode;
import com.ingesoft.shop.repository.OrderRepository;
import com.ingesoft.shop.repository.PaymentRepository;
import com.ingesoft.shop.repository.UserRepository;
import com.ingesoft.shop.service.IOrderService;

/**
 * Implementación de {@link IOrderService}
 */
@Service
public class OrderServiceImpl implements IOrderService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;

    public OrderServiceImpl(UserRepository userRepository,
            OrderRepository orderRepository,
            PaymentRepository paymentRepository) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<OrderResponse> myOrders(String email, int page, int size) {
        User user = findUserByEmail(email);
        Pageable pageable = PageRequest.of(page, size);
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageable)
                .map(OrderResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderDetailResponse myOrderDetail(String email, UUID id) {
        User user = findUserByEmail(email);
        Order order = orderRepository.findByUserIdAndId(user.getId(), id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND,
                        "La orden " + id + " no existe o no es tuya"));
        Payment payment = paymentRepository.findByOrderId(id).orElse(null);
        return OrderDetailResponse.from(order, payment);
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "No existe un usuario con el email " + email));
    }
}

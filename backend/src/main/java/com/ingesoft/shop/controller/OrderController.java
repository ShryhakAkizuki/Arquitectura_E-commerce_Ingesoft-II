package com.ingesoft.shop.controller;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ingesoft.shop.dto.response.OrderDetailResponse;
import com.ingesoft.shop.dto.response.OrderResponse;
import com.ingesoft.shop.service.IOrderService;

/**
 * Consulta de las ordenes del propio usuario autenticado (R2)
 */
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final IOrderService orderService;

    public OrderController(IOrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/mine")
    public Page<OrderResponse> myOrders(Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return orderService.myOrders(authentication.getName(), page, size);
    }

    @GetMapping("/mine/{id}")
    public OrderDetailResponse myOrderDetail(Authentication authentication,
            @PathVariable UUID id) {
        return orderService.myOrderDetail(authentication.getName(), id);
    }
}

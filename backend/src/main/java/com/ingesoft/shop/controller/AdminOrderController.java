package com.ingesoft.shop.controller;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ingesoft.shop.dto.request.UpdateOrderStatusRequest;
import com.ingesoft.shop.dto.response.OrderDetailResponse;
import com.ingesoft.shop.dto.response.OrderResponse;
import com.ingesoft.shop.enums.OrderStatus;
import com.ingesoft.shop.service.IOrderAdminService;

import jakarta.validation.Valid;

/**
 * Gestion de ordenes para administradores: listado con filtro por estado
 * y cambio de estado
 */
@RestController
@RequestMapping("/api/admin/orders")
@PreAuthorize("hasRole('ADMIN')")
public class AdminOrderController {

    private final IOrderAdminService orderAdminService;

    public AdminOrderController(IOrderAdminService orderAdminService) {
        this.orderAdminService = orderAdminService;
    }

    @GetMapping
    public Page<OrderResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) OrderStatus status) {
        return orderAdminService.list(status, page, size);
    }

    @GetMapping("/{id}")
    public OrderDetailResponse detail(@PathVariable UUID id) {
        return orderAdminService.detail(id);
    }

    @PatchMapping("/{id}/status")
    public OrderDetailResponse updateStatus(@PathVariable UUID id,
            @Valid @RequestBody UpdateOrderStatusRequest request) {
        return orderAdminService.updateStatus(id, request);
    }
}

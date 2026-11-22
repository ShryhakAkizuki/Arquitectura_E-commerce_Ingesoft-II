package com.ingesoft.shop.service;

import java.util.UUID;

import org.springframework.data.domain.Page;

import com.ingesoft.shop.dto.request.UpdateOrderStatusRequest;
import com.ingesoft.shop.dto.response.OrderDetailResponse;
import com.ingesoft.shop.dto.response.OrderResponse;
import com.ingesoft.shop.enums.OrderStatus;

/**
 * Gestión de órdenes para administradores: listado con filtro por estado
 * y transiciones de estado
 */
public interface IOrderAdminService {

    Page<OrderResponse> list(OrderStatus status, int page, int size);

    OrderDetailResponse detail(UUID id);

    OrderDetailResponse updateStatus(UUID id, UpdateOrderStatusRequest request);
}

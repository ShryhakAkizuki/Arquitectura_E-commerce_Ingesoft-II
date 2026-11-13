package com.ingesoft.shop.service;

import java.util.UUID;

import org.springframework.data.domain.Page;

import com.ingesoft.shop.dto.response.OrderDetailResponse;
import com.ingesoft.shop.dto.response.OrderResponse;

/**
 * Consulta de órdenes del propio usuario autenticado
 */
public interface IOrderService {

    Page<OrderResponse> myOrders(String email, int page, int size);

    OrderDetailResponse myOrderDetail(String email, UUID id);
}

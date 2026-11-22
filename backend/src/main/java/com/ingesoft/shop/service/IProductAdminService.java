package com.ingesoft.shop.service;

import java.util.UUID;

import org.springframework.data.domain.Page;

import com.ingesoft.shop.dto.request.AdjustStockRequest;
import com.ingesoft.shop.dto.request.ProductRequest;
import com.ingesoft.shop.dto.response.ProductResponse;

/**
 * Gestión CRUD + stock de productos para administradores
 */
public interface IProductAdminService {

    Page<ProductResponse> listAll(int page, int size, String search, String sort);

    ProductResponse create(ProductRequest request);

    ProductResponse update(UUID id, ProductRequest request);

    ProductResponse deactivate(UUID id);

    ProductResponse adjustStock(UUID id, AdjustStockRequest request);
}

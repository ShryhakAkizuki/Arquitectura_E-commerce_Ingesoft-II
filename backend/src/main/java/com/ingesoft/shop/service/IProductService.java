package com.ingesoft.shop.service;

import java.util.UUID;

import org.springframework.data.domain.Page;

import com.ingesoft.shop.dto.response.ProductResponse;

/**
 * Lectura del catálogo de productos para cualquier visitante
 */
public interface IProductService {

    Page<ProductResponse> list(int page, int size, String search, String sort);

    ProductResponse getById(UUID id);
}

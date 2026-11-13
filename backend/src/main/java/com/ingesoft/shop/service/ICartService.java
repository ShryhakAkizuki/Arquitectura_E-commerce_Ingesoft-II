package com.ingesoft.shop.service;

import java.util.UUID;

import com.ingesoft.shop.dto.request.AddCartItemRequest;
import com.ingesoft.shop.dto.request.UpdateCartItemRequest;
import com.ingesoft.shop.dto.response.CartResponse;

/**
 * Reglas de negocio del carrito de compras
 */
public interface ICartService {

    CartResponse get(String email);


    CartResponse add(String email, AddCartItemRequest request);

    CartResponse updateQuantity(String email, UUID itemId, UpdateCartItemRequest request);

    CartResponse remove(String email, UUID itemId);
}

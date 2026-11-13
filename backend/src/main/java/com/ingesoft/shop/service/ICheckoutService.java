package com.ingesoft.shop.service;

import com.ingesoft.shop.dto.request.CheckoutRequest;
import com.ingesoft.shop.dto.response.OrderResponse;

/**
 * Servicio de checkout: finaliza la compra en un unico flujo.
 */
public interface ICheckoutService {

    OrderResponse checkout(String email, CheckoutRequest request);
}

package com.ingesoft.shop.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ingesoft.shop.dto.request.CheckoutRequest;
import com.ingesoft.shop.dto.response.OrderResponse;
import com.ingesoft.shop.service.ICheckoutService;

import jakarta.validation.Valid;

/**
 * Checkout del usuario autenticado
 */
@RestController
@RequestMapping("/api/checkout")
public class CheckoutController {

    private final ICheckoutService checkoutService;

    public CheckoutController(ICheckoutService checkoutService) {
        this.checkoutService = checkoutService;
    }

    @PostMapping
    public ResponseEntity<OrderResponse> checkout(Authentication authentication,
            @Valid @RequestBody CheckoutRequest request) {
        OrderResponse order = checkoutService.checkout(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(order);
    }
}

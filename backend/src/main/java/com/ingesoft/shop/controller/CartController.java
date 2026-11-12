package com.ingesoft.shop.controller;

import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ingesoft.shop.dto.request.AddCartItemRequest;
import com.ingesoft.shop.dto.request.UpdateCartItemRequest;
import com.ingesoft.shop.dto.response.CartResponse;
import com.ingesoft.shop.service.ICartService;

import jakarta.validation.Valid;

/**
 * Carrito de compras del usuario autenticado
 */
@RestController
@RequestMapping("/api/cart")
public class CartController {

    private final ICartService cartService;

    public CartController(ICartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public CartResponse get(Authentication authentication) {
        return cartService.get(authentication.getName());
    }

    @PostMapping("/items")
    public CartResponse add(Authentication authentication,
            @Valid @RequestBody AddCartItemRequest request) {
        return cartService.add(authentication.getName(), request);
    }

    @PatchMapping("/items/{itemId}")
    public CartResponse updateQuantity(Authentication authentication,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpdateCartItemRequest request) {
        return cartService.updateQuantity(authentication.getName(), itemId, request);
    }

    @DeleteMapping("/items/{itemId}")
    public CartResponse remove(Authentication authentication,
            @PathVariable UUID itemId) {
        return cartService.remove(authentication.getName(), itemId);
    }
}

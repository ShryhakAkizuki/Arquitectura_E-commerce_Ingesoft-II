package com.ingesoft.shop.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ingesoft.shop.dto.request.LoginRequest;
import com.ingesoft.shop.dto.request.RegisterRequest;
import com.ingesoft.shop.dto.response.LoginResponse;
import com.ingesoft.shop.dto.response.UserResponse;
import com.ingesoft.shop.service.IAuthService;

import jakarta.validation.Valid;

/**
 * Exposicion REST de la autenticacion.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final IAuthService authService;

    public AuthController(IAuthService authService) {
        this.authService = authService;
    }

    /**
     * Crea una cuenta nueva
     */
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        UserResponse created = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Inicia sesión y emite el JWT de sesión
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}

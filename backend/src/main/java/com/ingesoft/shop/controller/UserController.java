package com.ingesoft.shop.controller;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ingesoft.shop.dto.request.UpdateProfileRequest;
import com.ingesoft.shop.dto.response.UserResponse;
import com.ingesoft.shop.service.IAuthService;

import jakarta.validation.Valid;

/**
 * Perfil del usuario autenticado.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final IAuthService authService;

    public UserController(IAuthService authService) {
        this.authService = authService;
    }

    /**
     * Devuelve el perfil del usuario autenticado (GET /api/users/me)
     */
    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        return authService.me(authentication.getName());
    }

    /**
     * Actualiza el perfil del usuario autenticado (PUT /api/users/me)
     */
    @PutMapping("/me")
    public UserResponse updateProfile(Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request) {
        return authService.updateProfile(authentication.getName(), request);
    }
}

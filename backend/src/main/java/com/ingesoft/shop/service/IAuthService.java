package com.ingesoft.shop.service;

import com.ingesoft.shop.dto.request.LoginRequest;
import com.ingesoft.shop.dto.request.RegisterRequest;
import com.ingesoft.shop.dto.request.UpdateProfileRequest;
import com.ingesoft.shop.dto.response.LoginResponse;
import com.ingesoft.shop.dto.response.UserResponse;

import com.ingesoft.shop.exception.BusinessException;

/**
 * Reglas de negocio de autenticación
 */
public interface IAuthService {

    UserResponse register(RegisterRequest request);
    LoginResponse login(LoginRequest request);
    UserResponse me(String email);
    UserResponse updateProfile(String email, UpdateProfileRequest request);
}

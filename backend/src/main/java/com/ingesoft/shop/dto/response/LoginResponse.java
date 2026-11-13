package com.ingesoft.shop.dto.response;

public record LoginResponse(String token, UserResponse user) {
}

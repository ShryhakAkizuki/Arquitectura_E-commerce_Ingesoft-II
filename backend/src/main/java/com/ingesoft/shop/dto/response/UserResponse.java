package com.ingesoft.shop.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.ingesoft.shop.entity.User;
import com.ingesoft.shop.enums.Role;

public record UserResponse(
        UUID id,
        String name,
        String email,
        Role role,
        OffsetDateTime createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail(),
                user.getRole(), user.getCreatedAt());
    }
}

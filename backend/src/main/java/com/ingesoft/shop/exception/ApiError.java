package com.ingesoft.shop.exception;

import java.time.Instant;

public record ApiError(int status, String code, String message, String timestamp) {

    public static ApiError of(ErrorCode errorCode, String message) {
        return new ApiError(errorCode.getStatus().value(), errorCode.name(), message,
                Instant.now().toString());
    }
}

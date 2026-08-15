package com.mediverse.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ContactFormRequest(
    @NotBlank(message = "Name is required")
    String name,

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    String email,

    @Pattern(regexp = "^$|^\\d{10}$", message = "Phone number must be exactly 10 digits if provided")
    String phone,

    @NotBlank(message = "Purpose is required")
    String purpose,

    @NotBlank(message = "Message is required")
    String message
) {}

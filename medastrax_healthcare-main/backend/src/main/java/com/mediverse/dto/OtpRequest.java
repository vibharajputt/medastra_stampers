package com.mediverse.dto;

import jakarta.validation.constraints.NotBlank;

public class OtpRequest {

    @NotBlank(message = "Identifier (email/phone) is required")
    private String identifier;

    @NotBlank(message = "Type (EMAIL/PHONE) is required")
    private String type;

    private String otp; // only needed for verify

    public OtpRequest() {}

    public String getIdentifier() { return identifier; }
    public void setIdentifier(String identifier) { this.identifier = identifier; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getOtp() { return otp; }
    public void setOtp(String otp) { this.otp = otp; }
}

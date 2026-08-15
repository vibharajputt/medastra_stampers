package com.mediverse.dto;

public class AuthResponse {

    private String token;
    private String type = "Bearer";
    private Long id;
    private String name;
    private String email;
    private String role;
    private String avatarUrl;
    private String phone;
    private String message;
    private Long hospitalId;

    public AuthResponse() {}

    public AuthResponse(String token, String type, Long id, String name, String email,
                        String role, String avatarUrl, String phone, String message) {
        this(token, type, id, name, email, role, avatarUrl, phone, message, null);
    }

    public AuthResponse(String token, String type, Long id, String name, String email,
                        String role, String avatarUrl, String phone, String message, Long hospitalId) {
        this.token = token;
        this.type = type;
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.avatarUrl = avatarUrl;
        this.phone = phone;
        this.message = message;
        this.hospitalId = hospitalId;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Long getHospitalId() { return hospitalId; }
    public void setHospitalId(Long hospitalId) { this.hospitalId = hospitalId; }

    public static AuthResponseBuilder builder() {
        return new AuthResponseBuilder();
    }

    public static class AuthResponseBuilder {
        private String token;
        private String type = "Bearer";
        private Long id;
        private String name;
        private String email;
        private String role;
        private String avatarUrl;
        private String phone;
        private String message;
        private Long hospitalId;

        public AuthResponseBuilder token(String token) { this.token = token; return this; }
        public AuthResponseBuilder type(String type) { this.type = type; return this; }
        public AuthResponseBuilder id(Long id) { this.id = id; return this; }
        public AuthResponseBuilder name(String name) { this.name = name; return this; }
        public AuthResponseBuilder email(String email) { this.email = email; return this; }
        public AuthResponseBuilder role(String role) { this.role = role; return this; }
        public AuthResponseBuilder avatarUrl(String url) { this.avatarUrl = url; return this; }
        public AuthResponseBuilder phone(String phone) { this.phone = phone; return this; }
        public AuthResponseBuilder message(String message) { this.message = message; return this; }
        public AuthResponseBuilder hospitalId(Long hospitalId) { this.hospitalId = hospitalId; return this; }

        public AuthResponse build() {
            return new AuthResponse(token, type, id, name, email, role, avatarUrl, phone, message, hospitalId);
        }
    }
}

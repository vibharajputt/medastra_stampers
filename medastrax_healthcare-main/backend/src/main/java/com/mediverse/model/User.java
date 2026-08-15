package com.mediverse.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private Long hospitalId;
    private String specialization;
    private String licenseNo;

    private String workingHours;
    private String workingDays;
    private Boolean inPersonConsultation;
    private Boolean onlineConsultation;
    private String fees;

    private String avatarUrl;
    private String address;
    private String city;
    private String upiId;
    private Double rating;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (rating == null) {
            rating = 0.0;
        }
    }

    public enum Role {
        PATIENT, DOCTOR, PHARMACY, HOSPITAL, LAB, ADMIN
    }

    public User() {}

    public User(Long id, String name, String email, String password, String phone,
                Role role, Long hospitalId, String specialization, String licenseNo,
                String workingHours, String workingDays, Boolean inPersonConsultation,
                Boolean onlineConsultation, String fees, String avatarUrl, String address,
                String city, String upiId, Double rating, LocalDateTime createdAt) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.password = password;
        this.phone = phone;
        this.role = role;
        this.hospitalId = hospitalId;
        this.specialization = specialization;
        this.licenseNo = licenseNo;
        this.workingHours = workingHours;
        this.workingDays = workingDays;
        this.inPersonConsultation = inPersonConsultation;
        this.onlineConsultation = onlineConsultation;
        this.fees = fees;
        this.avatarUrl = avatarUrl;
        this.address = address;
        this.city = city;
        this.upiId = upiId;
        this.rating = rating;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public Long getHospitalId() { return hospitalId; }
    public void setHospitalId(Long hospitalId) { this.hospitalId = hospitalId; }

    public String getSpecialization() { return specialization; }
    public void setSpecialization(String specialization) { this.specialization = specialization; }

    public String getLicenseNo() { return licenseNo; }
    public void setLicenseNo(String licenseNo) { this.licenseNo = licenseNo; }

    public String getWorkingHours() { return workingHours; }
    public void setWorkingHours(String workingHours) { this.workingHours = workingHours; }

    public String getWorkingDays() { return workingDays; }
    public void setWorkingDays(String workingDays) { this.workingDays = workingDays; }

    public boolean getInPersonConsultation() {
        return inPersonConsultation != null && inPersonConsultation;
    }
    public void setInPersonConsultation(Boolean inPersonConsultation) {
        this.inPersonConsultation = inPersonConsultation;
    }

    public boolean getOnlineConsultation() {
        return onlineConsultation != null && onlineConsultation;
    }
    public void setOnlineConsultation(Boolean onlineConsultation) {
        this.onlineConsultation = onlineConsultation;
    }

    public String getFees() { return fees; }
    public void setFees(String fees) { this.fees = fees; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getUpiId() { return upiId; }
    public void setUpiId(String upiId) { this.upiId = upiId; }

    public Double getRating() { return rating; }
    public void setRating(Double rating) { this.rating = rating; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static UserBuilder builder() {
        return new UserBuilder();
    }

    public static class UserBuilder {
        private Long id;
        private String name;
        private String email;
        private String password;
        private String phone;
        private Role role;
        private Long hospitalId;
        private String specialization;
        private String licenseNo;
        private String workingHours;
        private String workingDays;
        private Boolean inPersonConsultation;
        private Boolean onlineConsultation;
        private String fees;
        private String avatarUrl;
        private String address;
        private String city;
        private String upiId;
        private Double rating;
        private LocalDateTime createdAt;

        public UserBuilder id(Long id) { this.id = id; return this; }
        public UserBuilder name(String name) { this.name = name; return this; }
        public UserBuilder email(String email) { this.email = email; return this; }
        public UserBuilder password(String password) { this.password = password; return this; }
        public UserBuilder phone(String phone) { this.phone = phone; return this; }
        public UserBuilder role(Role role) { this.role = role; return this; }
        public UserBuilder hospitalId(Long hospitalId) { this.hospitalId = hospitalId; return this; }
        public UserBuilder specialization(String specialization) { this.specialization = specialization; return this; }
        public UserBuilder licenseNo(String licenseNo) { this.licenseNo = licenseNo; return this; }
        public UserBuilder workingHours(String workingHours) { this.workingHours = workingHours; return this; }
        public UserBuilder workingDays(String workingDays) { this.workingDays = workingDays; return this; }
        public UserBuilder inPersonConsultation(Boolean val) { this.inPersonConsultation = val; return this; }
        public UserBuilder onlineConsultation(Boolean val) { this.onlineConsultation = val; return this; }
        public UserBuilder fees(String fees) { this.fees = fees; return this; }
        public UserBuilder avatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; return this; }
        public UserBuilder address(String address) { this.address = address; return this; }
        public UserBuilder city(String city) { this.city = city; return this; }
        public UserBuilder upiId(String upiId) { this.upiId = upiId; return this; }
        public UserBuilder rating(Double rating) { this.rating = rating; return this; }
        public UserBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

        public User build() {
            return new User(id, name, email, password, phone, role, hospitalId,
                    specialization, licenseNo, workingHours, workingDays,
                    inPersonConsultation, onlineConsultation, fees, avatarUrl,
                    address, city, upiId, rating, createdAt);
        }
    }
}

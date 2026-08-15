package com.mediverse.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "hospitals")
public class Hospital {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String registrationNo;
    private String hospitalType;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String address;

    private String city;
    private String state;
    private String pincode;
    private String phone;
    private String email;

    private Double latitude;
    private Double longitude;

    // JSON arrays stored as strings
    @Column(columnDefinition = "TEXT")
    private String images;

    @Column(columnDefinition = "TEXT")
    private String facilities;

    @Column(columnDefinition = "TEXT")
    private String doctorTypes;

    private Integer totalBeds;
    private Integer availableBeds;
    private BigDecimal consultationRate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id")
    private User doctor;

    private Double rating;
    private Boolean verified;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (verified == null) verified = false;
        if (rating == null) rating = 0.0;
    }

    public Hospital() {}

    public Hospital(Long id, String registrationNo, String hospitalType, String name, String address,
                    String city, String state, String pincode, String phone, String email,
                    Double latitude, Double longitude, String images, String facilities,
                    String doctorTypes, Integer totalBeds, Integer availableBeds,
                    BigDecimal consultationRate, User doctor, Double rating,
                    Boolean verified, String description, LocalDateTime createdAt) {
        this.id = id;
        this.registrationNo = registrationNo;
        this.hospitalType = hospitalType;
        this.name = name;
        this.address = address;
        this.city = city;
        this.state = state;
        this.pincode = pincode;
        this.phone = phone;
        this.email = email;
        this.latitude = latitude;
        this.longitude = longitude;
        this.images = images;
        this.facilities = facilities;
        this.doctorTypes = doctorTypes;
        this.totalBeds = totalBeds;
        this.availableBeds = availableBeds;
        this.consultationRate = consultationRate;
        this.doctor = doctor;
        this.rating = rating;
        this.verified = verified;
        this.description = description;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRegistrationNo() { return registrationNo; }
    public void setRegistrationNo(String registrationNo) { this.registrationNo = registrationNo; }

    public String getHospitalType() { return hospitalType; }
    public void setHospitalType(String hospitalType) { this.hospitalType = hospitalType; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getImages() { return images; }
    public void setImages(String images) { this.images = images; }

    public String getFacilities() { return facilities; }
    public void setFacilities(String facilities) { this.facilities = facilities; }

    public String getDoctorTypes() { return doctorTypes; }
    public void setDoctorTypes(String doctorTypes) { this.doctorTypes = doctorTypes; }

    public Integer getTotalBeds() { return totalBeds; }
    public void setTotalBeds(Integer totalBeds) { this.totalBeds = totalBeds; }

    public Integer getAvailableBeds() { return availableBeds; }
    public void setAvailableBeds(Integer availableBeds) { this.availableBeds = availableBeds; }

    public BigDecimal getConsultationRate() { return consultationRate; }
    public void setConsultationRate(BigDecimal consultationRate) { this.consultationRate = consultationRate; }

    public User getDoctor() { return doctor; }
    public void setDoctor(User doctor) { this.doctor = doctor; }

    public Double getRating() { return rating; }
    public void setRating(Double rating) { this.rating = rating; }

    public Boolean getVerified() { return verified; }
    public void setVerified(Boolean verified) { this.verified = verified; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static HospitalBuilder builder() {
        return new HospitalBuilder();
    }

    public static class HospitalBuilder {
        private Long id;
        private String registrationNo;
        private String hospitalType;
        private String name;
        private String address;
        private String city;
        private String state;
        private String pincode;
        private String phone;
        private String email;
        private Double latitude;
        private Double longitude;
        private String images;
        private String facilities;
        private String doctorTypes;
        private Integer totalBeds;
        private Integer availableBeds;
        private BigDecimal consultationRate;
        private User doctor;
        private Double rating;
        private Boolean verified;
        private String description;
        private LocalDateTime createdAt;

        public HospitalBuilder id(Long id) { this.id = id; return this; }
        public HospitalBuilder registrationNo(String v) { this.registrationNo = v; return this; }
        public HospitalBuilder hospitalType(String v) { this.hospitalType = v; return this; }
        public HospitalBuilder name(String name) { this.name = name; return this; }
        public HospitalBuilder address(String address) { this.address = address; return this; }
        public HospitalBuilder city(String city) { this.city = city; return this; }
        public HospitalBuilder state(String state) { this.state = state; return this; }
        public HospitalBuilder pincode(String pincode) { this.pincode = pincode; return this; }
        public HospitalBuilder phone(String phone) { this.phone = phone; return this; }
        public HospitalBuilder email(String email) { this.email = email; return this; }
        public HospitalBuilder latitude(Double latitude) { this.latitude = latitude; return this; }
        public HospitalBuilder longitude(Double longitude) { this.longitude = longitude; return this; }
        public HospitalBuilder images(String images) { this.images = images; return this; }
        public HospitalBuilder facilities(String facilities) { this.facilities = facilities; return this; }
        public HospitalBuilder doctorTypes(String doctorTypes) { this.doctorTypes = doctorTypes; return this; }
        public HospitalBuilder totalBeds(Integer totalBeds) { this.totalBeds = totalBeds; return this; }
        public HospitalBuilder availableBeds(Integer availableBeds) { this.availableBeds = availableBeds; return this; }
        public HospitalBuilder consultationRate(BigDecimal rate) { this.consultationRate = rate; return this; }
        public HospitalBuilder doctor(User doctor) { this.doctor = doctor; return this; }
        public HospitalBuilder rating(Double rating) { this.rating = rating; return this; }
        public HospitalBuilder verified(Boolean verified) { this.verified = verified; return this; }
        public HospitalBuilder description(String description) { this.description = description; return this; }
        public HospitalBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

        public Hospital build() {
            return new Hospital(id, registrationNo, hospitalType, name, address, city, state,
                    pincode, phone, email, latitude, longitude, images, facilities, doctorTypes,
                    totalBeds, availableBeds, consultationRate, doctor, rating, verified,
                    description, createdAt);
        }
    }
}

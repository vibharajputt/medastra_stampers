package com.mediverse.dto;

import java.math.BigDecimal;
import java.util.List;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class HospitalRequest {
    private String registrationNo;
    private String hospitalType;
    private String name;
    private String address;
    private String city;
    private String state;
    private String pincode;

    @NotBlank(message = "Hospital phone number is required")
    @Pattern(regexp = "^\\d{10}$", message = "Hospital phone number must be exactly 10 digits")
    private String phone;
    private String email;
    private Double latitude;
    private Double longitude;
    private List<String> images;
    private List<String> facilities;
    private List<String> doctorTypes;
    private Integer totalBeds;
    private Integer availableBeds;
    private BigDecimal consultationRate;
    private String description;

    public HospitalRequest() {}

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
    public List<String> getImages() { return images; }
    public void setImages(List<String> images) { this.images = images; }
    public List<String> getFacilities() { return facilities; }
    public void setFacilities(List<String> facilities) { this.facilities = facilities; }
    public List<String> getDoctorTypes() { return doctorTypes; }
    public void setDoctorTypes(List<String> doctorTypes) { this.doctorTypes = doctorTypes; }
    public Integer getTotalBeds() { return totalBeds; }
    public void setTotalBeds(Integer totalBeds) { this.totalBeds = totalBeds; }
    public Integer getAvailableBeds() { return availableBeds; }
    public void setAvailableBeds(Integer availableBeds) { this.availableBeds = availableBeds; }
    public BigDecimal getConsultationRate() { return consultationRate; }
    public void setConsultationRate(BigDecimal consultationRate) { this.consultationRate = consultationRate; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}

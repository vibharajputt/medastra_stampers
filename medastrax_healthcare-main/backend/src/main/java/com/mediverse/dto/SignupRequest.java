package com.mediverse.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import java.util.List;

public class SignupRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    @Pattern(regexp = "^$|^\\d{10}$", message = "Phone number must be exactly 10 digits")
    private String phone;

    private String role;
    private String address;
    private String city;

    // doctor fields
    private String specialization;
    private String licenseNo;
    private Long hospitalId;
    private String workingHours;
    private String workingDays;
    private Boolean inPersonConsultation;
    private Boolean onlineConsultation;
    private String fees;

    // pharmacy fields
    private String shopName;
    private String location;

    // patient fields
    private String dob;
    private Integer age;
    private String gender;
    private String bloodGroup;

    @Pattern(regexp = "^$|^\\d{10}$", message = "Emergency contact number must be exactly 10 digits")
    private String emergencyNumber;

    private String preferredLanguage;
    private String existingMedicalCondition;
    private String idProof;
    private String currentMedication;
    private String allergies;
    private String prescriptionReportUrl;
    private Boolean hasConsultedBefore;

    // hospital-specific
    private String profilePhoto;
    private String registrationNo;
    private String hospitalType;
    private String hospitalPreference;
    private String state;
    private String pincode;
    private Integer totalBeds;
    private Integer availableBeds;
    private List<String> images;
    private List<String> facilities;
    private List<String> doctorTypes;

    public SignupRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getSpecialization() { return specialization; }
    public void setSpecialization(String specialization) { this.specialization = specialization; }

    public String getLicenseNo() { return licenseNo; }
    public void setLicenseNo(String licenseNo) { this.licenseNo = licenseNo; }

    public String getShopName() { return shopName; }
    public void setShopName(String shopName) { this.shopName = shopName; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getDob() { return dob; }
    public void setDob(String dob) { this.dob = dob; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }

    public String getEmergencyNumber() { return emergencyNumber; }
    public void setEmergencyNumber(String emergencyNumber) { this.emergencyNumber = emergencyNumber; }

    public String getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(String preferredLanguage) { this.preferredLanguage = preferredLanguage; }

    public String getExistingMedicalCondition() { return existingMedicalCondition; }
    public void setExistingMedicalCondition(String existingMedicalCondition) {
        this.existingMedicalCondition = existingMedicalCondition;
    }

    public String getIdProof() { return idProof; }
    public void setIdProof(String idProof) { this.idProof = idProof; }

    public String getCurrentMedication() { return currentMedication; }
    public void setCurrentMedication(String currentMedication) { this.currentMedication = currentMedication; }

    public String getAllergies() { return allergies; }
    public void setAllergies(String allergies) { this.allergies = allergies; }

    public String getPrescriptionReportUrl() { return prescriptionReportUrl; }
    public void setPrescriptionReportUrl(String prescriptionReportUrl) {
        this.prescriptionReportUrl = prescriptionReportUrl;
    }

    public Boolean getHasConsultedBefore() { return hasConsultedBefore; }
    public void setHasConsultedBefore(Boolean hasConsultedBefore) { this.hasConsultedBefore = hasConsultedBefore; }

    public Long getHospitalId() { return hospitalId; }
    public void setHospitalId(Long hospitalId) { this.hospitalId = hospitalId; }

    public String getWorkingHours() { return workingHours; }
    public void setWorkingHours(String workingHours) { this.workingHours = workingHours; }

    public String getWorkingDays() { return workingDays; }
    public void setWorkingDays(String workingDays) { this.workingDays = workingDays; }

    public Boolean getInPersonConsultation() { return inPersonConsultation; }
    public void setInPersonConsultation(Boolean inPersonConsultation) {
        this.inPersonConsultation = inPersonConsultation;
    }

    public Boolean getOnlineConsultation() { return onlineConsultation; }
    public void setOnlineConsultation(Boolean onlineConsultation) { this.onlineConsultation = onlineConsultation; }

    public String getFees() { return fees; }
    public void setFees(String fees) { this.fees = fees; }

    public String getProfilePhoto() { return profilePhoto; }
    public void setProfilePhoto(String profilePhoto) { this.profilePhoto = profilePhoto; }

    public String getRegistrationNo() { return registrationNo; }
    public void setRegistrationNo(String registrationNo) { this.registrationNo = registrationNo; }

    public String getHospitalType() { return hospitalType; }
    public void setHospitalType(String hospitalType) { this.hospitalType = hospitalType; }

    public String getHospitalPreference() { return hospitalPreference; }
    public void setHospitalPreference(String hospitalPreference) { this.hospitalPreference = hospitalPreference; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }

    public Integer getTotalBeds() { return totalBeds; }
    public void setTotalBeds(Integer totalBeds) { this.totalBeds = totalBeds; }

    public Integer getAvailableBeds() { return availableBeds; }
    public void setAvailableBeds(Integer availableBeds) { this.availableBeds = availableBeds; }

    public List<String> getImages() { return images; }
    public void setImages(List<String> images) { this.images = images; }

    public List<String> getFacilities() { return facilities; }
    public void setFacilities(List<String> facilities) { this.facilities = facilities; }

    public List<String> getDoctorTypes() { return doctorTypes; }
    public void setDoctorTypes(List<String> doctorTypes) { this.doctorTypes = doctorTypes; }
}

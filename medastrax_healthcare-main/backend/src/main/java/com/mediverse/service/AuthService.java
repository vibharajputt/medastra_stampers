package com.mediverse.service;

import com.mediverse.dto.AuthResponse;
import com.mediverse.dto.LoginRequest;
import com.mediverse.dto.SignupRequest;
import com.mediverse.model.User;
import com.mediverse.model.PatientProfile;
import com.mediverse.model.Hospital;
import com.mediverse.model.Booking;
import com.mediverse.model.Order;
import com.mediverse.model.LabBooking;
import com.mediverse.repository.UserRepository;
import com.mediverse.repository.PatientProfileRepository;
import com.mediverse.repository.HospitalRepository;
import com.mediverse.repository.BookingRepository;
import com.mediverse.repository.OrderRepository;
import com.mediverse.repository.LabBookingRepository;
import com.mediverse.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.HashMap;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PatientProfileRepository patientProfileRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private LabBookingRepository labBookingRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtTokenProvider tokenProvider;

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    private String toJson(java.util.List<String> list) {
        try {
            return list != null ? objectMapper.writeValueAsString(list) : "[]";
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            return "[]";
        }
    }

    public AuthResponse signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered!");
        }

        User.Role role = User.Role.valueOf(request.getRole().toUpperCase());

        String avatarUrl = request.getProfilePhoto();
        if (role == User.Role.HOSPITAL && request.getImages() != null && !request.getImages().isEmpty()) {
            avatarUrl = request.getImages().get(0);
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .role(role)
                .address(request.getAddress())
                .city(request.getCity())
                .avatarUrl(avatarUrl)
                .hospitalId(role == User.Role.DOCTOR || role == User.Role.PHARMACY ? request.getHospitalId() : null)
                .specialization(role == User.Role.DOCTOR ? request.getSpecialization() : null)
                .licenseNo(role == User.Role.DOCTOR || role == User.Role.PHARMACY ? request.getLicenseNo() : null)
                .workingHours(role == User.Role.DOCTOR ? request.getWorkingHours() : null)
                .workingDays(role == User.Role.DOCTOR ? request.getWorkingDays() : null)
                .inPersonConsultation(role == User.Role.DOCTOR ? request.getInPersonConsultation() : null)
                .onlineConsultation(role == User.Role.DOCTOR ? request.getOnlineConsultation() : null)
                .fees(role == User.Role.DOCTOR ? request.getFees() : null)
                .build();

        user = userRepository.save(user);

        if (user.getRole() == User.Role.PATIENT) {
            PatientProfile profile = new PatientProfile();
            profile.setUser(user);
            profile.setDob(request.getDob());
            profile.setAge(request.getAge());
            profile.setGender(request.getGender());
            profile.setBloodGroup(request.getBloodGroup());
            profile.setEmergencyNumber(request.getEmergencyNumber());
            profile.setPreferredLanguage(request.getPreferredLanguage());
            profile.setExistingMedicalCondition(request.getExistingMedicalCondition());
            profile.setIdProof(request.getIdProof());
            profile.setCurrentMedication(request.getCurrentMedication());
            profile.setAllergies(request.getAllergies());
            profile.setPrescriptionReportUrl(request.getPrescriptionReportUrl());
            profile.setIsFirstTimeUser(request.getHasConsultedBefore() != null ? request.getHasConsultedBefore() : false);
            profile.setHospitalPreference(request.getHospitalPreference());
            patientProfileRepository.save(profile);
        } else if (user.getRole() == User.Role.HOSPITAL) {
            Hospital hospital = Hospital.builder()
                    .registrationNo(request.getRegistrationNo())
                    .hospitalType(request.getHospitalType())
                    .name(user.getName())
                    .address(request.getAddress() != null ? request.getAddress() : user.getAddress())
                    .city(request.getCity() != null ? request.getCity() : user.getCity())
                    .state(request.getState())
                    .pincode(request.getPincode())
                    .phone(user.getPhone())
                    .email(user.getEmail())
                    .totalBeds(request.getTotalBeds())
                    .availableBeds(request.getAvailableBeds() != null ? request.getAvailableBeds() : request.getTotalBeds())
                    .images(toJson(request.getImages()))
                    .facilities(toJson(request.getFacilities()))
                    .doctorTypes(toJson(request.getDoctorTypes()))
                    .doctor(user)
                    .build();
            hospital = hospitalRepository.save(hospital);
            user.setHospitalId(hospital.getId());
            user = userRepository.save(user);
        }

        String token = tokenProvider.generateTokenFromEmail(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .hospitalId(user.getHospitalId())
                .message("Registration successful!")
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(), request.getPassword()));

        String token = tokenProvider.generateToken(authentication);

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .hospitalId(user.getHospitalId())
                .message("Login successful!")
                .build();
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public PatientProfile getPatientProfile(Long userId) {
        return patientProfileRepository.findByUserId(userId).orElse(null);
    }

    public void updateAvatarUrl(String email, String avatarUrl) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setAvatarUrl(avatarUrl);
        userRepository.save(user);
    }

    public void resetPassword(String email, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No account found with this email address."));
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public AuthResponse googleLogin(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Account not found. Please sign up first to access your MedAstraX portal! ✨"));

        String token = tokenProvider.generateTokenFromEmail(user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .message("Login successful!")
                .build();
    }

    public java.util.Map<String, Object> verifyUpiId(String upiId) {
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        if (upiId != null && upiId.contains("@")) {
            response.put("valid", true);
            response.put("verified", true);
            response.put("name", "MedAstraX Verified Patient");
            response.put("bankName", "State Bank of India");
        } else {
            response.put("valid", false);
            response.put("verified", false);
            response.put("message", "Invalid UPI ID. Must contain '@'.");
        }
        return response;
    }

    public void updatePatientProfile(Long userId, Map<String, Object> request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (request.containsKey("phone")) {
            String phone = (String) request.get("phone");
            if (phone != null && !phone.trim().isEmpty()) {
                if (!phone.trim().matches("^\\d{10}$")) {
                    throw new RuntimeException("Phone number must be exactly 10 digits");
                }
            }
        }

        if (request.containsKey("emergencyNumber")) {
            String emergencyNumber = (String) request.get("emergencyNumber");
            if (emergencyNumber != null && !emergencyNumber.trim().isEmpty()) {
                if (!emergencyNumber.trim().matches("^\\d{10}$")) {
                    throw new RuntimeException("Emergency contact number must be exactly 10 digits");
                }
            }
        }
        
        if (request.containsKey("name")) user.setName((String) request.get("name"));
        if (request.containsKey("phone")) user.setPhone((String) request.get("phone"));
        if (request.containsKey("city")) user.setCity((String) request.get("city"));
        if (request.containsKey("address")) user.setAddress((String) request.get("address"));
        userRepository.save(user);

        if (user.getRole() == User.Role.PATIENT) {
            PatientProfile profile = patientProfileRepository.findByUserId(userId)
                    .orElseGet(() -> {
                        PatientProfile p = new PatientProfile();
                        p.setUser(user);
                        return p;
                    });
            
            if (request.containsKey("dob")) profile.setDob((String) request.get("dob"));
            if (request.containsKey("age")) {
                Object ageObj = request.get("age");
                if (ageObj != null) {
                    if (ageObj instanceof Integer) {
                        profile.setAge((Integer) ageObj);
                    } else {
                        profile.setAge(Integer.parseInt(ageObj.toString()));
                    }
                }
            }
            if (request.containsKey("gender")) profile.setGender((String) request.get("gender"));
            if (request.containsKey("bloodGroup")) profile.setBloodGroup((String) request.get("bloodGroup"));
            if (request.containsKey("emergencyNumber")) profile.setEmergencyNumber((String) request.get("emergencyNumber"));
            if (request.containsKey("preferredLanguage")) profile.setPreferredLanguage((String) request.get("preferredLanguage"));
            if (request.containsKey("existingMedicalCondition")) profile.setExistingMedicalCondition((String) request.get("existingMedicalCondition"));
            if (request.containsKey("idProof")) profile.setIdProof((String) request.get("idProof"));
            if (request.containsKey("currentMedication")) profile.setCurrentMedication((String) request.get("currentMedication"));
            if (request.containsKey("allergies")) profile.setAllergies((String) request.get("allergies"));
            if (request.containsKey("isFirstTimeUser")) {
                Object firstTimeObj = request.get("isFirstTimeUser");
                if (firstTimeObj != null) {
                    profile.setIsFirstTimeUser(Boolean.parseBoolean(firstTimeObj.toString()));
                }
            }
            if (request.containsKey("hospitalPreference")) {
                profile.setHospitalPreference((String) request.get("hospitalPreference"));
            }
            patientProfileRepository.save(profile);
        }
    }

    public java.util.List<java.util.Map<String, Object>> getUsersByRole(User.Role role) {
        java.util.List<User> users = userRepository.findByRole(role);
        java.util.List<java.util.Map<String, Object>> responseList = new java.util.ArrayList<>();
        for (User u : users) {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", u.getId());
            map.put("name", u.getName());
            map.put("email", u.getEmail());
            map.put("phone", u.getPhone());
            map.put("role", u.getRole().name());
            map.put("city", u.getCity());
            map.put("address", u.getAddress());
            map.put("avatarUrl", u.getAvatarUrl());
            map.put("hospitalId", u.getHospitalId());
            map.put("specialization", u.getSpecialization());
            map.put("licenseNo", u.getLicenseNo());
            map.put("workingHours", u.getWorkingHours());
            map.put("workingDays", u.getWorkingDays());
            map.put("fees", u.getFees());
            map.put("rating", u.getRating());
            responseList.add(map);
        }
        return responseList;
    }

    public java.util.List<java.util.Map<String, Object>> getAllBookings() {
        java.util.List<Booking> bookings = bookingRepository.findAll();
        java.util.List<java.util.Map<String, Object>> responseList = new java.util.ArrayList<>();
        for (Booking b : bookings) {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", b.getId());
            map.put("patientId", b.getPatient().getId());
            map.put("patientName", b.getPatientName());
            map.put("patientPhone", b.getPatientPhone());
            map.put("doctorId", b.getDoctor().getId());
            map.put("doctorName", b.getDoctor().getName());
            map.put("hospitalId", b.getHospital().getId());
            map.put("hospitalName", b.getHospital().getName());
            map.put("bookingDate", b.getBookingDate().toString());
            map.put("timeSlot", b.getTimeSlot());
            map.put("status", b.getStatus().name());
            map.put("type", b.getType().name());
            map.put("paymentMethod", b.getPaymentMethod());
            map.put("paymentStatus", b.getPaymentStatus());
            map.put("createdAt", b.getCreatedAt() != null ? b.getCreatedAt().toString() : null);
            responseList.add(map);
        }
        return responseList;
    }

    public java.util.List<java.util.Map<String, Object>> getAllOrders() {
        java.util.List<Order> orders = orderRepository.findAll();
        java.util.List<java.util.Map<String, Object>> responseList = new java.util.ArrayList<>();
        for (Order o : orders) {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", o.getId());
            map.put("patientId", o.getPatient().getId());
            map.put("patientName", o.getPatient().getName());
            map.put("pharmacyName", o.getPharmacyName());
            map.put("medicinesJson", o.getMedicinesJson());
            map.put("status", o.getStatus());
            map.put("deliveryAddress", o.getDeliveryAddress());
            map.put("estimatedEtaMinutes", o.getEstimatedEtaMinutes());
            map.put("medicineAmount", o.getMedicineAmount());
            map.put("deliveryCharges", o.getDeliveryCharges());
            map.put("totalAmount", o.getTotalAmount());
            map.put("createdAt", o.getCreatedAt() != null ? o.getCreatedAt().toString() : null);
            responseList.add(map);
        }
        return responseList;
    }

    public java.util.List<java.util.Map<String, Object>> getAllLabBookings() {
        java.util.List<LabBooking> bookings = labBookingRepository.findAll();
        java.util.List<java.util.Map<String, Object>> responseList = new java.util.ArrayList<>();
        for (LabBooking lb : bookings) {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", lb.getId());
            map.put("patientId", lb.getPatient().getId());
            map.put("patientName", lb.getPatient().getName());
            map.put("labName", lb.getLabName());
            map.put("testsJson", lb.getTestsJson());
            map.put("status", lb.getStatus());
            map.put("deliveryAddress", lb.getDeliveryAddress());
            map.put("estimatedEtaMinutes", lb.getEstimatedEtaMinutes());
            map.put("testAmount", lb.getTestAmount());
            map.put("collectionCharges", lb.getCollectionCharges());
            map.put("totalAmount", lb.getTotalAmount());
            map.put("prescriptionId", lb.getPrescriptionId());
            map.put("createdAt", lb.getCreatedAt() != null ? lb.getCreatedAt().toString() : null);
            responseList.add(map);
        }
        return responseList;
    }
}

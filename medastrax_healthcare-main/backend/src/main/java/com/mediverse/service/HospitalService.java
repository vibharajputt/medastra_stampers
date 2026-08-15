package com.mediverse.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediverse.dto.HospitalRequest;
import com.mediverse.dto.HospitalResponse;
import com.mediverse.model.Hospital;
import com.mediverse.model.User;
import com.mediverse.repository.HospitalRepository;
import com.mediverse.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class HospitalService {

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private UserRepository userRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public HospitalResponse createHospital(HospitalRequest request, Long doctorId) {
        User doctor = userRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        Hospital hospital = Hospital.builder()
                .registrationNo(request.getRegistrationNo())
                .hospitalType(request.getHospitalType())
                .name(request.getName())
                .address(request.getAddress())
                .city(request.getCity())
                .state(request.getState())
                .pincode(request.getPincode())
                .phone(request.getPhone())
                .email(request.getEmail())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .images(toJson(request.getImages()))
                .facilities(toJson(request.getFacilities()))
                .doctorTypes(toJson(request.getDoctorTypes()))
                .totalBeds(request.getTotalBeds())
                .availableBeds(request.getAvailableBeds())
                .consultationRate(request.getConsultationRate())
                .description(request.getDescription())
                .doctor(doctor)
                .build();

        hospital = hospitalRepository.save(hospital);
        return toResponse(hospital);
    }

    public HospitalResponse updateHospital(Long hospitalId, HospitalRequest request, Long doctorId) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        if (!hospital.getDoctor().getId().equals(doctorId)) {
            throw new RuntimeException("Unauthorized: You don't own this hospital");
        }

        hospital.setRegistrationNo(request.getRegistrationNo());
        hospital.setHospitalType(request.getHospitalType());
        hospital.setName(request.getName());
        hospital.setAddress(request.getAddress());
        hospital.setCity(request.getCity());
        hospital.setState(request.getState());
        hospital.setPincode(request.getPincode());
        hospital.setPhone(request.getPhone());
        hospital.setEmail(request.getEmail());
        hospital.setLatitude(request.getLatitude());
        hospital.setLongitude(request.getLongitude());
        hospital.setImages(toJson(request.getImages()));
        hospital.setFacilities(toJson(request.getFacilities()));
        hospital.setDoctorTypes(toJson(request.getDoctorTypes()));
        hospital.setTotalBeds(request.getTotalBeds());
        hospital.setAvailableBeds(request.getAvailableBeds());
        hospital.setConsultationRate(request.getConsultationRate());
        hospital.setDescription(request.getDescription());

        hospital = hospitalRepository.save(hospital);
        return toResponse(hospital);
    }

    public List<HospitalResponse> getAllHospitals() {
        return hospitalRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public HospitalResponse getHospitalById(Long id) {
        Hospital hospital = hospitalRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Hospital not found"));
        return toResponse(hospital);
    }

    public List<HospitalResponse> getHospitalsByDoctor(Long doctorId) {
        return hospitalRepository.findByDoctorId(doctorId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<HospitalResponse> searchHospitals(String query) {
        List<Hospital> results = new ArrayList<>();
        results.addAll(hospitalRepository.findByNameContainingIgnoreCase(query));
        results.addAll(hospitalRepository.findByCityContainingIgnoreCase(query));
        return results.stream()
                .distinct()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public void updateBedAvailability(Long hospitalId, Integer availableBeds, Long doctorId) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        if (!hospital.getDoctor().getId().equals(doctorId)) {
            throw new RuntimeException("Unauthorized");
        }

        hospital.setAvailableBeds(availableBeds);
        hospitalRepository.save(hospital);
    }

    public List<java.util.Map<String, Object>> getDoctorsByHospital(Long hospitalId) {
        return userRepository.findByHospitalIdAndRole(hospitalId, User.Role.DOCTOR).stream()
                .map(u -> {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id", u.getId());
                    map.put("name", u.getName());
                    map.put("email", u.getEmail());
                    map.put("phone", u.getPhone());
                    map.put("specialization", u.getSpecialization());
                    map.put("workingHours", u.getWorkingHours());
                    map.put("workingDays", u.getWorkingDays());
                    map.put("avatarUrl", u.getAvatarUrl());
                    map.put("fees", u.getFees());
                    map.put("rating", u.getRating());
                    return map;
                })
                .collect(Collectors.toList());
    }

    private HospitalResponse toResponse(Hospital hospital) {
        HospitalResponse response = new HospitalResponse();
        response.setId(hospital.getId());
        response.setRegistrationNo(hospital.getRegistrationNo());
        response.setHospitalType(hospital.getHospitalType());
        response.setName(hospital.getName());
        response.setAddress(hospital.getAddress());
        response.setCity(hospital.getCity());
        response.setState(hospital.getState());
        response.setPincode(hospital.getPincode());
        response.setPhone(hospital.getPhone());
        response.setEmail(hospital.getEmail());
        response.setLatitude(hospital.getLatitude());
        response.setLongitude(hospital.getLongitude());
        response.setImages(fromJson(hospital.getImages()));
        response.setFacilities(fromJson(hospital.getFacilities()));
        response.setDoctorTypes(fromJson(hospital.getDoctorTypes()));
        response.setTotalBeds(hospital.getTotalBeds());
        response.setAvailableBeds(hospital.getAvailableBeds());
        response.setConsultationRate(hospital.getConsultationRate());
        response.setRating(hospital.getRating());
        response.setVerified(hospital.getVerified());
        response.setDescription(hospital.getDescription());
        response.setDoctorId(hospital.getDoctor().getId());
        response.setDoctorName(hospital.getDoctor().getName());
        return response;
    }

    private String toJson(List<String> list) {
        try {
            return list != null ? objectMapper.writeValueAsString(list) : "[]";
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private List<String> fromJson(String json) {
        try {
            return json != null ? objectMapper.readValue(json, new TypeReference<List<String>>() {}) : new ArrayList<>();
        } catch (JsonProcessingException e) {
            return new ArrayList<>();
        }
    }

    public HospitalResponse verifyHospital(Long hospitalId, Boolean verified) {
        Hospital hospital = hospitalRepository.findById(hospitalId)
                .orElseThrow(() -> new RuntimeException("Hospital not found"));
        hospital.setVerified(verified);
        hospital = hospitalRepository.save(hospital);
        return toResponse(hospital);
    }
}

package com.mediverse.controller;

import com.mediverse.dto.ApiResponse;
import com.mediverse.dto.HospitalRequest;
import com.mediverse.dto.HospitalResponse;
import com.mediverse.model.User;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.HospitalService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/hospitals")
public class HospitalController {

    @Autowired
    private HospitalService hospitalService;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @GetMapping
    public ResponseEntity<List<HospitalResponse>> getAllHospitals() {
        return ResponseEntity.ok(hospitalService.getAllHospitals());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getHospitalById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(hospitalService.getHospitalById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/search")
    public ResponseEntity<List<HospitalResponse>> searchHospitals(@RequestParam String query) {
        return ResponseEntity.ok(hospitalService.searchHospitals(query));
    }

    @GetMapping("/doctor/{doctorId}")
    public ResponseEntity<List<HospitalResponse>> getHospitalsByDoctor(@PathVariable Long doctorId) {
        return ResponseEntity.ok(hospitalService.getHospitalsByDoctor(doctorId));
    }

    @GetMapping("/{id}/doctors")
    public ResponseEntity<?> getDoctorsByHospital(@PathVariable Long id) {
        return ResponseEntity.ok(hospitalService.getDoctorsByHospital(id));
    }

    @PostMapping
    public ResponseEntity<?> createHospital(
            @Valid @RequestBody HospitalRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long doctorId = extractUserId(authHeader);
            HospitalResponse response = hospitalService.createHospital(request, doctorId);
            return ResponseEntity.ok(ApiResponse.success("Hospital created successfully", response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateHospital(
            @PathVariable Long id,
            @Valid @RequestBody HospitalRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long doctorId = extractUserId(authHeader);
            HospitalResponse response = hospitalService.updateHospital(id, request, doctorId);
            return ResponseEntity.ok(ApiResponse.success("Hospital updated successfully", response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{id}/beds")
    public ResponseEntity<?> updateBeds(
            @PathVariable Long id,
            @RequestParam Integer availableBeds,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long doctorId = extractUserId(authHeader);
            hospitalService.updateBedAvailability(id, availableBeds, doctorId);
            return ResponseEntity.ok(ApiResponse.success("Bed availability updated"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{id}/verify")
    public ResponseEntity<?> verifyHospital(
            @PathVariable Long id,
            @RequestParam Boolean verified) {
        try {
            HospitalResponse response = hospitalService.verifyHospital(id, verified);
            return ResponseEntity.ok(ApiResponse.success("Hospital verification updated", response));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private Long extractUserId(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = tokenProvider.getEmailFromToken(token);
        User user = authService.getUserByEmail(email);
        return user.getId();
    }
}

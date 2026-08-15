package com.mediverse.controller;

import com.mediverse.dto.ApiResponse;
import com.mediverse.model.PharmacyMedicine;
import com.mediverse.model.User;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.PharmacyService;
import com.mediverse.dto.PharmacyPriceRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/pharmacy")
public class PharmacyController {

    @Autowired
    private PharmacyService pharmacyService;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @PostMapping("/prices")
    public ResponseEntity<?> setPrices(
            @RequestBody PharmacyPriceRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long pharmacyId = extractUserId(authHeader);
            List<PharmacyMedicine> medicines = pharmacyService.setPrices(request, pharmacyId);
            return ResponseEntity.ok(ApiResponse.success("Prices set successfully",
                    medicines.stream().map(this::toMap).collect(Collectors.toList())));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/medicines")
    public ResponseEntity<?> getPharmacyMedicines(@RequestHeader("Authorization") String authHeader) {
        try {
            Long pharmacyId = extractUserId(authHeader);
            List<PharmacyMedicine> medicines = pharmacyService.getPharmacyMedicines(pharmacyId);
            return ResponseEntity.ok(medicines.stream().map(this::toMap).collect(Collectors.toList()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/prescription/{prescriptionId}")
    public ResponseEntity<?> getPharmaciesForPrescription(@PathVariable Long prescriptionId) {
        try {
            Map<String, Object> result = pharmacyService.getPharmaciesForPrescription(prescriptionId);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllPharmacies() {
        List<User> pharmacies = pharmacyService.getAllPharmacies();
        return ResponseEntity.ok(pharmacies.stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            m.put("email", p.getEmail());
            m.put("phone", p.getPhone());
            m.put("address", p.getAddress());
            m.put("city", p.getCity());
            m.put("licenseNo", p.getLicenseNo());
            return m;
        }).collect(Collectors.toList()));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestBody Map<String, String> profileData,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long pharmacyId = extractUserId(authHeader);
            pharmacyService.updatePharmacyProfile(pharmacyId, profileData);
            return ResponseEntity.ok(ApiResponse.success("Profile updated successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private Map<String, Object> toMap(PharmacyMedicine pm) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", pm.getId());
        m.put("medicineName", pm.getMedicineName());
        m.put("sellingPrice", pm.getSellingPrice());
        m.put("available", pm.getAvailable());
        m.put("prescriptionId", pm.getPrescription().getId());
        return m;
    }

    private Long extractUserId(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = tokenProvider.getEmailFromToken(token);
        return authService.getUserByEmail(email).getId();
    }
}

package com.mediverse.controller;

import com.mediverse.dto.ApiResponse;
import com.mediverse.model.LabBooking;
import com.mediverse.model.User;
import com.mediverse.repository.PrescriptionRepository;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.LabBookingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/labs")
public class LabController {

    @Autowired
    private LabBookingService labBookingService;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @GetMapping("/all")
    public ResponseEntity<?> getAllLabs() {
        List<User> labs = labBookingService.getAllLabs();
        return ResponseEntity.ok(labs.stream().map(l -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", l.getId());
            m.put("name", l.getName());
            m.put("email", l.getEmail());
            m.put("phone", l.getPhone());
            m.put("address", l.getAddress());
            m.put("city", l.getCity());
            m.put("licenseNo", l.getLicenseNo());
            return m;
        }).collect(Collectors.toList()));
    }

    @PostMapping("/bookings")
    public ResponseEntity<?> createBooking(
            @RequestBody Map<String, Object> payload,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractUserId(authHeader);
            String labName = (String) payload.get("labName");
            String testsJson = (String) payload.get("testsJson");
            String deliveryAddress = (String) payload.get("deliveryAddress");

            Double testAmount = payload.get("testAmount") != null
                    ? ((Number) payload.get("testAmount")).doubleValue() : null;
            Double collectionCharges = payload.get("collectionCharges") != null
                    ? ((Number) payload.get("collectionCharges")).doubleValue() : null;
            Double totalAmount = payload.get("totalAmount") != null
                    ? ((Number) payload.get("totalAmount")).doubleValue() : null;
            Long prescriptionId = payload.get("prescriptionId") != null
                    ? ((Number) payload.get("prescriptionId")).longValue() : null;

            LabBooking booking = labBookingService.createBooking(patientId, labName, testsJson,
                    deliveryAddress, testAmount, collectionCharges, totalAmount, prescriptionId);
            return ResponseEntity.ok(ApiResponse.success("Booking created successfully", toMap(booking)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/bookings/lab")
    public ResponseEntity<?> getLabBookings(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String email = tokenProvider.getEmailFromToken(token);
            User labUser = authService.getUserByEmail(email);
            List<LabBooking> bookings = labBookingService.getBookingsByLab(labUser.getName());
            return ResponseEntity.ok(bookings.stream().map(this::toMap).collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/bookings/patient")
    public ResponseEntity<?> getPatientBookings(@RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractUserId(authHeader);
            List<LabBooking> bookings = labBookingService.getBookingsByPatient(patientId);
            return ResponseEntity.ok(bookings.stream().map(this::toMap).collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/bookings/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String status = payload.get("status");
            LabBooking booking = labBookingService.updateStatus(id, status);
            return ResponseEntity.ok(ApiResponse.success("Booking status updated", toMap(booking)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private Map<String, Object> toMap(LabBooking booking) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", booking.getId());
        m.put("prescriptionId", booking.getPrescriptionId());
        m.put("patientId", booking.getPatient().getId());
        m.put("patientName", booking.getPatient().getName());
        m.put("labName", booking.getLabName());
        m.put("tests", booking.getTestsJson());
        m.put("status", booking.getStatus());
        m.put("deliveryAddress", booking.getDeliveryAddress());
        m.put("createdAt", booking.getCreatedAt().toString());
        m.put("testAmount", booking.getTestAmount());
        m.put("collectionCharges", booking.getCollectionCharges());
        m.put("totalAmount", booking.getTotalAmount());

        if (booking.getPrescriptionId() != null) {
            prescriptionRepository.findById(booking.getPrescriptionId()).ifPresent(p -> {
                if (p.getDoctor() != null) {
                    m.put("doctorName", p.getDoctor().getName());
                }
                m.put("reportUrls", p.getReportUrls());
                m.put("aiSummary", p.getAiSummary());
            });
        }
        return m;
    }

    private Long extractUserId(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = tokenProvider.getEmailFromToken(token);
        return authService.getUserByEmail(email).getId();
    }
}

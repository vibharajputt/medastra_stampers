package com.mediverse.controller;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import com.mediverse.dto.ApiResponse;
import com.mediverse.dto.BookingRequest;
import com.mediverse.model.Booking;
import com.mediverse.model.User;
import com.mediverse.model.PatientProfile;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.ActivityLogService;
import com.mediverse.model.ActivityLog;
import com.mediverse.service.AuthService;
import com.mediverse.service.BookingService;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    @Autowired
    private BookingService bookingService;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private ActivityLogService activityLogService;

    @PostMapping
    public ResponseEntity<?> createBooking(
            @Valid @RequestBody BookingRequest request,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractUserId(authHeader);
            Booking booking = bookingService.createBooking(request, patientId);

            activityLogService.log(patientId, ActivityLog.EventType.BOOKING_CREATED,
                    "Booked appointment with Dr. " + booking.getDoctor().getName() +
                    " at " + booking.getHospital().getName() +
                    " on " + booking.getBookingDate(), booking.getId(), "BOOKING");

            Map<String, Object> data = new HashMap<>();
            data.put("id", booking.getId());
            data.put("bookingDate", booking.getBookingDate());
            data.put("timeSlot", booking.getTimeSlot());
            data.put("type", booking.getType());
            data.put("status", booking.getStatus());
            data.put("hospitalName", booking.getHospital().getName());
            data.put("doctorName", booking.getDoctor().getName());
            data.put("patientName", booking.getPatientName());

            return ResponseEntity.ok(ApiResponse.success("Booking created successfully! Confirmation email sent.", data));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getBookingById(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Booking booking = bookingService.getBookingById(id);
            return ResponseEntity.ok(toMap(booking));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/patient")
    public ResponseEntity<?> getPatientBookings(
            @RequestParam(required = false) Long familyMemberId,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractUserId(authHeader);
            List<Booking> bookings = bookingService.getPatientBookings(patientId, familyMemberId);
            return ResponseEntity.ok(bookings.stream().map(this::toMap).collect(Collectors.toList()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/doctor")
    public ResponseEntity<?> getDoctorBookings(@RequestHeader("Authorization") String authHeader) {
        try {
            Long doctorId = extractUserId(authHeader);
            List<Booking> bookings = bookingService.getDoctorBookings(doctorId);
            return ResponseEntity.ok(bookings.stream().map(this::toMap).collect(Collectors.toList()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = extractUserId(authHeader);
            bookingService.updateBookingStatus(id, status, userId);
            return ResponseEntity.ok(ApiResponse.success("Booking status updated to " + status));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{id}/reschedule")
    public ResponseEntity<?> rescheduleBooking(
            @PathVariable Long id,
            @RequestParam String date,
            @RequestParam String timeSlot,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = extractUserId(authHeader);
            LocalDate newDate = LocalDate.parse(date);
            Booking booking = bookingService.rescheduleBooking(id, newDate, timeSlot, userId);
            return ResponseEntity.ok(ApiResponse.success("Booking rescheduled successfully!", toMap(booking)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{id}/meeting-link")
    public ResponseEntity<?> updateMeetingLink(
            @PathVariable Long id,
            @RequestParam String meetingLink,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Booking booking = bookingService.updateMeetingLink(id, meetingLink);
            return ResponseEntity.ok(ApiResponse.success("Meeting link updated successfully!", toMap(booking)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{id}/ai-report")
    public ResponseEntity<?> updateAiReport(
            @PathVariable Long id,
            @RequestBody Map<String, String> requestBody,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String aiReport = requestBody.getOrDefault("aiReport", "").trim();
            Booking booking = bookingService.updateAiReport(id, aiReport);
            return ResponseEntity.ok(ApiResponse.success("AI Report updated successfully!", toMap(booking)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/slots")
    public ResponseEntity<?> getAvailableSlots(
            @RequestParam Long doctorId,
            @RequestParam String date) {
        try {
            LocalDate bookingDate = LocalDate.parse(date);
            List<String> slots = bookingService.getAvailableTimeSlots(doctorId, bookingDate);
            return ResponseEntity.ok(slots);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private Map<String, Object> toMap(Booking booking) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", booking.getId());
        map.put("patientId", booking.getPatient().getId());
        map.put("bookingDate", booking.getBookingDate());
        map.put("timeSlot", booking.getTimeSlot());
        map.put("type", booking.getType());
        map.put("status", booking.getStatus());
        map.put("notes", booking.getNotes());
        map.put("patientName", booking.getPatientName());
        map.put("patientPhone", booking.getPatientPhone());
        map.put("age", booking.getAge());
        map.put("gender", booking.getGender());

        if (booking.getFamilyMember() != null) {
            map.put("familyMemberId", booking.getFamilyMember().getId());
            map.put("familyMemberName", booking.getFamilyMember().getName());
        }

        map.put("symptoms", booking.getSymptoms());
        map.put("paymentMethod", booking.getPaymentMethod());
        map.put("paymentStatus", booking.getPaymentStatus());
        map.put("hospitalId", booking.getHospital().getId());
        map.put("hospitalName", booking.getHospital().getName());
        map.put("doctorId", booking.getDoctor().getId());
        map.put("doctorName", booking.getDoctor().getName());
        map.put("createdAt", booking.getCreatedAt());

        String link = booking.getMeetingLink();
        if (link != null && link.contains("meet.jit.si")) {
            link = null;
        }
        map.put("meetingLink", link);

        map.put("aiReport", booking.getAiReport());
        map.put("conditionBadge", booking.getConditionBadge());
        map.put("conditionBadgeReason", booking.getConditionBadgeReason());
        map.put("previousPrescriptionSummary", booking.getPreviousPrescriptionSummary());
        map.put("followUpStatus", booking.getFollowUpStatus() != null ? booking.getFollowUpStatus() : "NONE");
        map.put("clinicianNote", booking.getClinicianNote() != null ? booking.getClinicianNote() : "");
        map.put("aiRecommendations", booking.getAiRecommendations() != null ? booking.getAiRecommendations() : "");

        PatientProfile pProfile = authService.getPatientProfile(booking.getPatient().getId());
        map.put("healthBadge", pProfile != null ? pProfile.getHealthBadge() : null);
        return map;
    }

    @PutMapping("/{id}/follow-up")
    public ResponseEntity<?> updateFollowUp(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = extractUserId(authHeader);
            String followUpStatus = body.getOrDefault("followUpStatus", "NONE").toUpperCase();
            String clinicianNote = body.getOrDefault("clinicianNote", "");
            
            Booking booking = bookingService.getBookingById(id);
            booking.setFollowUpStatus(followUpStatus);
            booking.setClinicianNote(clinicianNote);
            
            if (body.containsKey("aiRecommendations")) {
                booking.setAiRecommendations(body.get("aiRecommendations"));
            }
            
            booking = bookingService.updateBookingStatus(id, booking.getStatus().name(), userId);
            
            return ResponseEntity.ok(ApiResponse.success("Follow-up updated successfully!", toMap(booking)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/role-records")
    public ResponseEntity<?> getRoleRecords(
            @RequestParam(required = false, defaultValue = "PATIENT") String role,
            @RequestParam(required = false) String status,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = extractUserId(authHeader);
            
            List<Booking> list = new ArrayList<>();
            String targetRole = role.toUpperCase();
            
            if ("PATIENT".equals(targetRole)) {
                list = bookingService.getPatientBookings(userId);
            } else if ("DOCTOR".equals(targetRole)) {
                list = bookingService.getDoctorBookings(userId);
            } else {
                list = bookingService.getDoctorBookings(userId);
            }
            
            if (status != null && !status.trim().isEmpty() && !"ALL".equalsIgnoreCase(status)) {
                final String finalStatus = status.trim().toUpperCase();
                list = list.stream()
                        .filter(b -> finalStatus.equalsIgnoreCase(b.getFollowUpStatus()))
                        .collect(Collectors.toList());
            }
            
            long totalCount = list.size();
            long pendingCount = list.stream().filter(b -> "PENDING".equalsIgnoreCase(b.getFollowUpStatus())).count();
            long scheduledCount = list.stream().filter(b -> "SCHEDULED".equalsIgnoreCase(b.getFollowUpStatus())).count();
            long completedCount = list.stream().filter(b -> "COMPLETED".equalsIgnoreCase(b.getFollowUpStatus())).count();
            long noneCount = list.stream().filter(b -> b.getFollowUpStatus() == null || "NONE".equalsIgnoreCase(b.getFollowUpStatus())).count();
            
            Map<String, Object> response = new HashMap<>();
            response.put("records", list.stream().map(this::toMap).collect(Collectors.toList()));
            response.put("counts", Map.of(
                "total", totalCount,
                "pending", pendingCount,
                "scheduled", scheduledCount,
                "completed", completedCount,
                "none", noneCount
            ));
            
            return ResponseEntity.ok(ApiResponse.success("Records fetched successfully", response));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private Long extractUserId(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = tokenProvider.getEmailFromToken(token);
        return authService.getUserByEmail(email).getId();
    }
}

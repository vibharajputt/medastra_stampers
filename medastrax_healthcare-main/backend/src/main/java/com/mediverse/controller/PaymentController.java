package com.mediverse.controller;

import com.mediverse.dto.ApiResponse;
import com.mediverse.dto.BookingRequest;
import com.mediverse.model.Booking;
import com.mediverse.model.User;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.BookingService;
import com.mediverse.service.HospitalService;
import com.mediverse.service.PaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private HospitalService hospitalService;

    @Autowired
    private BookingService bookingService;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Value("${razorpay.key.id}")
    private String razorpayKeyId;

    @PostMapping("/order")
    public ResponseEntity<?> createOrder(
            @RequestBody Map<String, Object> payload,
            @RequestHeader("Authorization") String authHeader) {
        try {
            double amount = Double.parseDouble(payload.get("amount").toString());
            String orderId = paymentService.createOrder(amount);

            Map<String, Object> resp = new HashMap<>();
            resp.put("orderId", orderId);
            resp.put("amount", amount);
            resp.put("keyId", razorpayKeyId);

            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyAndBook(
            @RequestBody Map<String, Object> payload,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractUserId(authHeader);

            String orderId = (String) payload.get("razorpayOrderId");
            String paymentId = (String) payload.get("razorpayPaymentId");
            String signature = (String) payload.get("razorpaySignature");

            boolean isValid = paymentService.verifySignature(orderId, paymentId, signature);
            if (!isValid) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Payment signature verification failed. Transaction was not authentic."));
            }

            BookingRequest request = new BookingRequest();
            request.setHospitalId(Long.valueOf(payload.get("hospitalId").toString()));
            request.setDoctorId(Long.valueOf(payload.get("doctorId").toString()));
            request.setBookingDate(LocalDate.parse(payload.get("bookingDate").toString()));
            request.setTimeSlot((String) payload.get("timeSlot"));
            request.setType((String) payload.get("type"));
            request.setNotes((String) payload.get("notes"));
            request.setPatientName((String) payload.get("patientName"));
            request.setPatientPhone((String) payload.get("patientPhone"));
            request.setAge(Integer.valueOf(payload.get("age").toString()));
            request.setGender((String) payload.get("gender"));
            request.setSymptoms((String) payload.get("symptoms"));
            request.setPaymentMethod((String) payload.get("paymentMethod"));
            request.setPaymentStatus("PAID");

            if (payload.get("familyMemberId") != null) {
                request.setFamilyMemberId(Long.valueOf(payload.get("familyMemberId").toString()));
            }

            Booking booking = bookingService.createBooking(request, patientId);
            bookingService.updateBookingStatus(booking.getId(), "CONFIRMED", patientId);

            Map<String, Object> resp = new HashMap<>();
            resp.put("bookingId", booking.getId());
            resp.put("status", "CONFIRMED");

            return ResponseEntity.ok(ApiResponse.success("Payment verified and booking confirmed successfully!", resp));
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

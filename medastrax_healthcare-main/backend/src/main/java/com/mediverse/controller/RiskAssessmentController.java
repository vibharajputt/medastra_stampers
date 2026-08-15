package com.mediverse.controller;

import com.mediverse.model.User;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.RiskAssessmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Risk Assessment Controller
 * Exposes endpoints for the Early Risk Detection engine.
 *
 * Endpoints:
 *  POST /api/risk/assess       — Perform a full risk assessment
 *  GET  /api/risk/history      — Get time-series risk history (chart data)
 *  GET  /api/risk/latest       — Get latest risk score (dashboard widget)
 */
@RestController
@RequestMapping("/api/risk")
@CrossOrigin
public class RiskAssessmentController {

    @Autowired
    private RiskAssessmentService riskAssessmentService;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    /**
     * Perform a full AI risk assessment for the authenticated patient.
     * Request body can include optional vitals:
     * {
     *   "heartRate": 95,
     *   "systolicBP": 145,
     *   "diastolicBP": 90,
     *   "bloodSugar": 185,
     *   "spo2": 97,
     *   "temperature": 37.2,
     *   "weight": 72.5,
     *   "height": 1.72,
     *   "respiratoryRate": 18
     * }
     * All vitals are optional — the engine handles missing data gracefully.
     */
    @PostMapping("/assess")
    public ResponseEntity<?> assessRisk(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody(required = false) Map<String, Object> vitals) {
        try {
            Long patientId = extractPatientId(authHeader);
            Map<String, Object> result = riskAssessmentService.assessRisk(patientId, vitals != null ? vitals : Map.of());
            return ResponseEntity.ok(Map.of("success", true, "data", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get time-series risk score history for the authenticated patient.
     * Returns last 30 assessments ordered by date (oldest first) for chart rendering.
     */
    @GetMapping("/history")
    public ResponseEntity<?> getRiskHistory(
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractPatientId(authHeader);
            List<Map<String, Object>> history = riskAssessmentService.getRiskHistory(patientId);
            return ResponseEntity.ok(Map.of("success", true, "history", history));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get the latest risk summary (for the Patient Dashboard widget).
     */
    @GetMapping("/latest")
    public ResponseEntity<?> getLatestRisk(
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractPatientId(authHeader);
            Optional<Map<String, Object>> latest = riskAssessmentService.getLatestRiskSummary(patientId);
            if (latest.isPresent()) {
                return ResponseEntity.ok(Map.of("success", true, "data", latest.get()));
            } else {
                return ResponseEntity.ok(Map.of("success", true, "data", Map.of()));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    private Long extractPatientId(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = tokenProvider.getEmailFromToken(token);
        User user = authService.getUserByEmail(email);
        return user.getId();
    }
}

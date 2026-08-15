package com.mediverse.controller;

import com.mediverse.model.ToolRunLog;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.ToolRunLogService;
import com.mediverse.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/observability")
public class ObservabilityController {

    @Autowired
    private ToolRunLogService toolRunLogService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private AuthService authService;

    @GetMapping("/runs")
    public ResponseEntity<?> getAllRuns(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);

            Page<ToolRunLog> runs;
            // Admins see all, others see only their own runs
            if (user.getRole() == com.mediverse.model.User.Role.ADMIN ||
                    user.getRole() == com.mediverse.model.User.Role.DOCTOR) {
                runs = toolRunLogService.getAllRuns(page, size);
            } else {
                runs = toolRunLogService.getUserRuns(user.getId(), page, size);
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", runs.getContent(),
                    "totalPages", runs.getTotalPages(),
                    "totalElements", runs.getTotalElements()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestHeader("Authorization") String authHeader) {
        try {
            tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            Map<String, Object> stats = toolRunLogService.getStats();
            return ResponseEntity.ok(Map.of("success", true, "data", stats));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}

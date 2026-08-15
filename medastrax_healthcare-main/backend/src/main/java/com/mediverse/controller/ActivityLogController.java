package com.mediverse.controller;

import com.mediverse.model.ActivityLog;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.ActivityLogService;
import com.mediverse.service.AuthService;
import com.mediverse.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/activity")
public class ActivityLogController {

    @Autowired
    private ActivityLogService activityLogService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private AuthService authService;

    @GetMapping
    public ResponseEntity<?> getHistory(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String type) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);

            Page<ActivityLog> results;
            if (type != null && !type.equalsIgnoreCase("ALL")) {
                ActivityLog.EventType eventType = ActivityLog.EventType.valueOf(type.toUpperCase());
                results = activityLogService.getUserHistoryByType(user.getId(), eventType, page, size);
            } else {
                results = activityLogService.getUserHistory(user.getId(), page, size);
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", results.getContent(),
                    "totalPages", results.getTotalPages(),
                    "totalElements", results.getTotalElements(),
                    "currentPage", page
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping("/recent")
    public ResponseEntity<?> getRecent(@RequestHeader("Authorization") String authHeader) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);
            List<ActivityLog> recent = activityLogService.getRecentFive(user.getId());
            return ResponseEntity.ok(Map.of("success", true, "data", recent));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}

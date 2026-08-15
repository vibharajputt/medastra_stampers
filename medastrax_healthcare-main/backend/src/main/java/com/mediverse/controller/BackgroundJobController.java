package com.mediverse.controller;

import com.mediverse.model.BackgroundJob;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.ActivityLogService;
import com.mediverse.service.AuthService;
import com.mediverse.service.BackgroundJobService;
import com.mediverse.model.ActivityLog;
import com.mediverse.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/jobs")
public class BackgroundJobController {

    @Autowired
    private BackgroundJobService jobService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private AuthService authService;

    @Autowired
    private ActivityLogService activityLogService;

    @PostMapping("/submit")
    public ResponseEntity<?> submitJob(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> body) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);

            String jobTypeStr = body.getOrDefault("jobType", "AI_DIAGNOSIS").toString();
            BackgroundJob.JobType jobType = BackgroundJob.JobType.valueOf(jobTypeStr.toUpperCase());
            String payload = body.getOrDefault("input", "").toString();

            BackgroundJob job = jobService.submitJob(user.getId(), jobType, payload);
            activityLogService.log(user.getId(), ActivityLog.EventType.REPORT_GENERATED,
                    "Background job submitted: " + jobType.name(), job.getId(), "BACKGROUND_JOB");

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Job submitted successfully! Processing in background.",
                    "jobId", job.getId(),
                    "status", job.getStatus()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getJobs(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);
            Page<BackgroundJob> jobs = jobService.getUserJobs(user.getId(), page, size);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", jobs.getContent(),
                    "totalPages", jobs.getTotalPages(),
                    "totalElements", jobs.getTotalElements()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<?> getJob(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long jobId) {
        try {
            tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", "")); // validate token
            BackgroundJob job = jobService.getUserJobs(0L, 0, 1).getContent().stream()
                    .findFirst().orElse(null);
            // just fetch directly
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/{jobId}/retry")
    public ResponseEntity<?> retryJob(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long jobId) {
        try {
            tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            BackgroundJob job = jobService.retryJob(jobId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Job queued for retry",
                    "jobId", job.getId(),
                    "status", job.getStatus()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}

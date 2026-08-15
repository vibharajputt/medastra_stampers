package com.mediverse.controller;

import com.mediverse.model.WorkflowInstance;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.WorkflowOrchestrationService;
import com.mediverse.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {

    @Autowired
    private WorkflowOrchestrationService workflowService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private AuthService authService;

    @PostMapping("/start")
    public ResponseEntity<?> startWorkflow(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> body) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);
            String workflowType = body.getOrDefault("workflowType", "GENERIC_APPROVAL").toString();
            WorkflowInstance wf = workflowService.startWorkflow(user.getId(), workflowType, body);
            return ResponseEntity.ok(Map.of("success", true, "data", wf,
                    "message", "Workflow started successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getWorkflows(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);
            Page<WorkflowInstance> wfs = workflowService.getUserWorkflows(user.getId(), page, size);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", wfs.getContent(),
                    "totalPages", wfs.getTotalPages(),
                    "totalElements", wfs.getTotalElements(),
                    "pendingApprovals", workflowService.getPendingApprovalCount(user.getId())
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/{workflowId}/approve/{stepIndex}")
    public ResponseEntity<?> approveStep(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long workflowId,
            @PathVariable int stepIndex) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);
            WorkflowInstance wf = workflowService.approveStep(workflowId, stepIndex, user.getId());
            return ResponseEntity.ok(Map.of("success", true, "data", wf,
                    "message", "Step approved. Workflow continues."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/{workflowId}/reject/{stepIndex}")
    public ResponseEntity<?> rejectStep(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Long workflowId,
            @PathVariable int stepIndex,
            @RequestBody Map<String, String> body) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);
            String reason = body.getOrDefault("reason", "Rejected by user");
            WorkflowInstance wf = workflowService.rejectStep(workflowId, stepIndex, user.getId(), reason);
            return ResponseEntity.ok(Map.of("success", true, "data", wf,
                    "message", "Step rejected. Workflow stopped."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping("/pending-count")
    public ResponseEntity<?> getPendingCount(@RequestHeader("Authorization") String authHeader) {
        try {
            String email = tokenProvider.getEmailFromToken(authHeader.replace("Bearer ", ""));
            User user = authService.getUserByEmail(email);
            long count = workflowService.getPendingApprovalCount(user.getId());
            return ResponseEntity.ok(Map.of("success", true, "pendingApprovals", count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}

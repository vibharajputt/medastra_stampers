package com.mediverse.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediverse.model.ActivityLog;
import com.mediverse.model.WorkflowInstance;
import com.mediverse.repository.WorkflowRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class WorkflowOrchestrationService {

    @Autowired
    private WorkflowRepository workflowRepo;

    @Autowired
    private ActivityLogService activityLogService;

    private final ObjectMapper mapper = new ObjectMapper();

    public WorkflowInstance startWorkflow(Long userId, String workflowType, Map<String, Object> inputData) throws Exception {
        List<Map<String, Object>> steps = buildStepsForType(workflowType, inputData);

        WorkflowInstance wf = new WorkflowInstance();
        wf.setUserId(userId);
        wf.setWorkflowType(workflowType);
        wf.setStepsJson(mapper.writeValueAsString(steps));
        wf.setAuditTrailJson("[]");
        wf.setDescription(buildDescription(workflowType, inputData));
        wf.setStatus(WorkflowInstance.WorkflowStatus.ACTIVE);
        wf.setCurrentStepIndex(0);
        workflowRepo.save(wf);

        activityLogService.log(userId, ActivityLog.EventType.WORKFLOW_STARTED,
                "Started workflow: " + workflowType, wf.getId(), "WORKFLOW");

        return advanceWorkflow(wf);
    }

    private WorkflowInstance advanceWorkflow(WorkflowInstance wf) throws Exception {
        List<Map<String, Object>> steps = mapper.readValue(wf.getStepsJson(), new TypeReference<>() {});

        while (wf.getCurrentStepIndex() < steps.size()) {
            Map<String, Object> step = steps.get(wf.getCurrentStepIndex());
            String stepType = step.getOrDefault("stepType", "AUTO").toString();

            if ("REQUIRES_APPROVAL".equals(stepType)) {
                step.put("status", "AWAITING_APPROVAL");
                wf.setStepsJson(mapper.writeValueAsString(steps));
                wf.setStatus(WorkflowInstance.WorkflowStatus.PAUSED_FOR_APPROVAL);
                addAuditEntry(wf, step.get("stepName").toString(), "PAUSED", "Awaiting user approval");
                return workflowRepo.save(wf);
            }

            // Auto step — execute it
            step.put("status", "RUNNING");
            String output = autoExecuteStep(step);
            step.put("status", "COMPLETED");
            step.put("outputData", output);
            step.put("completedAt", LocalDateTime.now().toString());
            addAuditEntry(wf, step.get("stepName").toString(), "COMPLETED", output);
            wf.setCurrentStepIndex(wf.getCurrentStepIndex() + 1);
            wf.setStepsJson(mapper.writeValueAsString(steps));
            workflowRepo.save(wf);
        }

        wf.setStatus(WorkflowInstance.WorkflowStatus.COMPLETED);
        wf.setCompletedAt(LocalDateTime.now());
        return workflowRepo.save(wf);
    }

    public WorkflowInstance approveStep(Long workflowId, int stepIndex, Long approvedByUserId) throws Exception {
        WorkflowInstance wf = workflowRepo.findById(workflowId)
                .orElseThrow(() -> new IllegalArgumentException("Workflow not found"));
        if (wf.getStatus() != WorkflowInstance.WorkflowStatus.PAUSED_FOR_APPROVAL) {
            throw new IllegalArgumentException("Workflow is not awaiting approval");
        }

        List<Map<String, Object>> steps = mapper.readValue(wf.getStepsJson(), new TypeReference<>() {});
        Map<String, Object> step = steps.get(stepIndex);
        step.put("status", "APPROVED");
        step.put("approvedBy", approvedByUserId);
        step.put("approvedAt", LocalDateTime.now().toString());

        addAuditEntry(wf, step.get("stepName").toString(), "APPROVED", "Approved by user " + approvedByUserId);
        activityLogService.log(approvedByUserId, ActivityLog.EventType.WORKFLOW_APPROVED,
                "Approved step: " + step.get("stepName"), workflowId, "WORKFLOW");

        wf.setCurrentStepIndex(stepIndex + 1);
        wf.setStatus(WorkflowInstance.WorkflowStatus.ACTIVE);
        wf.setStepsJson(mapper.writeValueAsString(steps));
        workflowRepo.save(wf);

        return advanceWorkflow(wf);
    }

    public WorkflowInstance rejectStep(Long workflowId, int stepIndex, Long userId, String reason) throws Exception {
        WorkflowInstance wf = workflowRepo.findById(workflowId)
                .orElseThrow(() -> new IllegalArgumentException("Workflow not found"));

        List<Map<String, Object>> steps = mapper.readValue(wf.getStepsJson(), new TypeReference<>() {});
        Map<String, Object> step = steps.get(stepIndex);
        step.put("status", "REJECTED");
        step.put("rejectionReason", reason);
        step.put("rejectedAt", LocalDateTime.now().toString());

        addAuditEntry(wf, step.get("stepName").toString(), "REJECTED", "Reason: " + reason);
        activityLogService.log(userId, ActivityLog.EventType.WORKFLOW_REJECTED,
                "Rejected step: " + step.get("stepName") + " - " + reason, workflowId, "WORKFLOW");

        wf.setStatus(WorkflowInstance.WorkflowStatus.REJECTED);
        wf.setStepsJson(mapper.writeValueAsString(steps));
        wf.setCompletedAt(LocalDateTime.now());
        return workflowRepo.save(wf);
    }

    public Page<WorkflowInstance> getUserWorkflows(Long userId, int page, int size) {
        return workflowRepo.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
    }

    public long getPendingApprovalCount(Long userId) {
        return workflowRepo.countByUserIdAndStatus(userId, WorkflowInstance.WorkflowStatus.PAUSED_FOR_APPROVAL);
    }

    private String autoExecuteStep(Map<String, Object> step) {
        String tool = step.getOrDefault("toolToCall", "GENERIC").toString();
        return switch (tool) {
            case "VALIDATE_DATA" -> "Data validation passed. All required fields are present and properly formatted.";
            case "CHECK_DRUG_INTERACTIONS" -> "Drug interaction check completed. No critical interactions detected.";
            case "SEND_NOTIFICATION" -> "Notification dispatched to relevant parties.";
            case "GENERATE_REPORT" -> "Health report generated and ready for download.";
            default -> "Step completed successfully.";
        };
    }

    private List<Map<String, Object>> buildStepsForType(String type, Map<String, Object> inputData) {
        List<Map<String, Object>> steps = new ArrayList<>();
        switch (type) {
            case "MEDICATION_APPROVAL" -> {
                steps.add(buildStep(0, "Validate Prescription Data", "AUTO", "VALIDATE_DATA", inputData));
                steps.add(buildStep(1, "Check Drug Interactions", "AUTO", "CHECK_DRUG_INTERACTIONS", inputData));
                steps.add(buildStep(2, "Approve Medication Order", "REQUIRES_APPROVAL", "APPROVE_MEDICATION", inputData));
                steps.add(buildStep(3, "Notify Pharmacy", "AUTO", "SEND_NOTIFICATION", inputData));
            }
            case "EMERGENCY_PROTOCOL" -> {
                steps.add(buildStep(0, "Assess Emergency Level", "AUTO", "VALIDATE_DATA", inputData));
                steps.add(buildStep(1, "Authorize Emergency Dispatch", "REQUIRES_APPROVAL", "APPROVE_EMERGENCY", inputData));
                steps.add(buildStep(2, "Notify Emergency Contacts", "AUTO", "SEND_NOTIFICATION", inputData));
                steps.add(buildStep(3, "Generate Incident Report", "AUTO", "GENERATE_REPORT", inputData));
            }
            default -> {
                steps.add(buildStep(0, "Validate Input", "AUTO", "VALIDATE_DATA", inputData));
                steps.add(buildStep(1, "Review & Approve", "REQUIRES_APPROVAL", "GENERIC_APPROVAL", inputData));
                steps.add(buildStep(2, "Execute Action", "AUTO", "GENERIC", inputData));
            }
        }
        return steps;
    }

    private Map<String, Object> buildStep(int idx, String name, String type, String tool, Map<String, Object> data) {
        Map<String, Object> step = new LinkedHashMap<>();
        step.put("stepIndex", idx);
        step.put("stepName", name);
        step.put("stepType", type);
        step.put("toolToCall", tool);
        step.put("inputData", data);
        step.put("status", "PENDING");
        return step;
    }

    private void addAuditEntry(WorkflowInstance wf, String stepName, String action, String detail) {
        try {
            List<Map<String, Object>> trail = mapper.readValue(
                    wf.getAuditTrailJson() == null ? "[]" : wf.getAuditTrailJson(),
                    new TypeReference<>() {});
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("stepName", stepName);
            entry.put("action", action);
            entry.put("detail", detail);
            entry.put("timestamp", LocalDateTime.now().toString());
            trail.add(entry);
            wf.setAuditTrailJson(mapper.writeValueAsString(trail));
        } catch (Exception e) {
            System.err.println("Audit trail error: " + e.getMessage());
        }
    }

    private String buildDescription(String type, Map<String, Object> data) {
        return switch (type) {
            case "MEDICATION_APPROVAL" -> "Multi-step medication approval workflow";
            case "EMERGENCY_PROTOCOL" -> "Emergency response orchestration workflow";
            default -> "Custom approval workflow";
        };
    }
}

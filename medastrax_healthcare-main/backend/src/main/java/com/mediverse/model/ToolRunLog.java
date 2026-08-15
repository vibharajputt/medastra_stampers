package com.mediverse.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tool_run_logs")
public class ToolRunLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @Column(nullable = false, length = 100)
    private String toolName;

    @Column(columnDefinition = "TEXT")
    private String inputSummary;

    @Column(columnDefinition = "TEXT")
    private String outputSummary;

    private Long latencyMs;
    private boolean isSuccess;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(nullable = false, updatable = false)
    private LocalDateTime runTimestamp;

    @Column(length = 500)
    private String agentDecision;

    @PrePersist
    protected void onCreate() {
        runTimestamp = LocalDateTime.now();
    }

    public ToolRunLog() {}

    public ToolRunLog(Long userId, String toolName, String inputSummary, String outputSummary,
                      Long latencyMs, boolean isSuccess, String errorMessage, String agentDecision) {
        this.userId = userId;
        this.toolName = toolName;
        this.inputSummary = inputSummary;
        this.outputSummary = outputSummary;
        this.latencyMs = latencyMs;
        this.isSuccess = isSuccess;
        this.errorMessage = errorMessage;
        this.agentDecision = agentDecision;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getToolName() { return toolName; }
    public void setToolName(String toolName) { this.toolName = toolName; }
    public String getInputSummary() { return inputSummary; }
    public void setInputSummary(String inputSummary) { this.inputSummary = inputSummary; }
    public String getOutputSummary() { return outputSummary; }
    public void setOutputSummary(String outputSummary) { this.outputSummary = outputSummary; }
    public Long getLatencyMs() { return latencyMs; }
    public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }
    public boolean isSuccess() { return isSuccess; }
    public void setSuccess(boolean success) { isSuccess = success; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public LocalDateTime getRunTimestamp() { return runTimestamp; }
    public String getAgentDecision() { return agentDecision; }
    public void setAgentDecision(String agentDecision) { this.agentDecision = agentDecision; }
}

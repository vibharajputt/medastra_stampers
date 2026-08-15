package com.mediverse.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "risk_assessments")
public class RiskAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    // 0-100 numeric risk score
    @Column(nullable = false)
    private Integer riskScore;

    // SAFE / LOW / MODERATE / HIGH / CRITICAL
    @Column(nullable = false)
    private String riskLevel;

    // 0-100 confidence % based on data completeness
    @Column(nullable = false)
    private Integer confidence;

    // 0-100 % of health parameters that were missing/null
    @Column(nullable = false)
    private Integer missingDataPercentage;

    // JSON array of risk factor explanations e.g. [{"factor":"High BP","points":20,"direction":"up"}]
    @Column(columnDefinition = "TEXT")
    private String factors;

    // JSON array of detected anomalies e.g. [{"parameter":"heartRate","value":130,"normal":"60-100"}]
    @Column(columnDefinition = "TEXT")
    private String anomalies;

    // Whether an automated emergency alert was triggered
    @Column(nullable = false)
    private Boolean alertTriggered = false;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public RiskAssessment() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getPatientId() { return patientId; }
    public void setPatientId(Long patientId) { this.patientId = patientId; }

    public Integer getRiskScore() { return riskScore; }
    public void setRiskScore(Integer riskScore) { this.riskScore = riskScore; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

    public Integer getConfidence() { return confidence; }
    public void setConfidence(Integer confidence) { this.confidence = confidence; }

    public Integer getMissingDataPercentage() { return missingDataPercentage; }
    public void setMissingDataPercentage(Integer missingDataPercentage) {
        this.missingDataPercentage = missingDataPercentage;
    }

    public String getFactors() { return factors; }
    public void setFactors(String factors) { this.factors = factors; }

    public String getAnomalies() { return anomalies; }
    public void setAnomalies(String anomalies) { this.anomalies = anomalies; }

    public Boolean getAlertTriggered() { return alertTriggered != null ? alertTriggered : false; }
    public void setAlertTriggered(Boolean alertTriggered) { this.alertTriggered = alertTriggered; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

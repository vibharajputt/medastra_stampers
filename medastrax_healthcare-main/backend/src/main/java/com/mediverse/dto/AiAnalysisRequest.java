package com.mediverse.dto;

import jakarta.validation.constraints.NotBlank;

public class AiAnalysisRequest {

    @NotBlank(message = "Symptoms are required")
    private String symptoms;

    private String medicine;

    private String previousPrescription;

    public AiAnalysisRequest() {}

    public AiAnalysisRequest(String symptoms, String medicine, String previousPrescription) {
        this.symptoms = symptoms;
        this.medicine = medicine;
        this.previousPrescription = previousPrescription;
    }

    public String getSymptoms() {
        return symptoms;
    }

    public void setSymptoms(String symptoms) {
        this.symptoms = symptoms;
    }

    public String getMedicine() {
        return medicine;
    }

    public void setMedicine(String medicine) {
        this.medicine = medicine;
    }

    public String getPreviousPrescription() {
        return previousPrescription;
    }

    public void setPreviousPrescription(String previousPrescription) {
        this.previousPrescription = previousPrescription;
    }
}

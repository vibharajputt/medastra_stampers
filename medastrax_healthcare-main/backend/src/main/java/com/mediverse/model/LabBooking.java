package com.mediverse.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "lab_bookings")
public class LabBooking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private User patient;

    @Column(name = "lab_name", nullable = false)
    private String labName;

    @Column(name = "tests_json", columnDefinition = "TEXT")
    private String testsJson; // JSON representation of list of tests

    @Column(name = "status")
    private String status; // PENDING, CONFIRMED, SAMPLE_COLLECTED, REPORT_GENERATED, COMPLETED

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "delivery_address")
    private String deliveryAddress;

    @Column(name = "estimated_eta_minutes")
    private Integer estimatedEtaMinutes;

    @Column(name = "test_amount")
    private Double testAmount;

    @Column(name = "collection_charges")
    private Double collectionCharges;

    @Column(name = "total_amount")
    private Double totalAmount;

    @Column(name = "prescription_id")
    private Long prescriptionId;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getPatient() { return patient; }
    public void setPatient(User patient) { this.patient = patient; }
    public String getLabName() { return labName; }
    public void setLabName(String labName) { this.labName = labName; }
    public String getTestsJson() { return testsJson; }
    public void setTestsJson(String testsJson) { this.testsJson = testsJson; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
    public Integer getEstimatedEtaMinutes() { return estimatedEtaMinutes; }
    public void setEstimatedEtaMinutes(Integer estimatedEtaMinutes) { this.estimatedEtaMinutes = estimatedEtaMinutes; }
    public Double getTestAmount() { return testAmount; }
    public void setTestAmount(Double testAmount) { this.testAmount = testAmount; }
    public Double getCollectionCharges() { return collectionCharges; }
    public void setCollectionCharges(Double collectionCharges) { this.collectionCharges = collectionCharges; }
    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }
    public Long getPrescriptionId() { return prescriptionId; }
    public void setPrescriptionId(Long prescriptionId) { this.prescriptionId = prescriptionId; }
}

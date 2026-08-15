package com.mediverse.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private User patient;

    @Column(name = "pharmacy_name", nullable = false)
    private String pharmacyName;

    @Column(name = "medicines_json", columnDefinition = "TEXT")
    private String medicinesJson; // JSON representation of list of medicines

    @Column(name = "status")
    private String status; // PENDING, CONFIRMED, DISPATCHED, DELIVERED

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "delivery_address")
    private String deliveryAddress;

    @Column(name = "estimated_eta_minutes")
    private Integer estimatedEtaMinutes;

    @Column(name = "medicine_amount")
    private Double medicineAmount;

    @Column(name = "delivery_charges")
    private Double deliveryCharges;

    @Column(name = "total_amount")
    private Double totalAmount;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getPatient() { return patient; }
    public void setPatient(User patient) { this.patient = patient; }
    public String getPharmacyName() { return pharmacyName; }
    public void setPharmacyName(String pharmacyName) { this.pharmacyName = pharmacyName; }
    public String getMedicinesJson() { return medicinesJson; }
    public void setMedicinesJson(String medicinesJson) { this.medicinesJson = medicinesJson; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
    public Integer getEstimatedEtaMinutes() { return estimatedEtaMinutes; }
    public void setEstimatedEtaMinutes(Integer estimatedEtaMinutes) { this.estimatedEtaMinutes = estimatedEtaMinutes; }
    public Double getMedicineAmount() { return medicineAmount; }
    public void setMedicineAmount(Double medicineAmount) { this.medicineAmount = medicineAmount; }
    public Double getDeliveryCharges() { return deliveryCharges; }
    public void setDeliveryCharges(Double deliveryCharges) { this.deliveryCharges = deliveryCharges; }
    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }
}

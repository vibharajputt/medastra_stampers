package com.mediverse.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "pharmacy_medicines")
public class PharmacyMedicine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pharmacy_id", nullable = false)
    private User pharmacy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prescription_id", nullable = false)
    private Prescription prescription;

    @Column(nullable = false)
    private String medicineName;

    private BigDecimal sellingPrice;

    private Boolean available;

    private String notes;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (available == null) available = true;
    }

    public PharmacyMedicine() {}

    public PharmacyMedicine(Long id, User pharmacy, Prescription prescription, String medicineName, BigDecimal sellingPrice, Boolean available, String notes, LocalDateTime createdAt) {
        this.id = id;
        this.pharmacy = pharmacy;
        this.prescription = prescription;
        this.medicineName = medicineName;
        this.sellingPrice = sellingPrice;
        this.available = available;
        this.notes = notes;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getPharmacy() { return pharmacy; }
    public void setPharmacy(User pharmacy) { this.pharmacy = pharmacy; }
    public Prescription getPrescription() { return prescription; }
    public void setPrescription(Prescription prescription) { this.prescription = prescription; }
    public String getMedicineName() { return medicineName; }
    public void setMedicineName(String medicineName) { this.medicineName = medicineName; }
    public BigDecimal getSellingPrice() { return sellingPrice; }
    public void setSellingPrice(BigDecimal sellingPrice) { this.sellingPrice = sellingPrice; }
    public Boolean getAvailable() { return available; }
    public void setAvailable(Boolean available) { this.available = available; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static PharmacyMedicineBuilder builder() {
        return new PharmacyMedicineBuilder();
    }

    public static class PharmacyMedicineBuilder {
        private Long id;
        private User pharmacy;
        private Prescription prescription;
        private String medicineName;
        private BigDecimal sellingPrice;
        private Boolean available;
        private String notes;
        private LocalDateTime createdAt;

        public PharmacyMedicineBuilder id(Long id) { this.id = id; return this; }
        public PharmacyMedicineBuilder pharmacy(User pharmacy) { this.pharmacy = pharmacy; return this; }
        public PharmacyMedicineBuilder prescription(Prescription prescription) { this.prescription = prescription; return this; }
        public PharmacyMedicineBuilder medicineName(String medicineName) { this.medicineName = medicineName; return this; }
        public PharmacyMedicineBuilder sellingPrice(BigDecimal sellingPrice) { this.sellingPrice = sellingPrice; return this; }
        public PharmacyMedicineBuilder available(Boolean available) { this.available = available; return this; }
        public PharmacyMedicineBuilder notes(String notes) { this.notes = notes; return this; }
        public PharmacyMedicineBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

        public PharmacyMedicine build() {
            return new PharmacyMedicine(id, pharmacy, prescription, medicineName, sellingPrice, available, notes, createdAt);
        }
    }
}

package com.mediverse.dto;

import java.math.BigDecimal;
import java.util.List;

public class PharmacyPriceRequest {
    private Long prescriptionId;
    private List<MedicinePrice> medicines;

    public PharmacyPriceRequest() {}

    public Long getPrescriptionId() { return prescriptionId; }
    public void setPrescriptionId(Long prescriptionId) { this.prescriptionId = prescriptionId; }
    public List<MedicinePrice> getMedicines() { return medicines; }
    public void setMedicines(List<MedicinePrice> medicines) { this.medicines = medicines; }

    public static class MedicinePrice {
        private String medicineName;
        private BigDecimal sellingPrice;
        private Boolean available;
        private String notes;

        public MedicinePrice() {}

        public String getMedicineName() { return medicineName; }
        public void setMedicineName(String medicineName) { this.medicineName = medicineName; }
        public BigDecimal getSellingPrice() { return sellingPrice; }
        public void setSellingPrice(BigDecimal sellingPrice) { this.sellingPrice = sellingPrice; }
        public Boolean getAvailable() { return available; }
        public void setAvailable(Boolean available) { this.available = available; }
        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
    }
}

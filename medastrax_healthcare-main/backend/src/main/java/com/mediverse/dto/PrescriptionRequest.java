package com.mediverse.dto;

import java.util.List;

public class PrescriptionRequest {
    private Long bookingId;
    private Long patientId;
    private String diagnosis;
    private String notes;
    private List<MedicineItem> medicines;
    private List<TestItem> tests;

    public PrescriptionRequest() {}

    public Long getBookingId() { return bookingId; }
    public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
    public Long getPatientId() { return patientId; }
    public void setPatientId(Long patientId) { this.patientId = patientId; }
    public String getDiagnosis() { return diagnosis; }
    public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public List<MedicineItem> getMedicines() { return medicines; }
    public void setMedicines(List<MedicineItem> medicines) { this.medicines = medicines; }
    public List<TestItem> getTests() { return tests; }
    public void setTests(List<TestItem> tests) { this.tests = tests; }

    public static class MedicineItem {
        private String name;
        private String dosage;
        private String frequency;
        private String duration;

        public MedicineItem() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDosage() { return dosage; }
        public void setDosage(String dosage) { this.dosage = dosage; }
        public String getFrequency() { return frequency; }
        public void setFrequency(String frequency) { this.frequency = frequency; }
        public String getDuration() { return duration; }
        public void setDuration(String duration) { this.duration = duration; }
    }

    public static class TestItem {
        private String testName;
        private String reason;

        public TestItem() {}

        public String getTestName() { return testName; }
        public void setTestName(String testName) { this.testName = testName; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }
}

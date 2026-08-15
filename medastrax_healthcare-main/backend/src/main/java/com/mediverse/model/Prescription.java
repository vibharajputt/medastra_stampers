package com.mediverse.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "prescriptions")
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = true)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private User patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_member_id", nullable = true)
    private FamilyMember familyMember;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private User doctor;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String diagnosis;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(columnDefinition = "TEXT")
    private String medicines;

    @Column(columnDefinition = "TEXT")
    private String tests;

    private Boolean hasTests;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PrescriptionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RouteType routeType;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "prescription_reports", joinColumns = @JoinColumn(name = "prescription_id"))
    @Column(name = "report_url")
    private List<String> reportUrls = new ArrayList<>();

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = (hasTests != null && hasTests) ? PrescriptionStatus.PENDING_SAMPLE : PrescriptionStatus.ACTIVE;
        }
        if (hasTests == null) hasTests = false;
    }

    public enum PrescriptionStatus {
        ACTIVE, PENDING_SAMPLE, COMPLETED, CANCELLED
    }

    public enum RouteType {
        NONE, PHARMACY, DIAGNOSTICS, BOTH
    }

    public Prescription() {}

    public Prescription(Long id, Booking booking, User patient, User doctor, String diagnosis, String notes, String medicines, String tests, Boolean hasTests, PrescriptionStatus status, RouteType routeType, LocalDateTime createdAt) {
        this.id = id;
        this.booking = booking;
        this.patient = patient;
        this.doctor = doctor;
        this.diagnosis = diagnosis;
        this.notes = notes;
        this.medicines = medicines;
        this.tests = tests;
        this.hasTests = hasTests;
        this.status = status;
        this.routeType = routeType;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Booking getBooking() { return booking; }
    public void setBooking(Booking booking) { this.booking = booking; }
    public User getPatient() { return patient; }
    public void setPatient(User patient) { this.patient = patient; }
    public FamilyMember getFamilyMember() { return familyMember; }
    public void setFamilyMember(FamilyMember familyMember) { this.familyMember = familyMember; }
    public User getDoctor() { return doctor; }
    public void setDoctor(User doctor) { this.doctor = doctor; }
    public String getDiagnosis() { return diagnosis; }
    public void setDiagnosis(String diagnosis) { this.diagnosis = diagnosis; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getMedicines() { return medicines; }
    public void setMedicines(String medicines) { this.medicines = medicines; }
    public String getTests() { return tests; }
    public void setTests(String tests) { this.tests = tests; }
    public Boolean getHasTests() { return hasTests; }
    public void setHasTests(Boolean hasTests) { this.hasTests = hasTests; }
    public PrescriptionStatus getStatus() { return status; }
    public void setStatus(PrescriptionStatus status) { this.status = status; }
    public RouteType getRouteType() { return routeType; }
    public void setRouteType(RouteType routeType) { this.routeType = routeType; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public List<String> getReportUrls() { return reportUrls; }
    public void setReportUrls(List<String> reportUrls) { this.reportUrls = reportUrls; }
    public String getAiSummary() { return aiSummary; }
    public void setAiSummary(String aiSummary) { this.aiSummary = aiSummary; }

    public static PrescriptionBuilder builder() {
        return new PrescriptionBuilder();
    }

    public static class PrescriptionBuilder {
        private Long id;
        private Booking booking;
        private User patient;
        private FamilyMember familyMember;
        private User doctor;
        private String diagnosis;
        private String notes;
        private String medicines;
        private String tests;
        private Boolean hasTests;
        private PrescriptionStatus status;
        private RouteType routeType;
        private LocalDateTime createdAt;
        private List<String> reportUrls = new ArrayList<>();
        private String aiSummary;

        public PrescriptionBuilder id(Long id) { this.id = id; return this; }
        public PrescriptionBuilder booking(Booking booking) { this.booking = booking; return this; }
        public PrescriptionBuilder patient(User patient) { this.patient = patient; return this; }
        public PrescriptionBuilder familyMember(FamilyMember familyMember) { this.familyMember = familyMember; return this; }
        public PrescriptionBuilder doctor(User doctor) { this.doctor = doctor; return this; }
        public PrescriptionBuilder diagnosis(String diagnosis) { this.diagnosis = diagnosis; return this; }
        public PrescriptionBuilder notes(String notes) { this.notes = notes; return this; }
        public PrescriptionBuilder medicines(String medicines) { this.medicines = medicines; return this; }
        public PrescriptionBuilder tests(String tests) { this.tests = tests; return this; }
        public PrescriptionBuilder hasTests(Boolean hasTests) { this.hasTests = hasTests; return this; }
        public PrescriptionBuilder status(PrescriptionStatus status) { this.status = status; return this; }
        public PrescriptionBuilder routeType(RouteType routeType) { this.routeType = routeType; return this; }
        public PrescriptionBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public PrescriptionBuilder reportUrls(List<String> reportUrls) { this.reportUrls = reportUrls; return this; }
        public PrescriptionBuilder aiSummary(String aiSummary) { this.aiSummary = aiSummary; return this; }

        public Prescription build() {
            Prescription prescription = new Prescription(id, booking, patient, doctor, diagnosis, notes, medicines, tests, hasTests, status, routeType, createdAt);
            prescription.setFamilyMember(familyMember);
            prescription.setReportUrls(reportUrls);
            prescription.setAiSummary(aiSummary);
            return prescription;
        }
    }
}

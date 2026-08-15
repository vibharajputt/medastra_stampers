package com.mediverse.model;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private User patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_member_id")
    private FamilyMember familyMember;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id", nullable = false)
    private User doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @Column(nullable = false)
    private LocalDate bookingDate;

    @Column(nullable = false)
    private String timeSlot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingType type;

    private String notes;
    private String patientName;
    private String patientPhone;
    private Integer age;
    private String gender;

    @Column(columnDefinition = "TEXT")
    private String symptoms;

    private String paymentMethod;
    private String paymentStatus;
    private String meetingLink;

    @Column(columnDefinition = "TEXT")
    private String aiReport;

    // badge indicating overall patient condition severity - RED/ORANGE/YELLOW/GREEN
    private String conditionBadge;
    private String conditionBadgeReason;

    @Column(columnDefinition = "TEXT")
    private String previousPrescriptionSummary;

    private String followUpStatus; // "NONE", "PENDING", "SCHEDULED", "COMPLETED"

    @Column(columnDefinition = "TEXT")
    private String clinicianNote;

    @Column(columnDefinition = "TEXT")
    private String aiRecommendations;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) status = BookingStatus.PENDING;
        if (followUpStatus == null) followUpStatus = "NONE";
    }

    public enum BookingStatus {
        PENDING, CONFIRMED, COMPLETED, CANCELLED
    }

    public enum BookingType {
        ONLINE, OFFLINE
    }

    public Booking() {}

    public Booking(Long id, User patient, User doctor, Hospital hospital,
                   LocalDate bookingDate, String timeSlot, BookingStatus status,
                   BookingType type, String notes, String patientName, String patientPhone,
                   Integer age, String gender, String symptoms, String paymentMethod,
                   String paymentStatus, LocalDateTime createdAt) {
        this.id = id;
        this.patient = patient;
        this.doctor = doctor;
        this.hospital = hospital;
        this.bookingDate = bookingDate;
        this.timeSlot = timeSlot;
        this.status = status;
        this.type = type;
        this.notes = notes;
        this.patientName = patientName;
        this.patientPhone = patientPhone;
        this.age = age;
        this.gender = gender;
        this.symptoms = symptoms;
        this.paymentMethod = paymentMethod;
        this.paymentStatus = paymentStatus;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getPatient() { return patient; }
    public void setPatient(User patient) { this.patient = patient; }

    public FamilyMember getFamilyMember() { return familyMember; }
    public void setFamilyMember(FamilyMember familyMember) { this.familyMember = familyMember; }

    public User getDoctor() { return doctor; }
    public void setDoctor(User doctor) { this.doctor = doctor; }

    public Hospital getHospital() { return hospital; }
    public void setHospital(Hospital hospital) { this.hospital = hospital; }

    public LocalDate getBookingDate() { return bookingDate; }
    public void setBookingDate(LocalDate bookingDate) { this.bookingDate = bookingDate; }

    public String getTimeSlot() { return timeSlot; }
    public void setTimeSlot(String timeSlot) { this.timeSlot = timeSlot; }

    public BookingStatus getStatus() { return status; }
    public void setStatus(BookingStatus status) { this.status = status; }

    public BookingType getType() { return type; }
    public void setType(BookingType type) { this.type = type; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public String getPatientPhone() { return patientPhone; }
    public void setPatientPhone(String patientPhone) { this.patientPhone = patientPhone; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getSymptoms() { return symptoms; }
    public void setSymptoms(String symptoms) { this.symptoms = symptoms; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getMeetingLink() { return meetingLink; }
    public void setMeetingLink(String meetingLink) { this.meetingLink = meetingLink; }

    public String getAiReport() { return aiReport; }
    public void setAiReport(String aiReport) { this.aiReport = aiReport; }

    public String getConditionBadge() { return conditionBadge; }
    public void setConditionBadge(String conditionBadge) { this.conditionBadge = conditionBadge; }

    public String getConditionBadgeReason() { return conditionBadgeReason; }
    public void setConditionBadgeReason(String conditionBadgeReason) {
        this.conditionBadgeReason = conditionBadgeReason;
    }

    public String getPreviousPrescriptionSummary() { return previousPrescriptionSummary; }
    public void setPreviousPrescriptionSummary(String previousPrescriptionSummary) {
        this.previousPrescriptionSummary = previousPrescriptionSummary;
    }

    public String getFollowUpStatus() { return followUpStatus; }
    public void setFollowUpStatus(String followUpStatus) { this.followUpStatus = followUpStatus; }

    public String getClinicianNote() { return clinicianNote; }
    public void setClinicianNote(String clinicianNote) { this.clinicianNote = clinicianNote; }

    public String getAiRecommendations() { return aiRecommendations; }
    public void setAiRecommendations(String aiRecommendations) { this.aiRecommendations = aiRecommendations; }

    public static BookingBuilder builder() {
        return new BookingBuilder();
    }

    public static class BookingBuilder {
        private Long id;
        private User patient;
        private FamilyMember familyMember;
        private User doctor;
        private Hospital hospital;
        private LocalDate bookingDate;
        private String timeSlot;
        private BookingStatus status;
        private BookingType type;
        private String notes;
        private String patientName;
        private String patientPhone;
        private Integer age;
        private String gender;
        private String symptoms;
        private String paymentMethod;
        private String paymentStatus;
        private LocalDateTime createdAt;
        private String previousPrescriptionSummary;

        public BookingBuilder id(Long id) { this.id = id; return this; }
        public BookingBuilder patient(User patient) { this.patient = patient; return this; }
        public BookingBuilder familyMember(FamilyMember familyMember) { this.familyMember = familyMember; return this; }
        public BookingBuilder doctor(User doctor) { this.doctor = doctor; return this; }
        public BookingBuilder hospital(Hospital hospital) { this.hospital = hospital; return this; }
        public BookingBuilder bookingDate(LocalDate bookingDate) { this.bookingDate = bookingDate; return this; }
        public BookingBuilder timeSlot(String timeSlot) { this.timeSlot = timeSlot; return this; }
        public BookingBuilder status(BookingStatus status) { this.status = status; return this; }
        public BookingBuilder type(BookingType type) { this.type = type; return this; }
        public BookingBuilder notes(String notes) { this.notes = notes; return this; }
        public BookingBuilder patientName(String patientName) { this.patientName = patientName; return this; }
        public BookingBuilder patientPhone(String patientPhone) { this.patientPhone = patientPhone; return this; }
        public BookingBuilder age(Integer age) { this.age = age; return this; }
        public BookingBuilder gender(String gender) { this.gender = gender; return this; }
        public BookingBuilder symptoms(String symptoms) { this.symptoms = symptoms; return this; }
        public BookingBuilder paymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; return this; }
        public BookingBuilder paymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; return this; }
        private String followUpStatus;
        private String clinicianNote;
        private String aiRecommendations;

        public BookingBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public BookingBuilder previousPrescriptionSummary(String s) { this.previousPrescriptionSummary = s; return this; }
        public BookingBuilder followUpStatus(String s) { this.followUpStatus = s; return this; }
        public BookingBuilder clinicianNote(String s) { this.clinicianNote = s; return this; }
        public BookingBuilder aiRecommendations(String s) { this.aiRecommendations = s; return this; }

        public Booking build() {
            Booking b = new Booking(id, patient, doctor, hospital, bookingDate, timeSlot, status,
                    type, notes, patientName, patientPhone, age, gender, symptoms,
                    paymentMethod, paymentStatus, createdAt);
            b.setFamilyMember(familyMember);
            b.setPreviousPrescriptionSummary(previousPrescriptionSummary);
            b.setFollowUpStatus(followUpStatus != null ? followUpStatus : "NONE");
            b.setClinicianNote(clinicianNote);
            b.setAiRecommendations(aiRecommendations);
            return b;
        }
    }
}

package com.mediverse.model;

import jakarta.persistence.*;

@Entity
@Table(name = "patient_profiles")
public class PatientProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String dob;
    private Integer age;
    private String gender;
    private String bloodGroup;
    private String emergencyNumber;
    private String preferredLanguage;
    private String existingMedicalCondition;
    private String idProof;
    private String currentMedication;
    private String allergies;
    private Boolean isFirstTimeUser;
    private String hospitalPreference;
    private String prescriptionReportUrl;

    // gamification stuff
    private Integer expPoints = 0;
    private Integer streakDays = 0;
    private String healthBadge;

    @Column(columnDefinition = "TEXT")
    private String lastAnalysis;

    @Column(columnDefinition = "TEXT")
    private String carePlan;

    private java.time.LocalDate lastChecklistDate;
    private Boolean medsChecked = false;
    private Boolean dietChecked = false;
    private Boolean exerciseChecked = false;

    public PatientProfile() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getDob() { return dob; }
    public void setDob(String dob) { this.dob = dob; }

    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }

    public String getEmergencyNumber() { return emergencyNumber; }
    public void setEmergencyNumber(String n) { this.emergencyNumber = n; }

    public String getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(String preferredLanguage) { this.preferredLanguage = preferredLanguage; }

    public String getExistingMedicalCondition() { return existingMedicalCondition; }
    public void setExistingMedicalCondition(String existingMedicalCondition) {
        this.existingMedicalCondition = existingMedicalCondition;
    }

    public String getIdProof() { return idProof; }
    public void setIdProof(String idProof) { this.idProof = idProof; }

    public String getCurrentMedication() { return currentMedication; }
    public void setCurrentMedication(String currentMedication) { this.currentMedication = currentMedication; }

    public String getAllergies() { return allergies; }
    public void setAllergies(String allergies) { this.allergies = allergies; }

    public Boolean getIsFirstTimeUser() { return isFirstTimeUser; }
    public void setIsFirstTimeUser(Boolean firstTimeUser) { isFirstTimeUser = firstTimeUser; }

    public String getHospitalPreference() { return hospitalPreference; }
    public void setHospitalPreference(String hospitalPreference) { this.hospitalPreference = hospitalPreference; }

    public String getPrescriptionReportUrl() { return prescriptionReportUrl; }
    public void setPrescriptionReportUrl(String url) { this.prescriptionReportUrl = url; }

    public Integer getExpPoints() { return expPoints != null ? expPoints : 0; }
    public void setExpPoints(Integer expPoints) { this.expPoints = expPoints; }

    public Integer getStreakDays() { return streakDays != null ? streakDays : 0; }
    public void setStreakDays(Integer streakDays) { this.streakDays = streakDays; }

    public String getHealthBadge() { return healthBadge; }
    public void setHealthBadge(String healthBadge) { this.healthBadge = healthBadge; }

    public String getLastAnalysis() { return lastAnalysis; }
    public void setLastAnalysis(String lastAnalysis) { this.lastAnalysis = lastAnalysis; }

    public String getCarePlan() { return carePlan; }
    public void setCarePlan(String carePlan) { this.carePlan = carePlan; }

    public java.time.LocalDate getLastChecklistDate() { return lastChecklistDate; }
    public void setLastChecklistDate(java.time.LocalDate lastChecklistDate) {
        this.lastChecklistDate = lastChecklistDate;
    }

    public Boolean getMedsChecked() { return medsChecked != null ? medsChecked : false; }
    public void setMedsChecked(Boolean medsChecked) { this.medsChecked = medsChecked; }

    public Boolean getDietChecked() { return dietChecked != null ? dietChecked : false; }
    public void setDietChecked(Boolean dietChecked) { this.dietChecked = dietChecked; }

    public Boolean getExerciseChecked() { return exerciseChecked != null ? exerciseChecked : false; }
    public void setExerciseChecked(Boolean exerciseChecked) { this.exerciseChecked = exerciseChecked; }
}
